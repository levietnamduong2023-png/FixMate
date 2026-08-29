import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import {
  ConsentRecord,
  PasswordResetToken,
  Session,
  TechnicianProfile,
  User,
  VerificationToken,
} from '../models/index.js';
import {
  createSession,
  listSessions,
  revokeSessionFamily,
  revokeSessions,
  rotateSession,
} from '../services/sessions.js';
import { enqueueOutbox } from '../services/outbox.js';
import { asyncHandler } from '../utils/async-handler.js';
import { conflict, HttpError } from '../utils/http-error.js';
import {
  comparePassword,
  hashPassword,
  opaqueToken,
  publicUser,
  tokenHash,
} from '../utils/security.js';
import { strongPasswordSchema, validate } from '../utils/validation.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase().max(254),
  password: strongPasswordSchema,
  phone: z.string().trim().min(8).max(20).optional(),
  acceptTerms: z.literal(true),
}).strict();

const loginSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(1).max(128),
}).strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: strongPasswordSchema,
}).strict();

const forgotPasswordSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
}).strict();

const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  newPassword: strongPasswordSchema,
}).strict();

router.post('/register', asyncHandler(async (request, response) => {
  const input = validate(registerSchema, request.body);
  const exists = await User.exists({ email: input.email });
  if (exists) throw new HttpError(409, 'EMAIL_EXISTS', 'Email đã được sử dụng.');
  const verificationToken = opaqueToken();
  const passwordHash = await hashPassword(input.password);
  let user;
  await mongoose.connection.transaction(async (session) => {
    [user] = await User.create([{
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      passwordHash,
      termsVersion: '0.3',
    }], { session });
    await ConsentRecord.create([
      { user: user._id, type: 'TERMS', version: '0.3', granted: true },
      { user: user._id, type: 'PRIVACY', version: '0.3', granted: true },
    ], { session, ordered: true });
    await VerificationToken.create([{
      user: user._id,
      type: 'EMAIL',
      tokenHash: tokenHash(verificationToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }], { session });
    await enqueueOutbox('EMAIL', {
      template: 'VERIFY_EMAIL',
      recipient: user.email,
      recipientMasked: user.email.replace(/(^.).*(@.*$)/, '$1***$2'),
      token: verificationToken,
    }, { session });
  });
  const accessToken = await createSession(user, request, response);
  response.status(201).json({ user: publicUser(user), token: accessToken });
}));

router.post('/login', asyncHandler(async (request, response) => {
  const input = validate(loginSchema, request.body);
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const valid = user && await comparePassword(input.password, user.passwordHash);
  if (!valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.');
  if (user.status === 'LOCKED') throw new HttpError(423, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa.');
  const accessToken = await createSession(user, request, response);
  response.json({ user: publicUser(user), token: accessToken });
}));

router.post('/refresh', asyncHandler(async (request, response) => {
  const { user, accessToken } = await rotateSession(request, response);
  response.json({ user: publicUser(user), token: accessToken });
}));

router.get('/me', authenticate, asyncHandler(async (request, response) => {
  const profile = await TechnicianProfile.findOne({ user: request.user._id }).lean();
  response.json({ user: publicUser(request.user), technicianProfile: profile });
}));

router.post('/logout', authenticate, asyncHandler(async (request, response) => {
  await User.updateOne({ _id: request.user._id }, { $inc: { authVersion: 1 } });
  await revokeSessions(request.user._id, response);
  response.status(204).end();
}));

router.get('/sessions', authenticate, asyncHandler(async (request, response) => {
  response.json({ items: await listSessions(request.user._id) });
}));

router.delete('/sessions/:familyId', authenticate, asyncHandler(async (request, response) => {
  await revokeSessionFamily(request.user._id, request.params.familyId);
  response.status(204).end();
}));

router.post('/change-password', authenticate, asyncHandler(async (request, response) => {
  const input = validate(changePasswordSchema, request.body);
  const user = await User.findById(request.user._id).select('+passwordHash');
  if (!user || !await comparePassword(input.currentPassword, user.passwordHash)) {
    throw new HttpError(401, 'CURRENT_PASSWORD_INVALID', 'Mật khẩu hiện tại không chính xác.');
  }
  if (await comparePassword(input.newPassword, user.passwordHash)) {
    throw conflict('PASSWORD_UNCHANGED', 'Mật khẩu mới phải khác mật khẩu hiện tại.');
  }
  const passwordHash = await hashPassword(input.newPassword);
  await mongoose.connection.transaction(async (session) => {
    await User.updateOne(
      { _id: user._id },
      { $set: { passwordHash }, $inc: { authVersion: 1 } },
      { session },
    );
    await PasswordResetToken.deleteMany({ user: user._id }, { session });
    await Session.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() }, { session });
  });
  await revokeSessions(user._id, response);
  response.json({ message: 'Mật khẩu đã được đổi. Vui lòng đăng nhập lại.' });
}));

router.post('/forgot-password', asyncHandler(async (request, response) => {
  const input = validate(forgotPasswordSchema, request.body);
  const user = await User.findOne({ email: input.email, status: 'ACTIVE' });
  if (user) {
    const token = opaqueToken();
    await mongoose.connection.transaction(async (session) => {
      await PasswordResetToken.deleteMany({ user: user._id, usedAt: null }, { session });
      await PasswordResetToken.create([{
        user: user._id,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }], { session });
      await enqueueOutbox('EMAIL', {
        template: 'RESET_PASSWORD',
        recipient: user.email,
        recipientMasked: user.email.replace(/(^.).*(@.*$)/, '$1***$2'),
        token,
      }, { session });
    });
  }
  response.status(202).json({
    message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.',
  });
}));

router.post('/reset-password', asyncHandler(async (request, response) => {
  const input = validate(resetPasswordSchema, request.body);
  const resetHash = tokenHash(input.token);
  const passwordHash = await hashPassword(input.newPassword);

  await mongoose.connection.transaction(async (session) => {
    const token = await PasswordResetToken.findOne({
      tokenHash: resetHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).session(session);
    if (!token) throw new HttpError(400, 'RESET_TOKEN_INVALID', 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    const user = await User.findById(token.user).select('+passwordHash').session(session);
    if (!user || user.status !== 'ACTIVE') {
      throw new HttpError(400, 'RESET_TOKEN_INVALID', 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }
    user.passwordHash = passwordHash;
    user.authVersion += 1;
    token.usedAt = new Date();
    await user.save({ session });
    await token.save({ session });
    await PasswordResetToken.deleteMany({ user: user._id, _id: { $ne: token._id } }, { session });
    await Session.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() }, { session });
  });
  response.clearCookie('fixmate_refresh', { path: '/api/auth' });
  response.json({ message: 'Mật khẩu đã được đặt lại. Bạn có thể đăng nhập bằng mật khẩu mới.' });
}));

router.post('/verify', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    type: z.enum(['EMAIL', 'PHONE']),
    token: z.string().min(32).max(256),
  }).strict(), request.body);
  await mongoose.connection.transaction(async (session) => {
    const verification = await VerificationToken.findOne({
      type: input.type,
      tokenHash: tokenHash(input.token),
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).session(session);
    if (!verification) throw new HttpError(400, 'VERIFICATION_TOKEN_INVALID', 'Mã xác minh không hợp lệ hoặc đã hết hạn.');
    const update = input.type === 'EMAIL' ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() };
    await User.updateOne({ _id: verification.user }, update, { session });
    verification.usedAt = new Date();
    await verification.save({ session });
  });
  response.json({ message: 'Thông tin đã được xác minh.' });
}));

router.post('/verification/request', authenticate, asyncHandler(async (request, response) => {
  const input = validate(z.object({ type: z.enum(['EMAIL', 'PHONE']) }).strict(), request.body);
  if (input.type === 'PHONE' && !request.user.phone) {
    throw new HttpError(422, 'PHONE_REQUIRED', 'Cần cập nhật số điện thoại trước khi xác minh.');
  }
  const rawToken = opaqueToken();
  await mongoose.connection.transaction(async (session) => {
    await VerificationToken.deleteMany({
      user: request.user._id,
      type: input.type,
      usedAt: null,
    }, { session });
    await VerificationToken.create([{
      user: request.user._id,
      type: input.type,
      tokenHash: tokenHash(rawToken),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    }], { session });
    const recipient = input.type === 'EMAIL' ? request.user.email : request.user.phone;
    await enqueueOutbox('EMAIL', {
      template: input.type === 'EMAIL' ? 'VERIFY_EMAIL' : 'VERIFY_PHONE',
      channel: input.type === 'EMAIL' ? 'EMAIL' : 'SMS',
      recipient,
      recipientMasked: input.type === 'EMAIL'
        ? recipient.replace(/(^.).*(@.*$)/, '$1***$2')
        : recipient.slice(0, 3) + '***' + recipient.slice(-2),
      token: rawToken,
    }, { session });
  });
  response.status(202).json({ message: 'Nếu thông tin hợp lệ, mã xác minh sẽ được gửi.' });
}));

export default router;
