import { Router } from 'express';
import { z } from 'zod';
import { roles } from '../domain.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { Quotation, RepairRequest, Service, TechnicianProfile, User } from '../models/index.js';
import { createNotification } from '../services/notifications.js';
import { asyncHandler } from '../utils/async-handler.js';
import { conflict, forbidden } from '../utils/http-error.js';
import { escapeRegex, objectIdSchema, pageQuery, validate } from '../utils/validation.js';

const router = Router();

const applicationSchema = z.object({
  serviceIds: z.array(objectIdSchema).min(1).max(20),
  experienceYears: z.number().int().min(0).max(60),
  bio: z.string().trim().min(20).max(1000),
  area: z.string().trim().min(2).max(150),
  serviceAreas: z.array(z.object({
    city: z.string().trim().min(2).max(100),
    district: z.string().trim().max(100).optional().default(''),
    ward: z.string().trim().max(100).optional().default(''),
  }).strict()).min(1).max(30).optional(),
}).strict();

const scheduleSchema = z.object({
  weeklySchedule: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinutes: z.number().int().min(0).max(1439),
    endMinutes: z.number().int().min(1).max(1440),
  }).strict().refine((item) => item.endMinutes > item.startMinutes, 'Giờ kết thúc phải sau giờ bắt đầu')).max(30),
  timeOff: z.array(z.object({
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    reason: z.string().trim().max(200).optional().default(''),
  }).strict().refine((item) => item.endAt > item.startAt, 'Thời gian kết thúc phải sau thời gian bắt đầu')).max(100),
}).strict();

function legacyArea(value) {
  const parts = String(value).split(',').map((item) => item.trim()).filter(Boolean);
  return [{ city: parts.at(-1) || value, district: parts.length > 1 ? parts.at(-2) : '', ward: '' }];
}

function availableAt(profile, desiredAt) {
  const date = new Date(desiredAt);
  if (profile.timeOff?.some((item) => date >= new Date(item.startAt) && date <= new Date(item.endAt))) return false;
  if (!profile.weeklySchedule?.length) return true;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const minutes = Number(value.hour) * 60 + Number(value.minute);
  return profile.weeklySchedule.some((item) => (
    item.dayOfWeek === days[value.weekday]
    && minutes >= item.startMinutes
    && minutes < item.endMinutes
  ));
}

router.post('/apply', authenticate, authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  if (!request.user.emailVerifiedAt) {
    throw conflict('EMAIL_VERIFICATION_REQUIRED', 'Cần xác minh email trước khi đăng ký làm thợ.');
  }
  const input = validate(applicationSchema, request.body);
  if (await TechnicianProfile.exists({ user: request.user._id })) {
    throw conflict('PROFILE_EXISTS', 'Bạn đã gửi hồ sơ đăng ký làm thợ.');
  }
  const uniqueServices = [...new Set(input.serviceIds)];
  const serviceCount = await Service.countDocuments({ _id: { $in: uniqueServices }, isActive: true });
  if (serviceCount !== uniqueServices.length) throw conflict('INVALID_SERVICE', 'Có dịch vụ không tồn tại hoặc đã ngừng cung cấp.');
  const profile = await TechnicianProfile.create({
    ...input,
    serviceIds: uniqueServices,
    serviceAreas: input.serviceAreas || legacyArea(input.area),
    user: request.user._id,
  });
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

router.get('/application', authenticate, asyncHandler(async (request, response) => {
  const profile = await TechnicianProfile.findOne({ user: request.user._id })
    .populate('serviceIds', 'name isActive')
    .lean();
  response.json({ profile });
}));

router.patch('/profile', authenticate, asyncHandler(async (request, response) => {
  if (![roles.CUSTOMER, roles.TECHNICIAN].includes(request.user.role)) throw forbidden();
  const input = validate(z.object({
    experienceYears: z.number().int().min(0).max(60).optional(),
    bio: z.string().trim().min(20).max(1000).optional(),
    area: z.string().trim().min(2).max(150).optional(),
    serviceAreas: applicationSchema.shape.serviceAreas,
  }).strict().refine((value) => Object.keys(value).length > 0, 'Cần ít nhất một trường cập nhật'), request.body);
  const profile = await TechnicianProfile.findOne({ user: request.user._id });
  if (!profile) throw forbidden('Bạn chưa có hồ sơ thợ.');
  Object.assign(profile, input);
  if (input.area && !input.serviceAreas) profile.serviceAreas = legacyArea(input.area);
  if (profile.approvalStatus === 'APPROVED') profile.approvalStatus = 'PENDING';
  profile.acceptingJobs = false;
  await profile.save();
  response.json({ profile, requiresApproval: true });
}));

router.patch('/skills', authenticate, asyncHandler(async (request, response) => {
  if (![roles.CUSTOMER, roles.TECHNICIAN].includes(request.user.role)) throw forbidden();
  const input = validate(z.object({ serviceIds: z.array(objectIdSchema).min(1).max(20) }).strict(), request.body);
  const uniqueServices = [...new Set(input.serviceIds)];
  const count = await Service.countDocuments({ _id: { $in: uniqueServices }, isActive: true });
  if (count !== uniqueServices.length) throw conflict('INVALID_SERVICE', 'Có dịch vụ không tồn tại hoặc đã ngừng cung cấp.');
  const profile = await TechnicianProfile.findOneAndUpdate(
    { user: request.user._id },
    { serviceIds: uniqueServices, approvalStatus: 'PENDING', acceptingJobs: false },
    { returnDocument: 'after', runValidators: true },
  );
  if (!profile) throw forbidden('Bạn chưa có hồ sơ thợ.');
  response.json({ profile, requiresApproval: true });
}));

router.put('/schedule', authenticate, authorize(roles.TECHNICIAN), asyncHandler(async (request, response) => {
  const input = validate(scheduleSchema, request.body);
  const profile = await TechnicianProfile.findOneAndUpdate(
    { user: request.user._id, approvalStatus: 'APPROVED' },
    input,
    { returnDocument: 'after', runValidators: true },
  );
  if (!profile) throw forbidden('Hồ sơ thợ chưa được phê duyệt.');
  response.json({ weeklySchedule: profile.weeklySchedule, timeOff: profile.timeOff });
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
  const serviceAreas = profile.serviceAreas?.length ? profile.serviceAreas : legacyArea(profile.area);
  const areaFilters = serviceAreas.map((item) => {
    const filter = {
      'addressSnapshot.city': new RegExp('^' + escapeRegex(item.city) + '$', 'i'),
    };
    if (item.district) filter['addressSnapshot.district'] = new RegExp('^' + escapeRegex(item.district) + '$', 'i');
    if (item.ward) filter['addressSnapshot.ward'] = new RegExp('^' + escapeRegex(item.ward) + '$', 'i');
    return filter;
  });
  const candidates = await RepairRequest.find({
    _id: { $nin: quotedRequestIds },
    service: { $in: profile.serviceIds },
    status: { $in: ['PENDING', 'MATCHING', 'QUOTED'] },
    desiredAt: { $gt: new Date() },
    $or: areaFilters,
  })
    .populate('service', 'name basePrice')
    .sort({ createdAt: -1 })
    .limit(page * limit * 2)
    .lean();
  const available = candidates.filter((item) => availableAt(profile, item.desiredAt));
  const pageItems = available.slice((page - 1) * limit, page * limit).map((item) => ({
    id: item._id,
    service: item.service,
    description: item.description,
    desiredAt: item.desiredAt,
    status: item.status,
    coarseLocation: {
      ward: item.addressSnapshot?.ward || '',
      district: item.addressSnapshot?.district || '',
      city: item.addressSnapshot?.city || '',
    },
  }));
  response.json({ items: pageItems, acceptingJobs: true, pagination: { page, limit } });
}));

export default router;
