import 'dotenv/config';

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function listFromEnv(name, fallback) {
  return (process.env[name] || fallback)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: numberFromEnv('PORT', 3000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fixmate',
  clientOrigins: listFromEnv('CLIENT_ORIGIN', 'http://localhost:5173,http://localhost:3000'),
  jwtSecret: process.env.JWT_SECRET || 'fixmate-development-secret-change-me',
  accessTokenTtlSeconds: numberFromEnv('ACCESS_TOKEN_TTL_SECONDS', numberFromEnv('TOKEN_TTL_SECONDS', 900)),
  refreshTokenTtlSeconds: numberFromEnv('REFRESH_TOKEN_TTL_SECONDS', 30 * 24 * 60 * 60),
  paymentProvider: (process.env.PAYMENT_PROVIDER || 'MOCK').toUpperCase(),
  paymentApiBaseUrl: process.env.PAYMENT_API_BASE_URL || '',
  paymentApiKey: process.env.PAYMENT_API_KEY || '',
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'fixmate-development-webhook-secret',
  emailProvider: (process.env.EMAIL_PROVIDER || 'CONSOLE').toUpperCase(),
  emailWebhookUrl: process.env.EMAIL_WEBHOOK_URL || '',
  emailApiKey: process.env.EMAIL_API_KEY || '',
  objectStorageSignerUrl: process.env.OBJECT_STORAGE_SIGNER_URL || '',
  objectStorageApiKey: process.env.OBJECT_STORAGE_API_KEY || '',
  requestLogEnabled: process.env.REQUEST_LOG_ENABLED !== 'false',
  idempotencyTtlHours: numberFromEnv('IDEMPOTENCY_TTL_HOURS', 24),
});

export function validateProductionConfig() {
  if (config.nodeEnv !== 'production') return;
  if (!process.env.JWT_SECRET || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET dài ít nhất 32 ký tự là bắt buộc trong production.');
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI là bắt buộc trong production.');
  if (config.accessTokenTtlSeconds > 900) {
    throw new Error('ACCESS_TOKEN_TTL_SECONDS không được quá 900 trong production.');
  }
  if (config.paymentProvider === 'MOCK') {
    throw new Error('PAYMENT_PROVIDER=MOCK không được phép trong production.');
  }
  if (!config.paymentApiBaseUrl || !config.paymentApiKey || !process.env.PAYMENT_WEBHOOK_SECRET) {
    throw new Error('Payment provider production cần API base URL, API key và webhook secret.');
  }
  if (config.emailProvider === 'CONSOLE' || !config.emailWebhookUrl || !config.emailApiKey) {
    throw new Error('Email provider production phải dùng adapter bên ngoài có credential.');
  }
  if (!config.objectStorageSignerUrl || !config.objectStorageApiKey) {
    throw new Error('Object storage signer production là bắt buộc.');
  }
}
