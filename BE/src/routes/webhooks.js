import { Router } from 'express';
import { z } from 'zod';
import { applyProviderEvent, verifyPaymentWebhook } from '../services/payments.js';
import { config } from '../config.js';
import { RequestMedia } from '../models/index.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { objectIdParam, validate } from '../utils/validation.js';

const router = Router();
router.param('id', objectIdParam);

router.post('/payments/:provider', asyncHandler(async (request, response) => {
  if (!verifyPaymentWebhook(
    request.rawBody || JSON.stringify(request.body),
    request.get('x-fixmate-signature'),
    request.get('x-fixmate-timestamp'),
  )) {
    throw new HttpError(401, 'WEBHOOK_SIGNATURE_INVALID', 'Webhook signature không hợp lệ.');
  }
  const event = validate(z.object({
    id: z.string().min(1).max(200),
    type: z.enum(['PAYMENT_PAID', 'PAYMENT_FAILED', 'REFUND_SUCCEEDED']),
    paymentId: z.string().optional(),
    providerPaymentId: z.string().optional(),
    refundId: z.string().optional(),
    providerRefundId: z.string().optional(),
    amount: z.number().int().positive(),
    currency: z.literal('VND'),
  }).strict().refine((value) => value.paymentId || value.providerPaymentId, {
    message: 'Cần paymentId hoặc providerPaymentId',
    path: ['paymentId'],
  }), request.body);
  const result = await applyProviderEvent(request.params.provider.toUpperCase(), event);
  response.json({ received: true, duplicate: result.duplicate });
}));

router.post('/media/:id/scan-result', asyncHandler(async (request, response) => {
  if (!config.objectStorageApiKey || request.get('x-storage-secret') !== config.objectStorageApiKey) {
    throw new HttpError(401, 'WEBHOOK_SIGNATURE_INVALID', 'Storage webhook không hợp lệ.');
  }
  const input = validate(z.object({
    clean: z.boolean(),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    size: z.number().int().min(1).max(5 * 1024 * 1024),
    exifRemoved: z.boolean(),
    message: z.string().max(500).optional().default(''),
  }).strict(), request.body);
  const media = await RequestMedia.findById(request.params.id);
  if (!media) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy media.');
  const valid = input.clean
    && input.exifRemoved
    && input.mimeType === media.mimeType
    && input.size === media.size;
  media.status = valid ? 'READY' : 'REJECTED';
  media.scanResult = input.message || (valid ? 'CLEAN_EXIF_REMOVED' : 'SCAN_REJECTED');
  await media.save();
  response.json({ received: true, status: media.status });
}));

export default router;
