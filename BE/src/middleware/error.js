import { HttpError } from '../utils/http-error.js';

export function notFoundHandler(request, _response, next) {
  next(new HttpError(404, 'NOT_FOUND', `Không tìm thấy ${request.method} ${request.originalUrl}.`));
}

export function errorHandler(error, request, response, _next) {
  let handled = error;
  if (error?.code === 11000) {
    handled = new HttpError(409, 'CONFLICT', 'Dữ liệu đã tồn tại hoặc thao tác đã được thực hiện.');
  } else if (error?.name === 'CastError') {
    handled = new HttpError(400, 'INVALID_ID', 'Mã định danh không hợp lệ.');
  } else if (error?.name === 'ValidationError') {
    handled = new HttpError(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message,
    })));
  }

  const status = handled.status || 500;
  if (status >= 500) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'fixmate-api',
      requestId: request.id,
      code: handled.code || 'INTERNAL_ERROR',
      message: error?.message || 'Unknown error',
    }));
  }
  response.status(status).json({
    error: {
      code: handled.code || 'INTERNAL_ERROR',
      message: status >= 500 ? 'Hệ thống gặp lỗi. Vui lòng thử lại.' : handled.message,
      ...(handled.details ? { details: handled.details } : {}),
      requestId: request.id,
    },
  });
}
