import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { Payment, PaymentEvent, Refund } from '../models/index.js';
import { conflict, HttpError, notFound } from '../utils/http-error.js';
import { opaqueToken } from '../utils/security.js';

export async function createProviderPayment(payment) {
  if (config.paymentProvider === 'MOCK') {
    return {
      providerPaymentId: 'mock_' + opaqueToken(12),
      checkoutUrl: null,
    };
  }
  const response = await fetch(config.paymentApiBaseUrl.replace(/\/$/, '') + '/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.paymentApiKey,
      'Idempotency-Key': payment.idempotencyKey,
    },
    body: JSON.stringify({
      merchantReference: payment._id.toString(),
      amount: payment.amount,
      currency: payment.currency,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new HttpError(502, 'PAYMENT_PROVIDER_ERROR', 'Không thể khởi tạo thanh toán.');
  const result = await response.json();
  if (!result.id) throw new HttpError(502, 'PAYMENT_PROVIDER_INVALID', 'Payment provider trả dữ liệu không hợp lệ.');
  return { providerPaymentId: String(result.id), checkoutUrl: result.checkoutUrl || null };
}

export function verifyPaymentWebhook(rawBody, signature, timestamp) {
  const eventTime = Number(timestamp);
  if (!Number.isFinite(eventTime) || Math.abs(Date.now() - eventTime) > 5 * 60 * 1000) return false;
  const expected = createHmac('sha256', config.paymentWebhookSecret)
    .update(String(timestamp) + '.' + rawBody)
    .digest();
  let supplied;
  try {
    supplied = Buffer.from(String(signature || ''), 'hex');
  } catch {
    return false;
  }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function applyProviderEvent(provider, event) {
  if (await PaymentEvent.exists({ provider, eventId: event.id })) {
    return { duplicate: true, payment: null };
  }
  let payment;
  try {
    await mongoose.connection.transaction(async (session) => {
      await PaymentEvent.create([{
        provider,
        eventId: event.id,
        type: event.type,
        payloadHash: createHash('sha256').update(JSON.stringify(event)).digest('hex'),
      }], { session });
      payment = await Payment.findOne({
        $or: [
          { _id: mongoose.isValidObjectId(event.paymentId) ? event.paymentId : null },
          { providerPaymentId: event.providerPaymentId || null },
        ],
      }).session(session);
      if (!payment) throw notFound('Không tìm thấy payment tương ứng webhook.');
      if (payment.provider !== provider) {
        throw conflict('PAYMENT_PROVIDER_MISMATCH', 'Provider của webhook không khớp payment.');
      }
      if (event.currency !== payment.currency) {
        throw conflict('PAYMENT_EVENT_MISMATCH', 'Currency từ provider không khớp.');
      }
      if (event.type === 'PAYMENT_PAID') {
        if (Number(event.amount) !== payment.amount) {
          throw conflict('PAYMENT_EVENT_MISMATCH', 'Amount từ provider không khớp payment.');
        }
        if (payment.status !== 'PAID') {
          if (!['CREATED', 'PROCESSING'].includes(payment.status)) {
            throw conflict('PAYMENT_STATE_INVALID', 'Payment không thể chuyển sang PAID.');
          }
          payment.status = 'PAID';
          payment.paidAt = new Date();
          payment.commissionAmount = Math.round(payment.amount * payment.commissionRate);
        }
      } else if (event.type === 'PAYMENT_FAILED') {
        if (Number(event.amount) !== payment.amount) {
          throw conflict('PAYMENT_EVENT_MISMATCH', 'Amount từ provider không khớp payment.');
        }
        if (payment.status !== 'FAILED') {
          if (!['CREATED', 'PROCESSING'].includes(payment.status)) {
            throw conflict('PAYMENT_STATE_INVALID', 'Payment không thể chuyển sang FAILED.');
          }
          payment.status = 'FAILED';
        }
      } else if (event.type === 'REFUND_SUCCEEDED') {
        const refund = await Refund.findById(event.refundId).session(session);
        if (!refund || !refund.payment.equals(payment._id)) throw notFound('Không tìm thấy refund.');
        if (Number(event.amount) !== refund.amount) {
          throw conflict('PAYMENT_EVENT_MISMATCH', 'Amount từ provider không khớp refund.');
        }
        if (refund.status !== 'SUCCEEDED') {
          if (!['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
            throw conflict('PAYMENT_STATE_INVALID', 'Payment không thể nhận refund.');
          }
          refund.status = 'SUCCEEDED';
          refund.providerRefundId = event.providerRefundId || refund.providerRefundId;
          payment.refundedAmount += refund.amount;
          payment.status = payment.refundedAmount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
          payment.commissionAmount = Math.max(
            0,
            Math.round((payment.amount - payment.refundedAmount) * payment.commissionRate),
          );
          await refund.save({ session });
        }
      } else {
        throw conflict('PAYMENT_EVENT_UNSUPPORTED', 'Loại webhook không được hỗ trợ.');
      }
      await payment.save({ session });
      await PaymentEvent.updateOne(
        { provider, eventId: event.id },
        { payment: payment._id, processedAt: new Date() },
        { session },
      );
    });
  } catch (error) {
    if (error?.code === 11000) return { duplicate: true, payment: null };
    throw error;
  }
  return { duplicate: false, payment };
}

export async function createProviderRefund(refund, payment) {
  if (config.paymentProvider === 'MOCK') {
    return { providerRefundId: 'mock_ref_' + opaqueToken(10), succeeded: true };
  }
  const response = await fetch(config.paymentApiBaseUrl.replace(/\/$/, '') + '/refunds', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.paymentApiKey,
      'Idempotency-Key': refund.idempotencyKey,
    },
    body: JSON.stringify({
      paymentId: payment.providerPaymentId,
      merchantReference: refund._id.toString(),
      amount: refund.amount,
      currency: payment.currency,
      reason: refund.reason,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new HttpError(502, 'REFUND_PROVIDER_ERROR', 'Không thể gửi yêu cầu hoàn tiền.');
  const result = await response.json();
  return { providerRefundId: String(result.id), succeeded: result.status === 'SUCCEEDED' };
}
