import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import { PasswordResetToken, TechnicianProfile, User } from '../models/index.js';
import { asyncHandler } from '../utils/async-handler.js';
import { conflict, HttpError } from '../utils/http-error.js';
import { comparePassword, hashPassword, publicUser, signAccessToken } from '../utils/security.js';
import { strongPasswordSchema, validate } from '../utils/validation.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase().max(254),
  password: strongPasswordSchema,
  phone: z.string().trim().min(8).max(20).optional(),
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

const resetTokenHash = (token) => createHash('sha256').update(token).digest('hex');

router.post('/register', asyncHandler(async (request, response) => {
  const input = validate(registerSchema, request.body);
  const exists = await User.exists({ email: input.email });
  if (exists) throw new HttpError(409, 'EMAIL_EXISTS', 'Email đã được sử dụng.');
  const user = await User.create({
    ...input,
    phone: input.phone || null,
    passwordHash: await hashPassword(input.password),
  });
  response.status(201).json({ user: publicUser(user), token: signAccessToken(user._id, user.authVersion) });
}));

router.post('/login', asyncHandler(async (request, response) => {
  const input = validate(loginSchema, request.body);
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const valid = user && await comparePassword(input.password, user.passwordHash);
  if (!valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.');
  if (user.status === 'LOCKED') throw new HttpError(423, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa.');
  response.json({ user: publicUser(user), token: signAccessToken(user._id, user.authVersion) });
}));

router.get('/me', authenticate, asyncHandler(async (request, response) => {
  const profile = await TechnicianProfile.findOne({ user: request.user._id }).lean();
  response.json({ user: publicUser(request.user), technicianProfile: profile });
}));

router.post('/logout', authenticate, asyncHandler(async (request, response) => {
  await User.updateOne({ _id: request.user._id }, { $inc: { authVersion: 1 } });
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
  user.passwordHash = await hashPassword(input.newPassword);
  user.authVersion += 1;
  await Promise.all([
    user.save(),
    PasswordResetToken.deleteMany({ user: user._id }),
  ]);
  response.json({ message: 'Mật khẩu đã được đổi. Vui lòng đăng nhập lại.' });
}));

router.post('/forgot-password', asyncHandler(async (request, response) => {
  const input = validate(forgotPasswordSchema, request.body);
  const user = await User.findOne({ email: input.email, status: 'ACTIVE' });
  let exposedResetToken;
  if (user) {
    const token = randomBytes(32).toString('base64url');
    await PasswordResetToken.deleteMany({ user: user._id, usedAt: null });
    await PasswordResetToken.create({
      user: user._id,
      tokenHash: resetTokenHash(token),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    if (config.nodeEnv !== 'production' || process.env.EXPOSE_RESET_TOKEN === 'true') {
      exposedResetToken = token;
    }
  }
  response.status(202).json({
    message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.',
    ...(exposedResetToken ? { resetToken: exposedResetToken } : {}),
  });
}));

router.post('/reset-password', asyncHandler(async (request, response) => {
  const input = validate(resetPasswordSchema, request.body);
  const tokenHash = resetTokenHash(input.token);
  const passwordHash = await hashPassword(input.newPassword);

  await mongoose.connection.transaction(async (session) => {
    const token = await PasswordResetToken.findOne({
      tokenHash,
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
    await Promise.all([
      user.save({ session }),
      token.save({ session }),
      PasswordResetToken.deleteMany({ user: user._id, _id: { $ne: token._id } }, { session }),
    ]);
  });
  response.json({ message: 'Mật khẩu đã được đặt lại. Bạn có thể đăng nhập bằng mật khẩu mới.' });
}));

export default router;
