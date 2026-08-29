import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { Session, User } from '../models/index.js';
import { HttpError } from '../utils/http-error.js';
import { hashForLog, opaqueToken, signAccessToken, tokenHash } from '../utils/security.js';

export const REFRESH_COOKIE = 'fixmate_refresh';

function readCookie(request, name) {
  const cookies = String(request.headers.cookie || '').split(';');
  for (const value of cookies) {
    const separator = value.indexOf('=');
    if (separator === -1) continue;
    if (value.slice(0, separator).trim() === name) {
      return decodeURIComponent(value.slice(separator + 1).trim());
    }
  }
  return '';
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: config.refreshTokenTtlSeconds * 1000,
  };
}

function requestFingerprint(request) {
  return {
    userAgent: String(request.get('user-agent') || '').slice(0, 300),
    ipHash: hashForLog(request.ip || request.socket?.remoteAddress || ''),
  };
}

export async function createSession(user, request, response, familyId = randomUUID()) {
  const rawToken = opaqueToken();
  await Session.create({
    user: user._id,
    tokenHash: tokenHash(rawToken),
    familyId,
    expiresAt: new Date(Date.now() + config.refreshTokenTtlSeconds * 1000),
    ...requestFingerprint(request),
  });
  response.cookie(REFRESH_COOKIE, rawToken, cookieOptions());
  return signAccessToken(user._id, user.authVersion);
}

export function clearRefreshCookie(response) {
  response.clearCookie(REFRESH_COOKIE, cookieOptions());
}

export async function rotateSession(request, response) {
  const rawToken = readCookie(request, REFRESH_COOKIE);
  if (!rawToken) throw new HttpError(401, 'REFRESH_REQUIRED', 'Phiên đăng nhập không còn hợp lệ.');
  const session = await Session.findOne({ tokenHash: tokenHash(rawToken) }).select('+tokenHash');
  if (!session) throw new HttpError(401, 'REFRESH_INVALID', 'Phiên đăng nhập không còn hợp lệ.');

  if (session.revokedAt || session.expiresAt <= new Date()) {
    await Promise.all([
      Session.updateMany({ familyId: session.familyId, revokedAt: null }, { revokedAt: new Date() }),
      User.updateOne({ _id: session.user }, { $inc: { authVersion: 1 } }),
    ]);
    clearRefreshCookie(response);
    throw new HttpError(401, 'REFRESH_REUSE_DETECTED', 'Phiên đăng nhập đã bị thu hồi vì phát hiện token cũ được sử dụng lại.');
  }

  const user = await User.findById(session.user);
  if (!user || user.status !== 'ACTIVE') {
    session.revokedAt = new Date();
    await session.save();
    clearRefreshCookie(response);
    throw new HttpError(401, 'REFRESH_INVALID', 'Phiên đăng nhập không còn hợp lệ.');
  }

  session.revokedAt = new Date();
  session.lastUsedAt = new Date();
  await session.save();
  const accessToken = await createSession(user, request, response, session.familyId);
  return { user, accessToken };
}

export async function revokeSessions(userId, response) {
  await Session.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
  clearRefreshCookie(response);
}

export async function listSessions(userId) {
  return Session.find({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .select('familyId expiresAt lastUsedAt userAgent ipHash createdAt')
    .sort({ lastUsedAt: -1 })
    .lean();
}

export async function revokeSessionFamily(userId, familyId) {
  return Session.updateMany({ user: userId, familyId, revokedAt: null }, { revokedAt: new Date() });
}
