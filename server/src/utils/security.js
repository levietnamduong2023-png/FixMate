import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const HASH_ROUNDS = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, HASH_ROUNDS);
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId.toString() }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.tokenTtlSeconds,
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
    createdAt: user.createdAt,
  };
}

