import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const HASH_ROUNDS = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, HASH_ROUNDS);
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(userId, authVersion = 0) {
  return jwt.sign({ sub: userId.toString(), ver: authVersion }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.accessTokenTtlSeconds,
    issuer: 'fixmate-api',
    audience: 'fixmate-web',
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret, {
    algorithms: ['HS256'],
    issuer: 'fixmate-api',
    audience: 'fixmate-web',
  });
}

export function publicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
    termsVersion: user.termsVersion,
    createdAt: user.createdAt,
  };
}

export function opaqueToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function tokenHash(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function hashForLog(value = '') {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}

export function verifyHmacHex(payload, signature, secret) {
  const expected = createHmac('sha256', secret).update(payload).digest();
  let provided;
  try {
    provided = Buffer.from(String(signature || ''), 'hex');
  } catch {
    return false;
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
