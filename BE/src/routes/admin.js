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
  RepairRequest,
  Review,
  Service,
  TechnicianProfile,
  User,
} from '../models/index.js';
import { createNotification, writeAudit } from '../services/notifications.js';
import { asyncHandler } from '../utils/async-handler.js';
import { conflict, notFound } from '../utils/http-error.js';
import { escapeRegex, pageQuery, validate } from '../utils/validation.js';

const router = Router();
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
  const input = validate(z.object({ status: z.enum(['ACTIVE', 'LOCKED']) }).strict(), request.body);
  if (request.params.id === request.user.id && input.status === 'LOCKED') throw conflict('SELF_LOCK', 'Không thể tự khóa tài khoản quản trị đang dùng.');
  const user = await User.findByIdAndUpdate(request.params.id, { status: input.status }, { returnDocument: 'after', runValidators: true });
  if (!user) throw notFound('Không tìm thấy tài khoản.');
  await writeAudit(request.user._id, 'UPDATE_USER_STATUS', 'User', user._id, input);
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
  const input = validate(z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).strict(), request.body);
  let profile;
  await mongoose.connection.transaction(async (session) => {
    profile = await TechnicianProfile.findOneAndUpdate(
      { user: request.params.id },
      { approvalStatus: input.status, acceptingJobs: input.status === 'APPROVED' },
      { returnDocument: 'after', runValidators: true, session },
    );
    if (!profile) throw notFound('Không tìm thấy hồ sơ thợ.');
    await Promise.all([
      User.updateOne({ _id: request.params.id }, { role: input.status === 'APPROVED' ? roles.TECHNICIAN : roles.CUSTOMER }, { session }),
      createNotification(
        request.params.id,
        'TECHNICIAN_APPROVAL',
        input.status === 'APPROVED' ? 'Hồ sơ đã được duyệt' : 'Hồ sơ chưa được duyệt',
        input.status === 'APPROVED' ? 'Bạn có thể bắt đầu nhận yêu cầu phù hợp.' : 'Vui lòng liên hệ quản trị viên để biết thêm chi tiết.',
        'TechnicianProfile',
        profile._id,
        { session },
      ),
      writeAudit(request.user._id, 'REVIEW_TECHNICIAN', 'TechnicianProfile', profile._id, input, { session }),
    ]);
  });
  response.json({ profile });
}));

router.post('/services', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().min(10).max(1000),
    basePrice: z.number().int().min(0).max(1_000_000_000),
  }).strict(), request.body);
  const service = await Service.create(input);
  await writeAudit(request.user._id, 'CREATE_SERVICE', 'Service', service._id, { name: service.name });
  response.status(201).json({ service });
}));

router.patch('/services/:id', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().min(10).max(1000).optional(),
    basePrice: z.number().int().min(0).max(1_000_000_000).optional(),
    isActive: z.boolean().optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'Cần ít nhất một trường cập nhật'), request.body);
  const service = await Service.findByIdAndUpdate(request.params.id, input, { returnDocument: 'after', runValidators: true });
  if (!service) throw notFound('Không tìm thấy dịch vụ.');
  await writeAudit(request.user._id, 'UPDATE_SERVICE', 'Service', service._id, input);
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
    status: z.enum(['PROCESSING', 'RESOLVED', 'REJECTED']),
    resolution: z.string().trim().max(2000).optional().default(''),
  }).strict(), request.body);
  const complaint = await Complaint.findById(request.params.id);
  if (!complaint) throw notFound('Không tìm thấy khiếu nại.');
  if (!canTransition(complaintTransitions, complaint.status, input.status)) {
    throw conflict('INVALID_STATE_TRANSITION', `Không thể chuyển từ ${complaint.status} sang ${input.status}.`);
  }
  if (['RESOLVED', 'REJECTED'].includes(input.status) && input.resolution.length < 10) {
    throw conflict('RESOLUTION_REQUIRED', 'Cần nhập kết quả xử lý ít nhất 10 ký tự.');
  }
  const previousStatus = complaint.status;
  complaint.status = input.status;
  complaint.resolution = input.resolution;
  await Promise.all([
    complaint.save(),
    createNotification(complaint.customer, 'COMPLAINT_STATUS', 'Khiếu nại đã cập nhật', `Khiếu nại đã chuyển từ ${previousStatus} sang ${input.status}.`, 'Complaint', complaint._id),
    writeAudit(request.user._id, 'UPDATE_COMPLAINT', 'Complaint', complaint._id, { from: previousStatus, to: input.status }),
  ]);
  response.json({ complaint });
}));

router.patch('/reviews/:id/status', asyncHandler(async (request, response) => {
  const input = validate(z.object({ status: z.enum(['VISIBLE', 'HIDDEN']) }).strict(), request.body);
  const review = await Review.findByIdAndUpdate(request.params.id, input, { returnDocument: 'after' });
  if (!review) throw notFound('Không tìm thấy đánh giá.');
  const [rating] = await Review.aggregate([
    { $match: { technician: review.technician, status: 'VISIBLE' } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Promise.all([
    TechnicianProfile.updateOne({ user: review.technician }, { ratingAverage: rating?.average || 0, ratingCount: rating?.count || 0 }),
    writeAudit(request.user._id, 'MODERATE_REVIEW', 'Review', review._id, input),
  ]);
  response.json({ review });
}));

router.get('/audit-logs', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  const items = await AuditLog.find().populate('actor', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  response.json({ items, pagination: { page, limit } });
}));

export default router;
