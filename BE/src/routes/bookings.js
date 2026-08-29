import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { bookingTransitions, canTransition, roles } from '../domain.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  Booking,
  Complaint,
  Payment,
  RepairRequest,
  Review,
  TechnicianProfile,
  User,
} from '../models/index.js';
import { createNotification } from '../services/notifications.js';
import { asyncHandler } from '../utils/async-handler.js';
import { conflict, forbidden, notFound } from '../utils/http-error.js';
import { pageQuery, validate } from '../utils/validation.js';

const router = Router();

router.use(authenticate);

function populatedBooking(query) {
  return query
    .populate('customer', 'name phone')
    .populate('technician', 'name phone')
    .populate({ path: 'request', populate: { path: 'service', select: 'name basePrice' } });
}

router.get('/', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  let filter;
  if (request.user.role === roles.CUSTOMER) filter = { customer: request.user._id };
  else if (request.user.role === roles.TECHNICIAN) filter = { technician: request.user._id };
  else if (request.user.role === roles.ADMIN) filter = {};
  else throw forbidden();
  if (request.query.status) filter.status = request.query.status;
  const [items, total] = await Promise.all([
    populatedBooking(Booking.find(filter))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);
  const bookingIds = items.map((item) => item._id);
  const [payments, reviews] = await Promise.all([
    Payment.find({ booking: { $in: bookingIds } }).select('booking status').lean(),
    Review.find({ booking: { $in: bookingIds } }).select('booking').lean(),
  ]);
  const paymentByBooking = new Map(payments.map((item) => [item.booking.toString(), item.status]));
  const reviewed = new Set(reviews.map((item) => item.booking.toString()));
  response.json({
    items: items.map((item) => ({
      ...item,
      paymentStatus: paymentByBooking.get(item._id.toString()) || null,
      hasReview: reviewed.has(item._id.toString()),
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}));

router.patch('/:id/status', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    status: z.enum(['TECHNICIAN_ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  }).strict(), request.body);
  const booking = await Booking.findById(request.params.id);
  if (!booking) throw notFound('Không tìm thấy đơn sửa chữa.');
  const customerCancellation = request.user.role === roles.CUSTOMER
    && booking.customer.equals(request.user._id)
    && input.status === 'CANCELLED';
  const technicianUpdate = request.user.role === roles.TECHNICIAN && booking.technician.equals(request.user._id);
  const adminUpdate = request.user.role === roles.ADMIN;
  if (!customerCancellation && !technicianUpdate && !adminUpdate) throw forbidden('Bạn không có quyền cập nhật đơn này.');
  if (!canTransition(bookingTransitions, booking.status, input.status)) {
    throw conflict('INVALID_STATE_TRANSITION', `Không thể chuyển từ ${booking.status} sang ${input.status}.`);
  }

  let updated;
  await mongoose.connection.transaction(async (session) => {
    updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: booking.status },
      { status: input.status },
      { returnDocument: 'after', runValidators: true, session },
    );
    if (!updated) throw conflict('CONCURRENT_UPDATE', 'Đơn vừa được cập nhật bởi thao tác khác.');
    const requestStatus = {
      IN_PROGRESS: 'IN_PROGRESS',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
    }[input.status];
    if (requestStatus) await RepairRequest.updateOne({ _id: booking.request }, { status: requestStatus }, { session });
    const recipient = booking.customer.equals(request.user._id) ? booking.technician : booking.customer;
    await createNotification(
      recipient,
      'BOOKING_STATUS',
      'Trạng thái đơn thay đổi',
      `Đơn đã chuyển sang ${input.status}.`,
      'Booking',
      booking._id,
      { session },
    );
  });
  await updated.populate([
    { path: 'customer', select: 'name phone' },
    { path: 'technician', select: 'name phone' },
    { path: 'request', populate: { path: 'service', select: 'name basePrice' } },
  ]);
  response.json({ booking: updated });
}));

router.post('/:id/payments', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const input = validate(z.object({ method: z.enum(['CASH', 'MOCK_CARD']) }).strict(), request.body);
  const idempotencyKey = request.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    throw conflict('IDEMPOTENCY_KEY_REQUIRED', 'Cần Idempotency-Key dài từ 8 đến 100 ký tự.');
  }
  const existing = await Payment.findOne({ customer: request.user._id, idempotencyKey });
  if (existing) return response.json({ payment: existing, duplicate: true });
  const booking = await Booking.findById(request.params.id);
  if (!booking) throw notFound('Không tìm thấy đơn sửa chữa.');
  if (!booking.customer.equals(request.user._id)) throw forbidden('Đơn không thuộc tài khoản của bạn.');
  if (booking.status !== 'COMPLETED') throw conflict('INVALID_STATE', 'Chỉ thanh toán sau khi đơn hoàn thành.');
  const payment = await Payment.create({
    booking: booking._id,
    customer: request.user._id,
    amount: booking.amount,
    method: input.method,
    status: 'PAID',
    paidAt: new Date(),
    idempotencyKey,
  });
  await createNotification(
    booking.technician,
    'PAYMENT_PAID',
    'Đơn đã thanh toán',
    `Khoản thanh toán ${booking.amount.toLocaleString('vi-VN')}đ đã được ghi nhận.`,
    'Booking',
    booking._id,
  );
  response.status(201).json({ payment, duplicate: false });
}));

router.post('/:id/reviews', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const input = validate(z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional().default(''),
  }).strict(), request.body);
  const booking = await Booking.findById(request.params.id);
  if (!booking) throw notFound('Không tìm thấy đơn sửa chữa.');
  if (!booking.customer.equals(request.user._id)) throw forbidden('Đơn không thuộc tài khoản của bạn.');
  if (booking.status !== 'COMPLETED') throw conflict('INVALID_STATE', 'Chỉ đánh giá sau khi đơn hoàn thành.');
  const review = await Review.create({
    booking: booking._id,
    customer: request.user._id,
    technician: booking.technician,
    ...input,
  });
  const [rating] = await Review.aggregate([
    { $match: { technician: booking.technician, status: 'VISIBLE' } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Promise.all([
    TechnicianProfile.updateOne(
      { user: booking.technician },
      { ratingAverage: rating?.average || 0, ratingCount: rating?.count || 0 },
    ),
    createNotification(
      booking.technician,
      'NEW_REVIEW',
      'Có đánh giá mới',
      `${request.user.name} đã đánh giá ${input.rating}/5 sao.`,
      'Review',
      review._id,
    ),
  ]);
  response.status(201).json({ review });
}));

router.post('/:id/complaints', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const input = validate(z.object({
    subject: z.string().trim().min(5).max(150),
    detail: z.string().trim().min(20).max(2000),
  }).strict(), request.body);
  const booking = await Booking.findById(request.params.id);
  if (!booking) throw notFound('Không tìm thấy đơn sửa chữa.');
  if (!booking.customer.equals(request.user._id)) throw forbidden('Đơn không thuộc tài khoản của bạn.');
  const complaint = await Complaint.create({
    booking: booking._id,
    customer: request.user._id,
    ...input,
  });
  const admins = await User.find({ role: roles.ADMIN, status: 'ACTIVE' }).select('_id').lean();
  await Promise.all(admins.map((admin) => createNotification(
    admin._id,
    'NEW_COMPLAINT',
    'Có khiếu nại mới',
    input.subject,
    'Complaint',
    complaint._id,
  )));
  response.status(201).json({ complaint });
}));

export default router;
