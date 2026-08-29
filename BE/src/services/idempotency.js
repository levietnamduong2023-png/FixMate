import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { IdempotencyRecord } from '../models/index.js';
import { HttpError } from '../utils/http-error.js';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function requestHash(payload) {
  return createHash('sha256').update(JSON.stringify(stable(payload ?? null))).digest('hex');
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function runIdempotent({ owner, method, route, key, payload, execute }) {
  if (!key || key.length < 8 || key.length > 100) {
    throw new HttpError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Cần Idempotency-Key dài từ 8 đến 100 ký tự.');
  }
  const hash = requestHash(payload);
  const filter = { owner: String(owner), method, route, key };
  let record;
  try {
    record = await IdempotencyRecord.create({
      ...filter,
      requestHash: hash,
      expiresAt: new Date(Date.now() + config.idempotencyTtlHours * 60 * 60 * 1000),
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    record = await IdempotencyRecord.findOne(filter);
    if (!record) throw error;
    if (record.requestHash !== hash) {
      throw new HttpError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key đã được dùng với dữ liệu khác.');
    }
    for (let attempt = 0; record.status === 'PROCESSING' && attempt < 80; attempt += 1) {
      await wait(25);
      record = await IdempotencyRecord.findOne(filter);
    }
    if (record?.status === 'COMPLETED') {
      return { status: record.responseStatus, body: record.responseBody, replayed: true };
    }
    throw new HttpError(409, 'IDEMPOTENCY_IN_PROGRESS', 'Thao tác cùng Idempotency-Key đang được xử lý.');
  }

  try {
    const result = await execute();
    record.status = 'COMPLETED';
    record.responseStatus = result.status;
    record.responseBody = result.body;
    await record.save();
    return { ...result, replayed: false };
  } catch (error) {
    await IdempotencyRecord.deleteOne({ _id: record._id, status: 'PROCESSING' });
    throw error;
  }
}
