import { AuditLog, Notification } from '../models/index.js';

export function createNotification(user, type, title, message, entityType, entityId, options = {}) {
  return Notification.create([{
    user,
    type,
    title,
    message,
    entityType,
    entityId,
  }], options);
}

export function writeAudit(actor, action, entityType, entityId, detail = {}, options = {}) {
  return AuditLog.create([{ actor, action, entityType, entityId, detail }], options);
}

