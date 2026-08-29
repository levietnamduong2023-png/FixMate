import { Router } from 'express';
import { Service, TechnicianProfile, Review } from '../models/index.js';
import { asyncHandler } from '../utils/async-handler.js';
import { escapeRegex, objectIdParam, pageQuery } from '../utils/validation.js';
import { notFound } from '../utils/http-error.js';

const router = Router();
router.param('id', objectIdParam);

function publicTechnician(profile) {
  return {
    id: profile._id,
    user: profile.user,
    serviceIds: profile.serviceIds,
    experienceYears: profile.experienceYears,
    bio: profile.bio,
    area: profile.area,
    ratingAverage: profile.ratingAverage,
    ratingCount: profile.ratingCount,
  };
}

function publicReview(review) {
  return {
    id: review._id,
    customer: review.customer,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  };
}

router.get('/services', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  const search = escapeRegex(request.query.q || '');
  const filter = {
    isActive: true,
    ...(search ? { $or: [{ name: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }] } : {}),
  };
  const [items, total] = await Promise.all([
    Service.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Service.countDocuments(filter),
  ]);
  response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.get('/services/:id', asyncHandler(async (request, response) => {
  const service = await Service.findOne({ _id: request.params.id, isActive: true }).lean();
  if (!service) throw notFound('Không tìm thấy dịch vụ.');
  response.json({
    service: {
      ...service,
      scope: service.description,
      exclusions: 'Linh kiện và công việc phát sinh phải được ghi rõ trong báo giá.',
      laborWarrantyDays: 30,
    },
  });
}));

router.get('/technicians', asyncHandler(async (request, response) => {
  const { limit, page } = pageQuery(request.query);
  const filter = { approvalStatus: 'APPROVED', acceptingJobs: true };
  if (request.query.serviceId) {
    if (!/^[a-f\d]{24}$/i.test(String(request.query.serviceId))) {
      throw notFound('Dịch vụ không hợp lệ.');
    }
    filter.serviceIds = request.query.serviceId;
  }
  if (request.query.area) filter.area = new RegExp(escapeRegex(String(request.query.area).slice(0, 100)), 'i');
  const items = await TechnicianProfile.find(filter)
    .populate('user', 'name')
    .populate('serviceIds', 'name')
    .sort({ ratingAverage: -1, ratingCount: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  response.json({ items: items.map(publicTechnician), pagination: { page, limit } });
}));

router.get('/technicians/:id', asyncHandler(async (request, response) => {
  const technician = await TechnicianProfile.findOne({ user: request.params.id, approvalStatus: 'APPROVED' })
    .populate('user', 'name')
    .populate('serviceIds', 'name description')
    .lean();
  if (!technician) throw notFound('Không tìm thấy hồ sơ thợ.');
  const reviews = await Review.find({ technician: request.params.id, status: 'VISIBLE' })
    .populate('customer', 'name')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  response.json({
    technician: publicTechnician(technician),
    reviews: reviews.map(publicReview),
  });
}));

export default router;
