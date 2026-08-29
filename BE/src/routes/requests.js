import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { roles } from '../domain.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  Booking,
  Address,
  ConsentRecord,
  Quotation,
  RepairRequest,
  RequestMedia,
  Service,
  TechnicianProfile,
} from '../models/index.js';
import { runIdempotent } from '../services/idempotency.js';
import { createNotification } from '../services/notifications.js';
import { createReadUrl, createUploadUrl } from '../services/storage.js';
import { asyncHandler } from '../utils/async-handler.js';
import { conflict, forbidden, notFound } from '../utils/http-error.js';
import { objectIdParam, objectIdSchema, pageQuery, validate } from '../utils/validation.js';

const router = Router();
router.param('id', objectIdParam);
router.param('quoteId', objectIdParam);
router.param('mediaId', objectIdParam);

const requestSchema = z.object({
  serviceId: objectIdSchema,
  description: z.string().trim().min(10).max(2000),
  address: z.union([
    z.string().trim().min(5).max(500),
    z.object({
      recipientName: z.string().trim().min(2).max(100),
      phone: z.string().trim().min(8).max(20),
      line1: z.string().trim().min(3).max(150),
      ward: z.string().trim().min(2).max(100),
      district: z.string().trim().min(2).max(100),
      city: z.string().trim().min(2).max(100),
      latitude: z.number().min(-90).max(90).nullable().optional(),
      longitude: z.number().min(-180).max(180).nullable().optional(),
    }).strict(),
  ]).optional(),
  addressId: objectIdSchema.optional(),
  desiredAt: z.coerce.date().refine((date) => date > new Date(), 'Thời gian mong muốn phải nằm trong tương lai'),
}).strict().refine((value) => value.address || value.addressId, {
  message: 'Cần chọn địa chỉ đã lưu hoặc nhập địa chỉ sửa chữa.',
  path: ['address'],
});

const quoteSchema = z.object({
  amount: z.number().int().min(10_000).max(1_000_000_000),
  note: z.string().trim().max(1000).optional().default(''),
  laborAmount: z.number().int().min(0).max(1_000_000_000).optional().default(0),
  partsAmount: z.number().int().min(0).max(1_000_000_000).optional().default(0),
  scope: z.string().trim().max(1500).optional().default(''),
  exclusions: z.string().trim().max(1000).optional().default(''),
  warrantyDays: z.number().int().min(0).max(3650).optional().default(30),
  validUntil: z.coerce.date().refine((date) => date > new Date(), 'Thời hạn báo giá phải nằm trong tương lai'),
}).strict().refine(
  (value) => value.laborAmount + value.partsAmount === 0 || value.laborAmount + value.partsAmount === value.amount,
  { message: 'Tổng tiền công và linh kiện phải bằng tổng báo giá.', path: ['amount'] },
);

function snapshotFromAddress(savedAddress) {
  return {
    recipientName: savedAddress.recipientName,
    phone: savedAddress.phone,
    line1: savedAddress.line1,
    ward: savedAddress.ward,
    district: savedAddress.district,
    city: savedAddress.city,
    latitude: savedAddress.latitude ?? null,
    longitude: savedAddress.longitude ?? null,
  };
}

function legacySnapshot(value) {
  const parts = String(value).split(',').map((item) => item.trim()).filter(Boolean);
  return {
    line1: parts.slice(0, Math.max(1, parts.length - 3)).join(', '),
    ward: parts.length >= 3 ? parts.at(-3) : '',
    district: parts.length >= 2 ? parts.at(-2) : '',
    city: parts.at(-1) || '',
  };
}

function formattedAddress(snapshot) {
  return [snapshot.line1, snapshot.ward, snapshot.district, snapshot.city].filter(Boolean).join(', ');
}

function requestDto(item, includeExactAddress) {
  const value = item.toJSON ? item.toJSON() : { ...item };
  const snapshot = value.addressSnapshot || {};
  delete value.addressSnapshot;
  delete value.address;
  delete value.idempotencyKey;
  return {
    ...value,
    location: includeExactAddress ? {
      ...snapshot,
      formatted: formattedAddress(snapshot),
    } : {
      ward: snapshot.ward || '',
      district: snapshot.district || '',
      city: snapshot.city || '',
    },
  };
}

router.use(authenticate);

router.post('/', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const input = validate(requestSchema, request.body);
  const idempotencyKey = request.get('idempotency-key');
  const result = await runIdempotent({
    owner: request.user.id,
    method: 'POST',
    route: '/api/requests',
    key: idempotencyKey,
    payload: input,
    execute: async () => {
      if (!await Service.exists({ _id: input.serviceId, isActive: true })) throw notFound('Dịch vụ không tồn tại hoặc đã ngừng cung cấp.');
      let snapshot;
      let addressRef = null;
      if (input.addressId) {
        const savedAddress = await Address.findOne({ _id: input.addressId, user: request.user._id }).lean();
        if (!savedAddress) throw notFound('Không tìm thấy địa chỉ đã lưu.');
        addressRef = savedAddress._id;
        snapshot = snapshotFromAddress(savedAddress);
      } else {
        snapshot = typeof input.address === 'string' ? legacySnapshot(input.address) : input.address;
      }
      const repairRequest = await RepairRequest.create({
        customer: request.user._id,
        service: input.serviceId,
        description: input.description,
        address: formattedAddress(snapshot),
        addressSnapshot: snapshot,
        addressRef,
        desiredAt: input.desiredAt,
        idempotencyKey,
      });
      await repairRequest.populate('service', 'name basePrice');
      return {
        status: 201,
        body: { request: requestDto(repairRequest, true), duplicate: false },
      };
    },
  });
  const body = { ...result.body, duplicate: result.replayed };
  response.status(result.status).json(body);
}));

router.get('/', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  const filter = {};
  if (request.user.role === roles.CUSTOMER) filter.customer = request.user._id;
  else if (request.user.role === roles.TECHNICIAN) {
    const requestIds = await Quotation.distinct('request', { technician: request.user._id });
    filter._id = { $in: requestIds };
  } else if (request.user.role !== roles.ADMIN) throw forbidden();
  if (request.query.status) {
    filter.status = validate(z.enum(['PENDING', 'MATCHING', 'QUOTED', 'BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']), request.query.status);
  }
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
  const includeExactAddress = request.user.role !== roles.TECHNICIAN;
  response.json({
    items: items.map((item) => requestDto(item, includeExactAddress)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}));

router.post('/:id/media/upload-url', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const input = validate(z.object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    size: z.number().int().min(1).max(5 * 1024 * 1024),
  }).strict(), request.body);
  const repairRequest = await RepairRequest.findOne({
    _id: request.params.id,
    customer: request.user._id,
    status: { $in: ['PENDING', 'MATCHING'] },
  });
  if (!repairRequest) throw notFound('Không tìm thấy yêu cầu có thể thêm media.');
  const consent = await ConsentRecord.exists({
    user: request.user._id,
    type: 'MEDIA',
    granted: true,
  });
  if (!consent) throw conflict('MEDIA_CONSENT_REQUIRED', 'Cần đồng ý xử lý media trước khi tải ảnh.');
  if (await RequestMedia.countDocuments({ request: repairRequest._id, status: { $ne: 'REJECTED' } }) >= 5) {
    throw conflict('MEDIA_LIMIT_REACHED', 'Mỗi yêu cầu tối đa 5 ảnh.');
  }
  const signed = await createUploadUrl({
    objectKey: 'requests/' + repairRequest.id + '/' + Date.now() + '-' + input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_'),
    contentType: input.mimeType,
    size: input.size,
  });
  const media = await RequestMedia.create({
    request: repairRequest._id,
    owner: request.user._id,
    objectKey: signed.objectKey,
    ...input,
  });
  response.status(201).json({
    media,
    upload: { url: signed.url, expiresIn: signed.expiresIn, developmentOnly: signed.developmentOnly || false },
  });
}));

router.get('/:id/media', asyncHandler(async (request, response) => {
  const repairRequest = await RepairRequest.findById(request.params.id).lean();
  if (!repairRequest) throw notFound('Không tìm thấy yêu cầu.');
  const isOwner = repairRequest.customer.toString() === request.user.id;
  const isQuoted = request.user.role === roles.TECHNICIAN
    && await Quotation.exists({ request: repairRequest._id, technician: request.user._id });
  const isAssigned = request.user.role === roles.TECHNICIAN
    && await Booking.exists({ request: repairRequest._id, technician: request.user._id });
  if (!isOwner && !isQuoted && !isAssigned && request.user.role !== roles.ADMIN) throw forbidden();
  const media = await RequestMedia.find({
    request: repairRequest._id,
    ...(isOwner || request.user.role === roles.ADMIN ? {} : { status: 'READY' }),
  }).sort({ createdAt: 1 }).lean();
  const items = await Promise.all(media.map(async (item) => ({
    ...item,
    ...(item.status === 'READY' ? { read: await createReadUrl(item.objectKey) } : {}),
  })));
  response.json({ items });
}));

router.delete('/:id/media/:mediaId', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const repairRequest = await RepairRequest.findOne({
    _id: request.params.id,
    customer: request.user._id,
    status: { $in: ['PENDING', 'MATCHING'] },
  });
  if (!repairRequest) throw notFound('Không tìm thấy yêu cầu có thể sửa media.');
  const media = await RequestMedia.findOneAndDelete({
    _id: request.params.mediaId,
    request: repairRequest._id,
    owner: request.user._id,
  });
  if (!media) throw notFound('Không tìm thấy media.');
  response.status(204).end();
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
  const assigned = request.user.role === roles.TECHNICIAN
    && await Booking.exists({ request: repairRequest._id, technician: request.user._id });
  response.json({ request: requestDto(repairRequest, isOwner || assigned || request.user.role === roles.ADMIN) });
}));

router.patch('/:id', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const input = validate(z.object({
    description: z.string().trim().min(10).max(2000).optional(),
    addressId: objectIdSchema.optional(),
    address: requestSchema.shape.address,
    desiredAt: z.coerce.date().refine((date) => date > new Date(), 'Thời gian mong muốn phải nằm trong tương lai').optional(),
    revision: z.number().int().min(0),
  }).strict().refine((value) => Object.keys(value).some((key) => key !== 'revision'), 'Cần ít nhất một trường cập nhật'), request.body);
  const repairRequest = await RepairRequest.findOne({
    _id: request.params.id,
    customer: request.user._id,
    status: { $in: ['PENDING', 'MATCHING'] },
    revision: input.revision,
  });
  if (!repairRequest) throw conflict('REQUEST_NOT_EDITABLE', 'Yêu cầu không còn được sửa hoặc vừa được cập nhật.');
  if (await Quotation.exists({ request: repairRequest._id })) throw conflict('REQUEST_HAS_QUOTES', 'Không thể sửa yêu cầu đã có báo giá.');
  const changedFields = [];
  for (const field of ['description', 'desiredAt']) {
    if (input[field] !== undefined) {
      repairRequest[field] = input[field];
      changedFields.push(field);
    }
  }
  if (input.addressId || input.address) {
    let snapshot;
    if (input.addressId) {
      const saved = await Address.findOne({ _id: input.addressId, user: request.user._id }).lean();
      if (!saved) throw notFound('Không tìm thấy địa chỉ đã lưu.');
      snapshot = snapshotFromAddress(saved);
      repairRequest.addressRef = saved._id;
    } else {
      snapshot = typeof input.address === 'string' ? legacySnapshot(input.address) : input.address;
      repairRequest.addressRef = null;
    }
    repairRequest.addressSnapshot = snapshot;
    repairRequest.address = formattedAddress(snapshot);
    changedFields.push('address');
  }
  repairRequest.revision += 1;
  repairRequest.changeHistory.push({ actor: request.user._id, fields: changedFields });
  await repairRequest.save();
  response.json({ request: requestDto(repairRequest, true) });
}));

router.patch('/:id/cancel', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const repairRequest = await RepairRequest.findById(request.params.id);
  if (!repairRequest) throw notFound('Không tìm thấy yêu cầu.');
  if (repairRequest.customer.toString() !== request.user.id) throw forbidden('Yêu cầu không thuộc tài khoản của bạn.');
  if (!['PENDING', 'MATCHING', 'QUOTED'].includes(repairRequest.status)) {
    throw conflict('INVALID_STATE', 'Không thể hủy yêu cầu ở trạng thái hiện tại.');
  }
  await mongoose.connection.transaction(async (session) => {
    repairRequest.status = 'CANCELLED';
    await repairRequest.save({ session });
    await Quotation.updateMany(
      { request: repairRequest._id, status: 'PENDING' },
      { status: 'REJECTED' },
      { session },
    );
  });
  response.json({ request: requestDto(repairRequest, true) });
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
  let quotation;
  await mongoose.connection.transaction(async (session) => {
    [quotation] = await Quotation.create([{
      request: repairRequest._id,
      technician: request.user._id,
      ...input,
    }], { session });
    repairRequest.status = 'QUOTED';
    await repairRequest.save({ session });
    await createNotification(
        repairRequest.customer,
        'NEW_QUOTATION',
        'Có báo giá mới',
        request.user.name + ' đã gửi một báo giá mới.',
        'RepairRequest',
        repairRequest._id,
        { session },
      );
  });
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

router.patch('/quotes/:quoteId', authorize(roles.TECHNICIAN), asyncHandler(async (request, response) => {
  const input = validate(quoteSchema, request.body);
  const quotation = await Quotation.findOne({
    _id: request.params.quoteId,
    technician: request.user._id,
    status: 'PENDING',
    validUntil: { $gt: new Date() },
  });
  if (!quotation) throw notFound('Không tìm thấy báo giá còn hiệu lực.');
  Object.assign(quotation, input);
  const laborAmount = input.laborAmount ?? quotation.laborAmount;
  const partsAmount = input.partsAmount ?? quotation.partsAmount;
  const amount = input.amount ?? quotation.amount;
  if (laborAmount + partsAmount !== 0 && laborAmount + partsAmount !== amount) {
    throw conflict('QUOTE_BREAKDOWN_INVALID', 'Tổng tiền công và linh kiện phải bằng tổng báo giá.');
  }
  quotation.revision += 1;
  await quotation.save();
  response.json({ quotation });
}));

router.patch('/quotes/:quoteId/reject', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  const quotation = await Quotation.findById(request.params.quoteId);
  if (!quotation) throw notFound('Không tìm thấy báo giá.');
  const repairRequest = await RepairRequest.findOne({ _id: quotation.request, customer: request.user._id });
  if (!repairRequest) throw forbidden('Báo giá không thuộc yêu cầu của bạn.');
  if (quotation.status !== 'PENDING') throw conflict('QUOTE_UNAVAILABLE', 'Báo giá không còn ở trạng thái chờ.');
  quotation.status = 'REJECTED';
  await Promise.all([
    quotation.save(),
    createNotification(
      quotation.technician,
      'QUOTE_REJECTED',
      'Báo giá chưa được chọn',
      'Khách hàng đã từ chối báo giá.',
      'Quotation',
      quotation._id,
    ),
  ]);
  response.json({ quotation });
}));

router.post('/quotes/:quoteId/accept', authorize(roles.CUSTOMER), asyncHandler(async (request, response) => {
  if (!request.user.phoneVerifiedAt) {
    throw conflict('PHONE_VERIFICATION_REQUIRED', 'Cần xác minh số điện thoại trước khi tạo booking.');
  }
  const result = await runIdempotent({
    owner: request.user.id,
    method: 'POST',
    route: '/api/requests/quotes/:quoteId/accept',
    key: request.get('idempotency-key'),
    payload: { quoteId: request.params.quoteId },
    execute: async () => {
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
          policySnapshot: { laborWarrantyDays: quotation.warrantyDays },
        }], { session });
        await repairRequest.save({ session });
        await quotation.save({ session });
        await Quotation.updateMany(
            { request: repairRequest._id, _id: { $ne: quotation._id }, status: 'PENDING' },
            { status: 'REJECTED' },
            { session },
          );
        await createNotification(
            quotation.technician,
            'QUOTE_ACCEPTED',
            'Báo giá được chấp nhận',
            request.user.name + ' đã chấp nhận báo giá của bạn.',
            'Booking',
            booking._id,
            { session },
          );
      });
      await booking.populate([
        { path: 'technician', select: 'name' },
        { path: 'customer', select: 'name' },
        { path: 'request', populate: { path: 'service', select: 'name' } },
      ]);
      return { status: 201, body: { booking: booking.toJSON() } };
    },
  });
  response.status(result.status).json({ ...result.body, replayed: result.replayed });
}));

export default router;
