import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { Notification, User } from '../models/index.js';
import { asyncHandler } from '../utils/async-handler.js';
import { notFound } from '../utils/http-error.js';
import { objectIdParam, pageQuery, validate } from '../utils/validation.js';

const router = Router();
router.param('id', objectIdParam);
router.use(authenticate);

router.get('/', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  const [items, unread] = await Promise.all([
    Notification.find({ user: request.user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ user: request.user._id, isRead: false }),
  ]);
  response.json({ items, unread, pagination: { page, limit } });
}));

router.patch('/read-all', asyncHandler(async (request, response) => {
  const result = await Notification.updateMany(
    { user: request.user._id, isRead: false },
    { isRead: true },
  );
  response.json({ updated: result.modifiedCount });
}));

router.get('/preferences', asyncHandler(async (request, response) => {
  response.json({ preferences: request.user.notificationPreferences });
}));

router.patch('/preferences', asyncHandler(async (request, response) => {
  const input = validate(z.object({
    email: z.boolean().optional(),
    marketing: z.boolean().optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'Cần ít nhất một trường cập nhật'), request.body);
  const update = Object.fromEntries(Object.entries(input).map(([key, value]) => [
    'notificationPreferences.' + key,
    value,
  ]));
  const user = await User.findByIdAndUpdate(
    request.user._id,
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  );
  response.json({ preferences: user.notificationPreferences });
}));

router.patch('/:id/read', asyncHandler(async (request, response) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: request.params.id, user: request.user._id },
    { isRead: true },
    { returnDocument: 'after' },
  );
  if (!notification) throw notFound('Không tìm thấy thông báo.');
  response.json({ notification });
}));

export default router;
