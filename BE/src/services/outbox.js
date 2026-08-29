import { config } from '../config.js';
import { OutboxEvent } from '../models/index.js';

export function enqueueOutbox(topic, payload, options = {}) {
  return OutboxEvent.create([{ topic, payload }], options);
}

async function deliverEmail(payload) {
  if (config.emailProvider === 'CONSOLE') {
    if (config.nodeEnv !== 'test') {
      console.log(JSON.stringify({
        level: 'info',
        event: 'development_email',
        template: payload.template,
        recipient: payload.recipientMasked,
      }));
    }
    return;
  }
  const response = await fetch(config.emailWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.emailApiKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Email provider trả ' + response.status + '.');
}

export async function processOutboxBatch(limit = 20) {
  const events = await OutboxEvent.find({
    status: 'PENDING',
    availableAt: { $lte: new Date() },
  }).sort({ createdAt: 1 }).limit(limit);

  for (const event of events) {
    event.status = 'PROCESSING';
    await event.save();
    try {
      if (event.topic === 'EMAIL') await deliverEmail(event.payload);
      event.status = 'DELIVERED';
      event.deliveredAt = new Date();
      event.lastError = '';
    } catch (error) {
      event.attempts += 1;
      event.lastError = String(error.message || error).slice(0, 1000);
      event.status = event.attempts >= 8 ? 'DEAD' : 'PENDING';
      event.availableAt = new Date(Date.now() + Math.min(60 * 60 * 1000, 1000 * (2 ** event.attempts)));
    }
    await event.save();
  }
  return events.length;
}
