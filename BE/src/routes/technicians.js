import { Router } from 'express';
import { z } from 'zod';
import { roles } from '../domain.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { Quotation, RepairRequest, Service, TechnicianProfile, User } from '../models/index.js';
import { createNotification } from '../services/notifications.js';
import { asyncHandler } from '../utils/async-handler.js';
import { conflict, forbidden } from '../utils/http-error.js';
import { objectIdSchema, pageQuery, validate } from '../utils/validation.js';

const router = Router();

const applicationSchema = z.object({
  serviceIds: z.array(objectIdSchema).min(1).max(20),
  experienceYears: z.number().int().min(0).max(60),
  bio: z.string().trim().min(20).max(1000),
  area: z.string().trim().min(2).max(150),
}).strict();

router.post('/apply', authenticate, authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const input = validate(applicationSchema, request.body);
  if (await TechnicianProfile.exists({ user: request.user._id })) {
    throw conflict('PROFILE_EXISTS', 'Bạn đã gửi hồ sơ đăng ký làm thợ.');
  }
  const uniqueServices = [...new Set(input.serviceIds)];
  const serviceCount = await Service.countDocuments({ _id: { $in: uniqueServices }, isActive: true });
  if (serviceCount !== uniqueServices.length) throw conflict('INVALID_SERVICE', 'Có dịch vụ không tồn tại hoặc đã ngừng cung cấp.');
  const profile = await TechnicianProfile.create({ ...input, serviceIds: uniqueServices, user: request.user._id });
  const admins = await User.find({ role: roles.ADMIN, status: 'ACTIVE' }).select('_id').lean();
  await Promise.all(admins.map((admin) => createNotification(
    admin._id,
    'TECHNICIAN_APPLICATION',
    'Hồ sơ thợ mới',
    `${request.user.name} vừa gửi hồ sơ cần duyệt.`,
    'TechnicianProfile',
    profile._id,
  )));
  response.status(201).json({ profile, message: 'Hồ sơ đã được gửi và đang chờ quản trị viên duyệt.' });
}));

router.patch('/availability', authenticate, authorize(roles.TECHNICIAN), asyncHandler(async (request, response) => {
  const input = validate(z.object({ acceptingJobs: z.boolean() }).strict(), request.body);
  const profile = await TechnicianProfile.findOne({ user: request.user._id });
  if (!profile || profile.approvalStatus !== 'APPROVED') throw forbidden('Hồ sơ thợ chưa được phê duyệt.');
  profile.acceptingJobs = input.acceptingJobs;
  await profile.save();
  response.json({ acceptingJobs: profile.acceptingJobs });
}));

router.get('/opportunities', authenticate, authorize(roles.TECHNICIAN), asyncHandler(async (request, response) => {
  const profile = await TechnicianProfile.findOne({ user: request.user._id }).lean();
  if (!profile || profile.approvalStatus !== 'APPROVED') throw forbidden('Hồ sơ thợ chưa được phê duyệt.');
  if (!profile.acceptingJobs) return response.json({ items: [], acceptingJobs: false });
  const { limit, page } = pageQuery(request.query);
  const quotedRequestIds = await Quotation.distinct('request', { technician: request.user._id });
  const items = await RepairRequest.find({
    _id: { $nin: quotedRequestIds },
    service: { $in: profile.serviceIds },
    status: { $in: ['PENDING', 'MATCHING', 'QUOTED'] },
    desiredAt: { $gt: new Date() },
  })
    .populate('service', 'name basePrice')
    .populate('customer', 'name')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  response.json({ items, acceptingJobs: true, pagination: { page, limit } });
}));

export default router;
