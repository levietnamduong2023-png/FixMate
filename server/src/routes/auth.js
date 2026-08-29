import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { TechnicianProfile, User } from '../models/index.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
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

router.post('/register', asyncHandler(async (request, response) => {
  const input = validate(registerSchema, request.body);
  const exists = await User.exists({ email: input.email });
  if (exists) throw new HttpError(409, 'EMAIL_EXISTS', 'Email đã được sử dụng.');
  const user = await User.create({
    ...input,
    phone: input.phone || null,
    passwordHash: await hashPassword(input.password),
  });
  response.status(201).json({ user: publicUser(user), token: signAccessToken(user._id) });
}));

router.post('/login', asyncHandler(async (request, response) => {
  const input = validate(loginSchema, request.body);
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const valid = user && await comparePassword(input.password, user.passwordHash);
  if (!valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.');
  if (user.status === 'LOCKED') throw new HttpError(423, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa.');
  response.json({ user: publicUser(user), token: signAccessToken(user._id) });
}));

router.get('/me', authenticate, asyncHandler(async (request, response) => {
  const profile = await TechnicianProfile.findOne({ user: request.user._id }).lean();
  response.json({ user: publicUser(request.user), technicianProfile: profile });
}));

export default router;

