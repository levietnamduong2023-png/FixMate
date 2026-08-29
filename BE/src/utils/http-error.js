export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message = 'Không tìm thấy dữ liệu.') {
  return new HttpError(404, 'NOT_FOUND', message);
}

export function forbidden(message = 'Bạn không có quyền thực hiện thao tác này.') {
  return new HttpError(403, 'FORBIDDEN', message);
}

export function conflict(code, message) {
  return new HttpError(409, code, message);
}

