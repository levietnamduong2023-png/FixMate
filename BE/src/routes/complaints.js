import { Router } from 'express';
import { z } from 'zod';
import { roles } from '../domain.js';
import { authenticate } from '../middleware/auth.js';
import { Booking, Complaint } from '../models/index.js';
import { asyncHandler } from '../utils/async-handler.js';
import { forbidden, notFound } from '../utils/http-error.js';
import { objectIdParam, pageQuery, validate } from '../utils/validation.js';

const router = Router();
router.param('id', objectIdParam);
router.use(authenticate);

async function complaintScope(user) {
  if (user.role === roles.ADMIN) return {};
  if (user.role === roles.CUSTOMER) return { customer: user._id };
  if (user.role === roles.TECHNICIAN) {
    const bookingIds = await Booking.distinct('_id', { technician: user._id });
    return { booking: { $in: bookingIds } };
  }
  throw forbidden();
}

router.get('/', asyncHandler(async (request, response) => {
  const { page, limit } = pageQuery(request.query);
  const filter = await complaintScope(request.user);
  if (request.query.status) {
    filter.status = validate(z.enum([
      'PENDING',
      'PROCESSING',
      'WAITING_FOR_CUSTOMER',
      'WAITING_FOR_TECHNICIAN',
      'RESOLVED',
      'REJECTED',
      'REOPENED',
    ]), request.query.status);
  }
  if (request.query.type) filter.type = validate(z.enum(['COMPLAINT', 'CANCELLATION', 'WARRANTY']), request.query.type);
  const [items, total] = await Promise.all([
    Complaint.find(filter)
      .populate('customer', 'name')
      .populate({ path: 'booking', select: 'customer technician status request' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Complaint.countDocuments(filter),
  ]);
  response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.get('/:id', asyncHandler(async (request, response) => {
  const filter = { _id: request.params.id, ...(await complaintScope(request.user)) };
  const complaint = await Complaint.findOne(filter)
    .populate('customer', 'name')
    .populate('timeline.actor', 'name role')
    .populate('booking')
    .lean();
  if (!complaint) throw notFound('Không tìm thấy khiếu nại.');
  response.json({ complaint });
}));

router.post('/:id/replies', asyncHandler(async (request, response) => {
  const input = validate(z.object({ message: z.string().trim().min(2).max(2000) }).strict(), request.body);
  const filter = { _id: request.params.id, ...(await complaintScope(request.user)) };
  const complaint = await Complaint.findOne(filter);
  if (!complaint) throw notFound('Không tìm thấy khiếu nại.');
  if (['RESOLVED', 'REJECTED'].includes(complaint.status)) {
    throw forbidden('Khiếu nại đã kết thúc.');
  }
  complaint.timeline.push({
    actor: request.user._id,
    actorRole: request.user.role,
    message: input.message,
  });
  await complaint.save();
  response.status(201).json({ complaint });
}));

export default router;
