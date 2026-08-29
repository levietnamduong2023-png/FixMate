import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { bookingTransitions, canTransition, roles } from '../domain.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  Booking,
  BookingTimeline,
  Complaint,
  Payment,
  RepairRequest,
  Review,
  TechnicianProfile,
  User,
} from '../models/index.js';
import { createNotification, writeAudit } from '../services/notifications.js';
import { runIdempotent } from '../services/idempotency.js';
import { applyProviderEvent, createProviderPayment } from '../services/payments.js';
import { asyncHandler } from '../utils/async-handler.js';
import { conflict, forbidden, notFound } from '../utils/http-error.js';
import { objectIdParam, pageQuery, validate } from '../utils/validation.js';

const router = Router();
router.param('id', objectIdParam);
router.param('paymentId', objectIdParam);
router.param('reviewId', objectIdParam);

router.use(authenticate);

function populatedBooking(query) {
  return query
    .populate('customer', 'name phone')
    .populate('technician', 'name phone')
    .populate({ path: 'request', populate: { path: 'service', select: 'name basePrice' } });
}

async function recalculateRating(technician) {
  const [rating] = await Review.aggregate([
    { $match: { technician, status: 'VISIBLE', deletedAt: null } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await TechnicianProfile.updateOne(
    { user: technician },
    { ratingAverage: rating?.average || 0, ratingCount: rating?.count || 0 },
  );
}

router.get('/', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  let filter;
  if (request.user.role === roles.CUSTOMER) filter = { customer: request.user._id };
  else if (request.user.role === roles.TECHNICIAN) filter = { technician: request.user._id };
  else if (request.user.role === roles.ADMIN) filter = {};
  else throw forbidden();
  if (request.query.status) {
    filter.status = validate(z.enum([
      'CONFIRMED',
      'TECHNICIAN_ON_THE_WAY',
      'IN_PROGRESS',
      'AWAITING_CUSTOMER_CONFIRMATION',
      'CANCELLATION_REVIEW',
      'DISPUTED',
      'COMPLETED',
      'CANCELLED',
    ]), request.query.status);
  }
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
    Review.find({ booking: { $in: bookingIds }, deletedAt: null }).select('booking rating comment status createdAt').lean(),
  ]);
  const paymentByBooking = new Map(payments.map((item) => [item.booking.toString(), item.status]));
  const reviewByBooking = new Map(reviews.map((item) => [item.booking.toString(), item]));
  response.json({
    items: items.map((item) => ({
      ...item,
      paymentStatus: paymentByBooking.get(item._id.toString()) || null,
      hasReview: reviewByBooking.has(item._id.toString()),
      review: reviewByBooking.get(item._id.toString()) || null,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}));

router.patch('/:id/status', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    status: z.enum([
      'TECHNICIAN_ON_THE_WAY',
      'IN_PROGRESS',
      'AWAITING_CUSTOMER_CONFIRMATION',
      'CANCELLATION_REVIEW',
      'DISPUTED',
      'COMPLETED',
      'CANCELLED',
    ]),
    reason: z.string().trim().max(1000).optional().default(''),
    completionSummary: z.string().trim().max(2000).optional().default(''),
    cancellationDecision: z.enum(['CUSTOMER_FAULT', 'TECHNICIAN_FAULT', 'FORCE_MAJEURE', 'WAIVED']).optional(),
  }).strict(), request.body);
  const booking = await Booking.findById(request.params.id);
  if (!booking) throw notFound('Không tìm thấy đơn sửa chữa.');
  const customerOwner = request.user.role === roles.CUSTOMER && booking.customer.equals(request.user._id);
  const technicianOwner = request.user.role === roles.TECHNICIAN && booking.technician.equals(request.user._id);
  const adminUpdate = request.user.role === roles.ADMIN;
  if (!customerOwner && !technicianOwner && !adminUpdate) throw forbidden('Bạn không có quyền cập nhật đơn này.');
  if (!canTransition(bookingTransitions, booking.status, input.status)) {
    throw conflict('INVALID_STATE_TRANSITION', `Không thể chuyển từ ${booking.status} sang ${input.status}.`);
  }
  const customerAllowed = customerOwner && (
    (booking.status === 'CONFIRMED' && input.status === 'CANCELLED')
    || (booking.status === 'AWAITING_CUSTOMER_CONFIRMATION' && ['COMPLETED', 'DISPUTED'].includes(input.status))
  );
  const technicianAllowed = technicianOwner && (
    (booking.status === 'CONFIRMED' && ['TECHNICIAN_ON_THE_WAY', 'CANCELLATION_REVIEW'].includes(input.status))
    || (booking.status === 'TECHNICIAN_ON_THE_WAY' && ['IN_PROGRESS', 'CANCELLATION_REVIEW'].includes(input.status))
    || (booking.status === 'IN_PROGRESS' && ['AWAITING_CUSTOMER_CONFIRMATION', 'CANCELLATION_REVIEW'].includes(input.status))
  );
  if (!customerAllowed && !technicianAllowed && !adminUpdate) throw forbidden('Bạn không có quyền cập nhật đơn này.');
  if (adminUpdate && input.reason.length < 10) {
    throw conflict('ADMIN_REASON_REQUIRED', 'Admin override cần lý do ít nhất 10 ký tự.');
  }
  const completionSummary = input.completionSummary || (adminUpdate ? input.reason : '');
  if (input.status === 'AWAITING_CUSTOMER_CONFIRMATION' && completionSummary.length < 10) {
    throw conflict('COMPLETION_REPORT_REQUIRED', 'Cần báo cáo hoàn thành ít nhất 10 ký tự.');
  }
  if (['CANCELLATION_REVIEW', 'DISPUTED'].includes(input.status) && input.reason.length < 10) {
    throw conflict('REASON_REQUIRED', 'Cần nhập lý do ít nhất 10 ký tự.');
  }
  const decidesCancellation = adminUpdate
    && booking.status === 'CANCELLATION_REVIEW'
    && input.status === 'CANCELLED';
  if (decidesCancellation && !input.cancellationDecision) {
    throw conflict('CANCELLATION_DECISION_REQUIRED', 'Admin phải chọn kết luận trách nhiệm hủy đơn.');
  }
  let updated;
  await mongoose.connection.transaction(async (session) => {
    const previousStatus = booking.status;
    const update = { status: input.status };
    if (input.status === 'AWAITING_CUSTOMER_CONFIRMATION') {
      update.completionReport = {
        summary: completionSummary,
        submittedAt: new Date(),
        autoCompleteAt: new Date(Date.now() + booking.policySnapshot.completionTimeoutHours * 60 * 60 * 1000),
      };
    }
    if (input.status === 'COMPLETED') update.completedAt = new Date();
    if (input.status === 'CANCELLED') {
      update.cancelledAt = new Date();
      if (decidesCancellation) {
        update.cancellationDecision = input.cancellationDecision;
        update.cancellationFee = input.cancellationDecision === 'CUSTOMER_FAULT'
          ? Math.min(
            Math.round(booking.amount * booking.policySnapshot.lateCancellationRate),
            booking.policySnapshot.lateCancellationCap,
          )
          : 0;
        update.cancellationDecidedBy = request.user._id;
        update.cancellationDecidedAt = new Date();
        update.cancellationReason = input.reason;
      }
    }
    updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: booking.status },
      update,
      { returnDocument: 'after', runValidators: true, session },
    );
    if (!updated) throw conflict('CONCURRENT_UPDATE', 'Đơn vừa được cập nhật bởi thao tác khác.');
    const requestStatus = {
      IN_PROGRESS: 'IN_PROGRESS',
      AWAITING_CUSTOMER_CONFIRMATION: 'IN_PROGRESS',
      CANCELLATION_REVIEW: 'IN_PROGRESS',
      DISPUTED: 'IN_PROGRESS',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
    }[input.status];
    if (requestStatus) await RepairRequest.updateOne({ _id: booking.request }, { status: requestStatus }, { session });
    await BookingTimeline.create([{
      booking: booking._id,
      actor: request.user._id,
      from: previousStatus,
      to: input.status,
      reason: input.reason || input.completionSummary,
      requestId: request.id,
    }], { session });
    if (input.status === 'DISPUTED') {
      await Complaint.create([{
        booking: booking._id,
        customer: booking.customer,
        type: 'COMPLAINT',
        subject: 'Tranh chấp xác nhận hoàn thành',
        detail: input.reason,
        timeline: [{
          actor: request.user._id,
          actorRole: request.user.role,
          message: input.reason,
        }],
      }], { session });
    }
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
    if (adminUpdate) {
      await writeAudit(
        request.user._id,
        'OVERRIDE_BOOKING_STATUS',
        'Booking',
        booking._id,
        {
          from: previousStatus,
          to: input.status,
          reason: input.reason,
          cancellationDecision: input.cancellationDecision || null,
          cancellationFee: update.cancellationFee || 0,
          requestId: request.id,
        },
        { session },
      );
    }
  });
  await updated.populate([
    { path: 'customer', select: 'name phone' },
    { path: 'technician', select: 'name phone' },
    { path: 'request', populate: { path: 'service', select: 'name basePrice' } },
  ]);
  response.json({ booking: updated });
}));

router.get('/:id/timeline', asyncHandler(async (request, response) => {
  const booking = await Booking.findById(request.params.id).lean();
  if (!booking) throw notFound('Không tìm thấy đơn sửa chữa.');
  const allowed = request.user.role === roles.ADMIN
    || booking.customer.toString() === request.user.id
    || booking.technician.toString() === request.user.id;
  if (!allowed) throw forbidden();
  const items = await BookingTimeline.find({ booking: booking._id })
    .populate('actor', 'name role')
    .sort({ createdAt: 1 })
    .lean();
  response.json({ items });
}));

router.post('/:id/payments', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const input = validate(z.object({ method: z.enum(['CASH', 'ONLINE', 'MOCK_CARD']) }).strict(), request.body);
  if (config.nodeEnv === 'production' && input.method === 'MOCK_CARD') {
    throw conflict('MOCK_PAYMENT_FORBIDDEN', 'Thanh toán mô phỏng không được phép trong production.');
  }
  const idempotencyKey = request.get('idempotency-key');
  const booking = await Booking.findById(request.params.id);
  if (!booking) throw notFound('Không tìm thấy đơn sửa chữa.');
  if (!booking.customer.equals(request.user._id)) throw forbidden('Đơn không thuộc tài khoản của bạn.');
  if (booking.status !== 'COMPLETED') throw conflict('INVALID_STATE', 'Chỉ thanh toán sau khi đơn hoàn thành.');
  const result = await runIdempotent({
    owner: request.user.id,
    method: 'POST',
    route: '/api/bookings/:id/payments',
    key: idempotencyKey,
    payload: { bookingId: booking.id, ...input },
    execute: async () => {
      const payment = await Payment.create({
        booking: booking._id,
        customer: request.user._id,
        amount: booking.amount,
        method: input.method,
        provider: input.method === 'MOCK_CARD' ? 'MOCK' : config.paymentProvider,
        status: input.method === 'CASH' ? 'PROCESSING' : 'CREATED',
        idempotencyKey,
        commissionRate: booking.policySnapshot.commissionRate,
      });
      let currentPayment = payment;
      let checkoutUrl = null;
      if (input.method !== 'CASH') {
        const provider = await createProviderPayment(payment);
        payment.providerPaymentId = provider.providerPaymentId;
        payment.status = 'PROCESSING';
        checkoutUrl = provider.checkoutUrl;
        await payment.save();
        if (config.paymentProvider === 'MOCK') {
          await applyProviderEvent('MOCK', {
            id: 'mock_event_' + payment.id,
            type: 'PAYMENT_PAID',
            paymentId: payment.id,
            providerPaymentId: payment.providerPaymentId,
            amount: payment.amount,
            currency: payment.currency,
          });
          currentPayment = await Payment.findById(payment._id);
        }
      }
      await createNotification(
        booking.technician,
        currentPayment.status === 'PAID' ? 'PAYMENT_PAID' : 'PAYMENT_PROCESSING',
        currentPayment.status === 'PAID' ? 'Đơn đã thanh toán' : 'Thanh toán đang xử lý',
        currentPayment.status === 'PAID'
          ? `Khoản thanh toán ${booking.amount.toLocaleString('vi-VN')}đ đã được ghi nhận.`
          : 'Một giao dịch thanh toán đang được xử lý.',
        'Payment',
        payment._id,
      );
      return {
        status: 201,
        body: { payment: currentPayment.toJSON(), checkoutUrl, duplicate: false },
      };
    },
  });
  response.status(result.status).json({ ...result.body, duplicate: result.replayed });
}));

router.get('/:id/payments', asyncHandler(async (request, response) => {
  const booking = await Booking.findById(request.params.id).lean();
  if (!booking) throw notFound('Không tìm thấy đơn sửa chữa.');
  const allowed = request.user.role === roles.ADMIN
    || booking.customer.toString() === request.user.id
    || booking.technician.toString() === request.user.id;
  if (!allowed) throw forbidden();
  const items = await Payment.find({ booking: booking._id })
    .select(request.user.role === roles.TECHNICIAN
      ? 'amount currency status paidAt refundedAmount commissionAmount createdAt'
      : '-providerPaymentId')
    .sort({ createdAt: -1 })
    .lean();
  response.json({ items });
}));

router.patch('/:id/payments/:paymentId/cash-confirm', asyncHandler(async (request, response) => {
  const booking = await Booking.findById(request.params.id);
  if (!booking) throw notFound('Không tìm thấy đơn sửa chữa.');
  const isCustomer = request.user.role === roles.CUSTOMER && booking.customer.equals(request.user._id);
  const isTechnician = request.user.role === roles.TECHNICIAN && booking.technician.equals(request.user._id);
  if (!isCustomer && !isTechnician) throw forbidden();
  const payment = await Payment.findOne({
    _id: request.params.paymentId,
    booking: booking._id,
    method: 'CASH',
    status: 'PROCESSING',
  });
  if (!payment) throw notFound('Không tìm thấy thanh toán tiền mặt đang chờ xác nhận.');
  if (isCustomer) payment.cashCustomerConfirmedAt = payment.cashCustomerConfirmedAt || new Date();
  if (isTechnician) payment.cashTechnicianConfirmedAt = payment.cashTechnicianConfirmedAt || new Date();
  if (payment.cashCustomerConfirmedAt && payment.cashTechnicianConfirmedAt) {
    payment.status = 'PAID';
    payment.paidAt = new Date();
    payment.commissionAmount = Math.round(payment.amount * payment.commissionRate);
  }
  await payment.save();
  response.json({ payment });
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

router.patch('/:id/reviews/:reviewId', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const input = validate(z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional().default(''),
  }).strict(), request.body);
  const booking = await Booking.findOne({ _id: request.params.id, customer: request.user._id, status: 'COMPLETED' });
  if (!booking) throw notFound('Không tìm thấy đơn hoàn thành thuộc tài khoản của bạn.');
  const review = await Review.findOne({
    _id: request.params.reviewId,
    booking: booking._id,
    customer: request.user._id,
    deletedAt: null,
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });
  if (!review) throw conflict('REVIEW_EDIT_WINDOW_CLOSED', 'Không thể sửa đánh giá này.');
  review.history.push({
    rating: review.rating,
    comment: review.comment,
    action: 'UPDATED',
  });
  review.rating = input.rating;
  review.comment = input.comment;
  await review.save();
  await recalculateRating(review.technician);
  response.json({ review });
}));

router.delete('/:id/reviews/:reviewId', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const booking = await Booking.findOne({ _id: request.params.id, customer: request.user._id, status: 'COMPLETED' });
  if (!booking) throw notFound('Không tìm thấy đơn hoàn thành thuộc tài khoản của bạn.');
  const review = await Review.findOne({
    _id: request.params.reviewId,
    booking: booking._id,
    customer: request.user._id,
    deletedAt: null,
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });
  if (!review) throw conflict('REVIEW_EDIT_WINDOW_CLOSED', 'Không thể xóa đánh giá này.');
  review.history.push({
    rating: review.rating,
    comment: review.comment,
    action: 'DELETED',
  });
  review.status = 'HIDDEN';
  review.deletedAt = new Date();
  await review.save();
  await recalculateRating(review.technician);
  response.status(204).end();
}));

router.post('/:id/complaints', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const input = validate(z.object({
    type: z.enum(['COMPLAINT', 'CANCELLATION', 'WARRANTY']).optional().default('COMPLAINT'),
    subject: z.string().trim().min(5).max(150),
    detail: z.string().trim().min(20).max(2000),
  }).strict(), request.body);
  const booking = await Booking.findById(request.params.id);
  if (!booking) throw notFound('Không tìm thấy đơn sửa chữa.');
  if (!booking.customer.equals(request.user._id)) throw forbidden('Đơn không thuộc tài khoản của bạn.');
  if (input.type === 'WARRANTY') {
    if (booking.status !== 'COMPLETED' || !booking.completedAt) {
      throw conflict('WARRANTY_UNAVAILABLE', 'Chỉ yêu cầu bảo hành cho đơn đã hoàn thành.');
    }
    const warrantyEndsAt = new Date(booking.completedAt.getTime() + booking.policySnapshot.laborWarrantyDays * 24 * 60 * 60 * 1000);
    if (warrantyEndsAt < new Date()) throw conflict('WARRANTY_EXPIRED', 'Thời hạn bảo hành đã kết thúc.');
  }
  let complaint;
  await mongoose.connection.transaction(async (session) => {
    [complaint] = await Complaint.create([{
      booking: booking._id,
      customer: request.user._id,
      ...input,
      timeline: [{
        actor: request.user._id,
        actorRole: request.user.role,
        message: input.detail,
      }],
    }], { session });
    if (
      input.type === 'CANCELLATION'
      && ['TECHNICIAN_ON_THE_WAY', 'IN_PROGRESS'].includes(booking.status)
    ) {
      await Booking.updateOne(
        { _id: booking._id, status: booking.status },
        { status: 'CANCELLATION_REVIEW' },
        { session },
      );
      await BookingTimeline.create([{
        booking: booking._id,
        actor: request.user._id,
        from: booking.status,
        to: 'CANCELLATION_REVIEW',
        reason: input.detail,
        requestId: request.id,
      }], { session });
    }
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
