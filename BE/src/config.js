import 'dotenv/config';

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: numberFromEnv('PORT', 3000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fixmate',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'fixmate-development-secret-change-me',
  tokenTtlSeconds: numberFromEnv('TOKEN_TTL_SECONDS', 86_400),
});

export function validateProductionConfig() {
  if (config.nodeEnv !== 'production') return;
  if (!process.env.JWT_SECRET || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET dài ít nhất 32 ký tự là bắt buộc trong production.');
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI là bắt buộc trong production.');
}

