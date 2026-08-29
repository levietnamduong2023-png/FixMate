import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import {
  Address,
  Booking,
  Complaint,
  ConsentRecord,
  RepairRequest,
  Review,
  Session,
  User,
} from '../models/index.js';
import { asyncHandler } from '../utils/async-handler.js';
import { conflict, HttpError, notFound } from '../utils/http-error.js';
import { comparePassword, publicUser } from '../utils/security.js';
import { objectIdParam, validate } from '../utils/validation.js';

export const profileRouter = Router();
export const addressRouter = Router();
addressRouter.param('id', objectIdParam);

const createAddressSchema = z.object({
  label: z.string().trim().min(2).max(50),
  recipientName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(20),
  line1: z.string().trim().min(3).max(150),
  ward: z.string().trim().min(2).max(100),
  district: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isDefault: z.boolean().optional().default(false),
}).strict();

const updateAddressSchema = createAddressSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Cần ít nhất một trường cập nhật',
);

profileRouter.use(authenticate);
profileRouter.get('/', asyncHandler(async (request, response) => {
  response.json({ user: publicUser(request.user) });
}));

profileRouter.patch('/', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.union([z.string().trim().min(8).max(20), z.literal('')]).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'Cần ít nhất một trường cập nhật'), request.body);
  const update = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
  };
  const user = await User.findByIdAndUpdate(
    request.user._id,
    update,
    { returnDocument: 'after', runValidators: true },
  );
  response.json({ user: publicUser(user) });
}));

profileRouter.get('/consents', asyncHandler(async (request, response) => {
  const items = await ConsentRecord.find({ user: request.user._id }).sort({ recordedAt: -1 }).lean();
  response.json({ items });
}));

profileRouter.put('/consents/:type', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    granted: z.boolean(),
    version: z.string().trim().min(1).max(40).default('0.3'),
  }).strict(), request.body);
  const type = validate(z.enum(['LOCATION', 'MEDIA', 'MARKETING']), request.params.type);
  const consent = await ConsentRecord.findOneAndUpdate(
    { user: request.user._id, type, version: input.version },
    { granted: input.granted, recordedAt: new Date() },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  response.json({ consent });
}));

profileRouter.get('/export', asyncHandler(async (request, response) => {
  const [addresses, requests, bookings, reviews, complaints, consents] = await Promise.all([
    Address.find({ user: request.user._id }).lean(),
    RepairRequest.find({ customer: request.user._id }).lean(),
    Booking.find({ $or: [{ customer: request.user._id }, { technician: request.user._id }] }).lean(),
    Review.find({ customer: request.user._id }).lean(),
    Complaint.find({ customer: request.user._id }).lean(),
    ConsentRecord.find({ user: request.user._id }).lean(),
  ]);
  response.json({
    exportedAt: new Date().toISOString(),
    profile: publicUser(request.user),
    addresses,
    requests,
    bookings,
    reviews,
    complaints,
    consents,
  });
}));

profileRouter.delete('/', asyncHandler(async (request, response) => {
  const input = validate(z.object({ currentPassword: z.string().min(1).max(128) }).strict(), request.body);
  const user = await User.findById(request.user._id).select('+passwordHash');
  if (!user || !await comparePassword(input.currentPassword, user.passwordHash)) {
    throw new HttpError(401, 'CURRENT_PASSWORD_INVALID', 'Mật khẩu hiện tại không chính xác.');
  }
  await mongoose.connection.transaction(async (session) => {
    await User.updateOne(
        { _id: user._id },
        {
          $set: {
            name: 'Tài khoản đã xóa',
            email: 'deleted+' + user._id.toString() + '@fixmate.invalid',
            phone: null,
            status: 'DELETED',
            role: 'CUSTOMER',
          },
          $inc: { authVersion: 1 },
        },
        { session },
      );
    await Address.deleteMany({ user: user._id }, { session });
    await Session.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() }, { session });
  });
  response.clearCookie('fixmate_refresh', { path: '/api/auth' });
  response.status(204).end();
}));

addressRouter.use(authenticate);
addressRouter.get('/', asyncHandler(async (request, response) => {
  const items = await Address.find({ user: request.user._id }).sort({ isDefault: -1, createdAt: -1 });
  response.json({ items });
}));

addressRouter.post('/', asyncHandler(async (request, response) => {
  const input = validate(createAddressSchema, request.body);
  let address;
  await mongoose.connection.transaction(async (session) => {
    const hasAddress = await Address.exists({ user: request.user._id }).session(session);
    const makeDefault = input.isDefault || !hasAddress;
    if (makeDefault) {
      await Address.updateMany({ user: request.user._id }, { isDefault: false }, { session });
    }
    [address] = await Address.create([{
      ...input,
      isDefault: makeDefault,
      user: request.user._id,
    }], { session });
  });
  response.status(201).json({ address });
}));

addressRouter.patch('/:id', asyncHandler(async (request, response) => {
  const input = validate(updateAddressSchema, request.body);
  const current = await Address.findOne({ _id: request.params.id, user: request.user._id });
  if (!current) throw notFound('Không tìm thấy địa chỉ.');
  if (current.isDefault && input.isDefault === false) {
    throw conflict('DEFAULT_ADDRESS_REQUIRED', 'Hãy đặt một địa chỉ khác làm mặc định trước.');
  }
  let address;
  await mongoose.connection.transaction(async (session) => {
    if (input.isDefault === true) {
      await Address.updateMany(
        { user: request.user._id, _id: { $ne: current._id } },
        { isDefault: false },
        { session },
      );
    }
    Object.assign(current, input);
    address = await current.save({ session });
  });
  response.json({ address });
}));

addressRouter.delete('/:id', asyncHandler(async (request, response) => {
  await mongoose.connection.transaction(async (session) => {
    const address = await Address.findOneAndDelete(
      { _id: request.params.id, user: request.user._id },
      { session },
    );
    if (!address) throw notFound('Không tìm thấy địa chỉ.');
    if (address.isDefault) {
      const next = await Address.findOne({ user: request.user._id }).sort({ createdAt: -1 }).session(session);
      if (next) {
        next.isDefault = true;
        await next.save({ session });
      }
    }
  });
  response.status(204).end();
}));
