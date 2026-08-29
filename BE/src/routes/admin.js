import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { canTransition, complaintTransitions, roles } from '../domain.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  AuditLog,
  Booking,
  Complaint,
  Payment,
  PolicyVersion,
  RepairRequest,
  Refund,
  Review,
  Service,
  TechnicianProfile,
  User,
} from '../models/index.js';
import { createNotification, writeAudit } from '../services/notifications.js';
import { runIdempotent } from '../services/idempotency.js';
import { applyProviderEvent, createProviderRefund } from '../services/payments.js';
import { asyncHandler } from '../utils/async-handler.js';
import { conflict, notFound } from '../utils/http-error.js';
import { escapeRegex, objectIdParam, pageQuery, validate } from '../utils/validation.js';

const router = Router();
router.param('id', objectIdParam);
router.use(authenticate, authorize(roles.ADMIN));

router.get('/metrics', asyncHandler(async (_request, response) => {
  const [users, techniciansPending, requests, bookings, paymentsPaid, complaintsPending, revenue] = await Promise.all([
    User.countDocuments(),
    TechnicianProfile.countDocuments({ approvalStatus: 'PENDING' }),
    RepairRequest.countDocuments(),
    Booking.countDocuments(),
    Payment.countDocuments({ status: 'PAID' }),
    Complaint.countDocuments({ status: { $in: ['PENDING', 'PROCESSING'] } }),
    Payment.aggregate([{ $match: { status: 'PAID' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  response.json({ users, techniciansPending, requests, bookings, paymentsPaid, complaintsPending, revenue: revenue[0]?.total || 0 });
}));

router.get('/users', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  const search = escapeRegex(request.query.q || '');
  const filter = search ? { $or: [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] } : {};
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.patch('/users/:id/status', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    status: z.enum(['ACTIVE', 'LOCKED']),
    reason: z.string().trim().min(10).max(1000),
  }).strict(), request.body);
  if (request.params.id === request.user.id && input.status === 'LOCKED') throw conflict('SELF_LOCK', 'Không thể tự khóa tài khoản quản trị đang dùng.');
  let user;
  await mongoose.connection.transaction(async (session) => {
    const current = await User.findById(request.params.id).session(session);
    if (!current) throw notFound('Không tìm thấy tài khoản.');
    user = await User.findOneAndUpdate(
      { _id: request.params.id, status: current.status },
      { $set: { status: input.status }, $inc: { authVersion: 1 } },
      { returnDocument: 'after', runValidators: true, session },
    );
    if (!user) throw conflict('CONCURRENT_UPDATE', 'Tài khoản vừa được cập nhật bởi thao tác khác.');
    await writeAudit(request.user._id, 'UPDATE_USER_STATUS', 'User', user._id, {
      before: { status: current.status },
      after: { status: user.status },
      reason: input.reason,
      requestId: request.id,
    }, { session });
  });
  response.json({ user });
}));

router.get('/technicians', asyncHandler(async (request, response) => {
  const filter = request.query.status ? { approvalStatus: request.query.status } : {};
  const items = await TechnicianProfile.find(filter)
    .populate('user', 'name email status')
    .populate('serviceIds', 'name')
    .sort({ createdAt: -1 })
    .lean();
  response.json({ items });
}));

router.patch('/technicians/:id/approval', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    reason: z.string().trim().max(1000).optional().default(''),
  }).strict().refine(
    (value) => value.status !== 'REJECTED' || value.reason.length >= 10,
    { message: 'Từ chối hồ sơ cần lý do ít nhất 10 ký tự', path: ['reason'] },
  ), request.body);
  let profile;
  await mongoose.connection.transaction(async (session) => {
    profile = await TechnicianProfile.findOneAndUpdate(
      { user: request.params.id },
      { approvalStatus: input.status, acceptingJobs: input.status === 'APPROVED' },
      { returnDocument: 'after', runValidators: true, session },
    );
    if (!profile) throw notFound('Không tìm thấy hồ sơ thợ.');
    await User.updateOne(
      { _id: request.params.id },
      { role: input.status === 'APPROVED' ? roles.TECHNICIAN : roles.CUSTOMER },
      { session },
    );
    await createNotification(
        request.params.id,
        'TECHNICIAN_APPROVAL',
        input.status === 'APPROVED' ? 'Hồ sơ đã được duyệt' : 'Hồ sơ chưa được duyệt',
        input.status === 'APPROVED' ? 'Bạn có thể bắt đầu nhận yêu cầu phù hợp.' : 'Vui lòng liên hệ quản trị viên để biết thêm chi tiết.',
        'TechnicianProfile',
        profile._id,
        { session },
      );
    await writeAudit(request.user._id, 'REVIEW_TECHNICIAN', 'TechnicianProfile', profile._id, {
        after: { approvalStatus: input.status },
        reason: input.reason,
        requestId: request.id,
      }, { session });
  });
  response.json({ profile });
}));

router.post('/services', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().min(10).max(1000),
    basePrice: z.number().int().min(0).max(1_000_000_000),
  }).strict(), request.body);
  let service;
  await mongoose.connection.transaction(async (session) => {
    [service] = await Service.create([input], { session });
    await writeAudit(request.user._id, 'CREATE_SERVICE', 'Service', service._id, {
      after: input,
      reason: 'Tạo danh mục dịch vụ.',
      requestId: request.id,
    }, { session });
  });
  response.status(201).json({ service });
}));

router.get('/services', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  const [items, total] = await Promise.all([
    Service.find().sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Service.countDocuments(),
  ]);
  response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.patch('/services/:id', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().min(10).max(1000).optional(),
    basePrice: z.number().int().min(0).max(1_000_000_000).optional(),
    isActive: z.boolean().optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'Cần ít nhất một trường cập nhật'), request.body);
  let service;
  await mongoose.connection.transaction(async (session) => {
    const current = await Service.findById(request.params.id).session(session);
    if (!current) throw notFound('Không tìm thấy dịch vụ.');
    service = await Service.findOneAndUpdate(
      { _id: current._id, updatedAt: current.updatedAt },
      input,
      { returnDocument: 'after', runValidators: true, session },
    );
    if (!service) throw conflict('CONCURRENT_UPDATE', 'Dịch vụ vừa được cập nhật bởi thao tác khác.');
    await writeAudit(request.user._id, 'UPDATE_SERVICE', 'Service', service._id, {
      before: current.toObject(),
      after: service.toObject(),
      reason: 'Cập nhật danh mục dịch vụ.',
      requestId: request.id,
    }, { session });
  });
  response.json({ service });
}));

router.get('/complaints', asyncHandler(async (request, response) => {
  const filter = request.query.status ? { status: request.query.status } : {};
  const items = await Complaint.find(filter)
    .populate('customer', 'name email')
    .populate('booking')
    .sort({ createdAt: -1 })
    .lean();
  response.json({ items });
}));

router.patch('/complaints/:id', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    status: z.enum([
      'PROCESSING',
      'WAITING_FOR_CUSTOMER',
      'WAITING_FOR_TECHNICIAN',
      'RESOLVED',
      'REJECTED',
      'REOPENED',
    ]),
    resolution: z.string().trim().max(2000).optional().default(''),
    reason: z.string().trim().max(1000).optional().default(''),
  }).strict(), request.body);
  const complaint = await Complaint.findById(request.params.id);
  if (!complaint) throw notFound('Không tìm thấy khiếu nại.');
  if (!canTransition(complaintTransitions, complaint.status, input.status)) {
    throw conflict('INVALID_STATE_TRANSITION', `Không thể chuyển từ ${complaint.status} sang ${input.status}.`);
  }
  if (['RESOLVED', 'REJECTED'].includes(input.status) && input.resolution.length < 10) {
    throw conflict('RESOLUTION_REQUIRED', 'Cần nhập kết quả xử lý ít nhất 10 ký tự.');
  }
  if (input.status === 'REOPENED' && input.reason.length < 10) {
    throw conflict('REOPEN_REASON_REQUIRED', 'Mở lại khiếu nại cần lý do ít nhất 10 ký tự.');
  }
  const previousStatus = complaint.status;
  let updatedComplaint;
  await mongoose.connection.transaction(async (session) => {
    updatedComplaint = await Complaint.findOneAndUpdate(
      { _id: complaint._id, status: previousStatus },
      {
        $set: { status: input.status, resolution: input.resolution },
        $push: { timeline: {
          actor: request.user._id,
          actorRole: request.user.role,
          message: input.resolution || input.reason || ('Chuyển trạng thái sang ' + input.status),
        } },
      },
      { returnDocument: 'after', runValidators: true, session },
    );
    if (!updatedComplaint) throw conflict('CONCURRENT_UPDATE', 'Khiếu nại vừa được cập nhật bởi thao tác khác.');
    await createNotification(complaint.customer, 'COMPLAINT_STATUS', 'Khiếu nại đã cập nhật', `Khiếu nại đã chuyển từ ${previousStatus} sang ${input.status}.`, 'Complaint', complaint._id, { session });
    await writeAudit(request.user._id, 'UPDATE_COMPLAINT', 'Complaint', complaint._id, {
      before: { status: previousStatus },
      after: { status: input.status },
      reason: input.resolution || input.reason,
      requestId: request.id,
    }, { session });
  });
  response.json({ complaint: updatedComplaint });
}));

router.patch('/reviews/:id/status', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    status: z.enum(['VISIBLE', 'HIDDEN']),
    reason: z.string().trim().min(10).max(1000),
  }).strict(), request.body);
  let review;
  await mongoose.connection.transaction(async (session) => {
    review = await Review.findById(request.params.id).session(session);
    if (!review) throw notFound('Không tìm thấy đánh giá.');
    const previousStatus = review.status;
    review.history.push({
      rating: review.rating,
      comment: review.comment,
      action: 'MODERATED',
    });
    review.status = input.status;
    await review.save({ session });
    const [rating] = await Review.aggregate([
      { $match: { technician: review.technician, status: 'VISIBLE', deletedAt: null } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]).session(session);
    await TechnicianProfile.updateOne(
      { user: review.technician },
      { ratingAverage: rating?.average || 0, ratingCount: rating?.count || 0 },
      { session },
    );
    await writeAudit(request.user._id, 'MODERATE_REVIEW', 'Review', review._id, {
      before: { status: previousStatus },
      after: { status: input.status },
      reason: input.reason,
      requestId: request.id,
    }, { session });
  });
  response.json({ review });
}));

router.get('/reviews', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  const filter = request.query.status ? { status: request.query.status } : {};
  const [items, total] = await Promise.all([
    Review.find(filter)
      .populate('customer', 'name email')
      .populate('technician', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);
  response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.get('/payments', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  const filter = request.query.status ? { status: request.query.status } : {};
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate('customer', 'name email')
      .populate('booking', 'status amount')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);
  response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.post('/payments/:id/refunds', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    amount: z.number().int().positive(),
    reason: z.string().trim().min(10).max(1000),
  }).strict(), request.body);
  const payment = await Payment.findById(request.params.id);
  if (!payment) throw notFound('Không tìm thấy payment.');
  if (!['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
    throw conflict('PAYMENT_NOT_REFUNDABLE', 'Payment không ở trạng thái có thể hoàn tiền.');
  }
  if (input.amount > payment.amount - payment.refundedAmount) {
    throw conflict('REFUND_AMOUNT_INVALID', 'Số tiền hoàn vượt quá số tiền còn lại.');
  }
  const idempotencyKey = request.get('idempotency-key');
  const result = await runIdempotent({
    owner: request.user.id,
    method: 'POST',
    route: '/api/admin/payments/:id/refunds',
    key: idempotencyKey,
    payload: { paymentId: payment.id, ...input },
    execute: async () => {
      const refund = await Refund.create({
        payment: payment._id,
        booking: payment.booking,
        amount: input.amount,
        reason: input.reason,
        status: 'PROCESSING',
        idempotencyKey,
        actor: request.user._id,
      });
      const provider = await createProviderRefund(refund, payment);
      refund.providerRefundId = provider.providerRefundId;
      await refund.save();
      if (provider.succeeded) {
        await applyProviderEvent(payment.provider, {
          id: 'refund_event_' + refund.id,
          type: 'REFUND_SUCCEEDED',
          paymentId: payment.id,
          providerPaymentId: payment.providerPaymentId,
          refundId: refund.id,
          providerRefundId: provider.providerRefundId,
          amount: refund.amount,
          currency: payment.currency,
        });
      }
      const current = await Refund.findById(refund._id);
      await writeAudit(request.user._id, 'CREATE_REFUND', 'Refund', refund._id, {
        after: { amount: refund.amount, status: current.status },
        reason: input.reason,
        requestId: request.id,
      });
      return { status: 201, body: { refund: current.toJSON() } };
    },
  });
  response.status(result.status).json({ ...result.body, replayed: result.replayed });
}));

router.post('/payments/reconcile', asyncHandler(async (request, response) => {
  const missingProviderReference = await Payment.find({
    method: { $ne: 'CASH' },
    status: { $in: ['PROCESSING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
    $or: [{ providerPaymentId: null }, { providerPaymentId: '' }],
  }).select('_id booking status').lean();
  await writeAudit(request.user._id, 'RUN_PAYMENT_RECONCILIATION', 'User', request.user._id, {
    discrepancies: missingProviderReference.length,
    requestId: request.id,
  });
  response.json({
    checkedAt: new Date().toISOString(),
    discrepancies: missingProviderReference,
    note: 'External provider adapter performs remote comparison when configured.',
  });
}));

router.get('/policies', asyncHandler(async (_request, response) => {
  const items = await PolicyVersion.find().sort({ code: 1, effectiveAt: -1 }).lean();
  response.json({ items });
}));

router.post('/policies', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    code: z.enum(['CANCELLATION', 'COMMISSION', 'WARRANTY', 'COMPLAINT_SLA']),
    version: z.string().trim().min(1).max(40),
    values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    effectiveAt: z.coerce.date(),
  }).strict(), request.body);
  let policy;
  await mongoose.connection.transaction(async (session) => {
    await PolicyVersion.updateMany({ code: input.code, isActive: true }, { isActive: false }, { session });
    [policy] = await PolicyVersion.create([{ ...input, createdBy: request.user._id }], { session });
    await writeAudit(request.user._id, 'CREATE_POLICY_VERSION', 'PolicyVersion', policy._id, {
      after: input,
      reason: 'Kích hoạt policy version mới.',
      requestId: request.id,
    }, { session });
  });
  response.status(201).json({ policy });
}));

router.get('/audit-logs', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  const filter = {};
  if (request.query.action) filter.action = request.query.action;
  if (request.query.entityType) filter.entityType = request.query.entityType;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).populate('actor', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

export default router;
