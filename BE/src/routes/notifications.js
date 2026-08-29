import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { Notification } from '../models/index.js';
import { asyncHandler } from '../utils/async-handler.js';
import { notFound } from '../utils/http-error.js';
import { pageQuery } from '../utils/validation.js';

const router = Router();
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
