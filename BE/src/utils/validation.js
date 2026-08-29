import { z } from 'zod';
import { HttpError } from './http-error.js';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'ID không hợp lệ');
export const strongPasswordSchema = z.string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(128, 'Mật khẩu không được quá 128 ký tự')
  .regex(/[a-z]/, 'Mật khẩu phải có chữ thường')
  .regex(/[A-Z]/, 'Mật khẩu phải có chữ hoa')
  .regex(/\d/, 'Mật khẩu phải có chữ số');

export function validate(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new HttpError(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  })));
}

export function pageQuery(query) {
  return {
    limit: Math.min(Math.max(Number(query.limit) || 20, 1), 100),
    page: Math.max(Number(query.page) || 1, 1),
  };
}

export function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
