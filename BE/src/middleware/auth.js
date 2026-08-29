import { User } from '../models/index.js';
import { HttpError } from '../utils/http-error.js';
import { verifyAccessToken } from '../utils/security.js';

export async function authenticate(request, _response, next) {
  try {
    const header = request.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để tiếp tục.');
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không còn hợp lệ.');
    if (user.status === 'LOCKED') throw new HttpError(423, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa.');
    if (user.status !== 'ACTIVE') throw new HttpError(401, 'ACCOUNT_UNAVAILABLE', 'Tài khoản không còn hoạt động.');
    if (payload.ver !== user.authVersion) {
      throw new HttpError(401, 'SESSION_REVOKED', 'Phiên đăng nhập đã bị thu hồi.');
    }
    request.user = user;
    next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    return next(new HttpError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'));
  }
}

export function authorize(...roles) {
  return function roleGuard(request, _response, next) {
    if (!request.user || !roles.includes(request.user.role)) {
      return next(new HttpError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'));
    }
    next();
  };
}
