import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { roles } from '../domain.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  Booking,
  Address,
  Quotation,
  RepairRequest,
  Service,
  TechnicianProfile,
} from '../models/index.js';
import { createNotification } from '../services/notifications.js';
import { asyncHandler } from '../utils/async-handler.js';
import { conflict, forbidden, notFound } from '../utils/http-error.js';
import { objectIdSchema, pageQuery, validate } from '../utils/validation.js';

const router = Router();

const requestSchema = z.object({
  serviceId: objectIdSchema,
  description: z.string().trim().min(10).max(2000),
  address: z.string().trim().min(5).max(500).optional(),
  addressId: objectIdSchema.optional(),
  desiredAt: z.coerce.date().refine((date) => date > new Date(), 'Thời gian mong muốn phải nằm trong tương lai'),
}).strict().refine((value) => value.address || value.addressId, {
  message: 'Cần chọn địa chỉ đã lưu hoặc nhập địa chỉ sửa chữa.',
  path: ['address'],
});

const quoteSchema = z.object({
  amount: z.number().int().min(10_000).max(1_000_000_000),
  note: z.string().trim().max(1000).optional().default(''),
  validUntil: z.coerce.date().refine((date) => date > new Date(), 'Thời hạn báo giá phải nằm trong tương lai'),
}).strict();

router.use(authenticate);

router.post('/', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const input = validate(requestSchema, request.body);
  const idempotencyKey = request.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    throw conflict('IDEMPOTENCY_KEY_REQUIRED', 'Cần Idempotency-Key dài từ 8 đến 100 ký tự.');
  }
  const existing = await RepairRequest.findOne({ customer: request.user._id, idempotencyKey })
    .populate('service', 'name basePrice');
  if (existing) return response.json({ request: existing, duplicate: true });
  if (!await Service.exists({ _id: input.serviceId, isActive: true })) throw notFound('Dịch vụ không tồn tại hoặc đã ngừng cung cấp.');
  let address = input.address;
  let addressRef = null;
  if (input.addressId) {
    const savedAddress = await Address.findOne({ _id: input.addressId, user: request.user._id }).lean();
    if (!savedAddress) throw notFound('Không tìm thấy địa chỉ đã lưu.');
    addressRef = savedAddress._id;
    address = [savedAddress.line1, savedAddress.ward, savedAddress.district, savedAddress.city].join(', ');
  }
  const repairRequest = await RepairRequest.create({
    customer: request.user._id,
    service: input.serviceId,
    description: input.description,
    address,
    addressRef,
    desiredAt: input.desiredAt,
    idempotencyKey,
  });
  await repairRequest.populate('service', 'name basePrice');
  response.status(201).json({ request: repairRequest, duplicate: false });
}));

router.get('/', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  const filter = {};
  if (request.user.role === roles.CUSTOMER) filter.customer = request.user._id;
  else if (request.user.role === roles.TECHNICIAN) {
    const requestIds = await Quotation.distinct('request', { technician: request.user._id });
    filter._id = { $in: requestIds };
  } else if (request.user.role !== roles.ADMIN) throw forbidden();
  if (request.query.status) filter.status = request.query.status;
  const [items, total] = await Promise.all([
    RepairRequest.find(filter)
      .populate('service', 'name basePrice')
      .populate('customer', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    RepairRequest.countDocuments(filter),
  ]);
  response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.get('/:id', asyncHandler(async (request, response) => {
  const repairRequest = await RepairRequest.findById(request.params.id)
    .populate('service', 'name basePrice')
    .populate('customer', 'name')
    .lean();
  if (!repairRequest) throw notFound('Không tìm thấy yêu cầu.');
  const isOwner = repairRequest.customer._id.toString() === request.user.id;
  const hasQuote = request.user.role === roles.TECHNICIAN && await Quotation.exists({ request: repairRequest._id, technician: request.user._id });
  if (!isOwner && !hasQuote && request.user.role !== roles.ADMIN) throw forbidden('Bạn không có quyền xem yêu cầu này.');
  response.json({ request: repairRequest });
}));

router.patch('/:id/cancel', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const repairRequest = await RepairRequest.findById(request.params.id);
  if (!repairRequest) throw notFound('Không tìm thấy yêu cầu.');
  if (repairRequest.customer.toString() !== request.user.id) throw forbidden('Yêu cầu không thuộc tài khoản của bạn.');
  if (!['PENDING', 'MATCHING', 'QUOTED'].includes(repairRequest.status)) {
    throw conflict('INVALID_STATE', 'Không thể hủy yêu cầu ở trạng thái hiện tại.');
  }
  repairRequest.status = 'CANCELLED';
  await Promise.all([
    repairRequest.save(),
    Quotation.updateMany({ request: repairRequest._id, status: 'PENDING' }, { status: 'REJECTED' }),
  ]);
  response.json({ request: repairRequest });
}));

router.post('/:id/quotes', authorize(roles.TECHNICIAN), asyncHandler(async (request, response) => {
  const input = validate(quoteSchema, request.body);
  const [profile, repairRequest] = await Promise.all([
    TechnicianProfile.findOne({ user: request.user._id }),
    RepairRequest.findById(request.params.id),
  ]);
  if (!profile || profile.approvalStatus !== 'APPROVED') throw forbidden('Hồ sơ thợ chưa được phê duyệt.');
  if (!profile.acceptingJobs) throw conflict('NOT_ACCEPTING_JOBS', 'Bạn đang tắt trạng thái nhận đơn.');
  if (!repairRequest) throw notFound('Không tìm thấy yêu cầu.');
  if (!profile.serviceIds.some((id) => id.equals(repairRequest.service))) throw forbidden('Dịch vụ không thuộc chuyên môn đã đăng ký.');
  if (!['PENDING', 'MATCHING', 'QUOTED'].includes(repairRequest.status)) throw conflict('INVALID_STATE', 'Yêu cầu không còn nhận báo giá.');
  const quotation = await Quotation.create({
    request: repairRequest._id,
    technician: request.user._id,
    ...input,
  });
  repairRequest.status = 'QUOTED';
  await Promise.all([
    repairRequest.save(),
    createNotification(
      repairRequest.customer,
      'NEW_QUOTATION',
      'Có báo giá mới',
      `${request.user.name} đã gửi một báo giá mới.`,
      'RepairRequest',
      repairRequest._id,
    ),
  ]);
  response.status(201).json({ quotation });
}));

router.get('/:id/quotes', asyncHandler(async (request, response) => {
  const repairRequest = await RepairRequest.findById(request.params.id).lean();
  if (!repairRequest) throw notFound('Không tìm thấy yêu cầu.');
  const isOwner = repairRequest.customer.toString() === request.user.id;
  if (!isOwner && request.user.role !== roles.ADMIN && request.user.role !== roles.TECHNICIAN) throw forbidden();
  const filter = { request: repairRequest._id };
  if (request.user.role === roles.TECHNICIAN) filter.technician = request.user._id;
  const items = await Quotation.find(filter).populate('technician', 'name').sort({ createdAt: -1 }).lean();
  response.json({ items });
}));

router.post('/quotes/:quoteId/accept', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  let booking;
  await mongoose.connection.transaction(async (session) => {
    const quotation = await Quotation.findById(request.params.quoteId).session(session);
    if (!quotation) throw notFound('Không tìm thấy báo giá.');
    const repairRequest = await RepairRequest.findById(quotation.request).session(session);
    if (!repairRequest) throw notFound('Không tìm thấy yêu cầu.');
    if (repairRequest.customer.toString() !== request.user.id) throw forbidden('Báo giá không thuộc yêu cầu của bạn.');
    if (quotation.status !== 'PENDING' || quotation.validUntil <= new Date()) throw conflict('QUOTE_UNAVAILABLE', 'Báo giá không còn hiệu lực.');
    if (!['PENDING', 'MATCHING', 'QUOTED'].includes(repairRequest.status)) throw conflict('INVALID_STATE', 'Yêu cầu đã được xử lý.');

    repairRequest.status = 'BOOKED';
    quotation.status = 'ACCEPTED';
    [booking] = await Booking.create([{
      request: repairRequest._id,
      quotation: quotation._id,
      customer: request.user._id,
      technician: quotation.technician,
      amount: quotation.amount,
    }], { session });
    await Promise.all([
      repairRequest.save({ session }),
      quotation.save({ session }),
      Quotation.updateMany(
        { request: repairRequest._id, _id: { $ne: quotation._id }, status: 'PENDING' },
        { status: 'REJECTED' },
        { session },
      ),
      createNotification(
        quotation.technician,
        'QUOTE_ACCEPTED',
        'Báo giá được chấp nhận',
        `${request.user.name} đã chấp nhận báo giá của bạn.`,
        'Booking',
        booking._id,
        { session },
      ),
    ]);
  });
  await booking.populate([
    { path: 'technician', select: 'name' },
    { path: 'customer', select: 'name' },
    { path: 'request', populate: { path: 'service', select: 'name' } },
  ]);
  response.status(201).json({ booking });
}));

export default router;
