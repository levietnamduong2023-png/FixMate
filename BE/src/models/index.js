import mongoose from 'mongoose';
import { roles } from '../domain.js';

const { Schema, model, models } = mongoose;
const objectId = Schema.Types.ObjectId;

const serviceAreaSchema = new Schema({
  city: { type: String, required: true, trim: true, maxlength: 100 },
  district: { type: String, trim: true, maxlength: 100, default: '' },
  ward: { type: String, trim: true, maxlength: 100, default: '' },
}, { _id: false });

const addressSnapshotSchema = new Schema({
  recipientName: { type: String, trim: true, maxlength: 100, default: '' },
  phone: { type: String, trim: true, maxlength: 20, default: '' },
  line1: { type: String, trim: true, maxlength: 150, default: '' },
  ward: { type: String, trim: true, maxlength: 100, default: '' },
  district: { type: String, trim: true, maxlength: 100, default: '' },
  city: { type: String, trim: true, maxlength: 100, default: '' },
  latitude: { type: Number, min: -90, max: 90, default: null },
  longitude: { type: Number, min: -180, max: 180, default: null },
}, { _id: false });

const baseOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_document, value) => {
      value.id = value._id.toString();
      delete value._id;
      delete value.passwordHash;
      return value;
    },
  },
};

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  phone: { type: String, trim: true, maxlength: 20, default: null },
  role: { type: String, enum: Object.values(roles), default: roles.CUSTOMER, index: true },
  status: { type: String, enum: ['ACTIVE', 'LOCKED', 'DELETED'], default: 'ACTIVE', index: true },
  authVersion: { type: Number, default: 0, min: 0 },
  emailVerifiedAt: { type: Date, default: null },
  phoneVerifiedAt: { type: Date, default: null },
  termsVersion: { type: String, default: null, maxlength: 40 },
  notificationPreferences: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false },
  },
}, baseOptions);

const serviceSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  basePrice: { type: Number, required: true, min: 0, max: 1_000_000_000 },
  isActive: { type: Boolean, default: true, index: true },
}, baseOptions);

const technicianProfileSchema = new Schema({
  user: { type: objectId, ref: 'User', required: true, unique: true },
  serviceIds: [{ type: objectId, ref: 'Service', required: true }],
  experienceYears: { type: Number, required: true, min: 0, max: 60 },
  bio: { type: String, required: true, trim: true, minlength: 20, maxlength: 1000 },
  area: { type: String, required: true, trim: true, maxlength: 150, index: true },
  serviceAreas: { type: [serviceAreaSchema], default: [] },
  weeklySchedule: {
    type: [{
      dayOfWeek: { type: Number, min: 0, max: 6, required: true },
      startMinutes: { type: Number, min: 0, max: 1439, required: true },
      endMinutes: { type: Number, min: 1, max: 1440, required: true },
    }],
    default: [],
  },
  timeOff: {
    type: [{
      startAt: { type: Date, required: true },
      endAt: { type: Date, required: true },
      reason: { type: String, trim: true, maxlength: 200, default: '' },
    }],
    default: [],
  },
  approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
  acceptingJobs: { type: Boolean, default: false, index: true },
  ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0, min: 0 },
}, baseOptions);
technicianProfileSchema.index({ serviceIds: 1, approvalStatus: 1, acceptingJobs: 1 });
technicianProfileSchema.index({ 'serviceAreas.city': 1, 'serviceAreas.district': 1 });

const repairRequestSchema = new Schema({
  customer: { type: objectId, ref: 'User', required: true, index: true },
  service: { type: objectId, ref: 'Service', required: true, index: true },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  address: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
  addressRef: { type: objectId, ref: 'Address', default: null },
  addressSnapshot: { type: addressSnapshotSchema, default: () => ({}) },
  desiredAt: { type: Date, required: true, index: true },
  status: {
    type: String,
    enum: ['PENDING', 'MATCHING', 'QUOTED', 'BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  idempotencyKey: { type: String, required: true, maxlength: 100 },
  revision: { type: Number, default: 0, min: 0 },
  changeHistory: {
    type: [{
      actor: { type: objectId, ref: 'User', required: true },
      changedAt: { type: Date, default: Date.now },
      fields: { type: [String], default: [] },
    }],
    default: [],
  },
}, baseOptions);
repairRequestSchema.index({ customer: 1, idempotencyKey: 1 }, { unique: true });
repairRequestSchema.index({ service: 1, status: 1, desiredAt: 1 });

const addressSchema = new Schema({
  user: { type: objectId, ref: 'User', required: true, index: true },
  label: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
  recipientName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  phone: { type: String, required: true, trim: true, minlength: 8, maxlength: 20 },
  line1: { type: String, required: true, trim: true, minlength: 3, maxlength: 150 },
  ward: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  district: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  city: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  latitude: { type: Number, min: -90, max: 90, default: null },
  longitude: { type: Number, min: -180, max: 180, default: null },
  isDefault: { type: Boolean, default: false, index: true },
}, baseOptions);
addressSchema.index({ user: 1, createdAt: -1 });
addressSchema.index(
  { user: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);

const passwordResetTokenSchema = new Schema({
  user: { type: objectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: { type: Date, default: null },
}, baseOptions);
passwordResetTokenSchema.index({ user: 1, usedAt: 1 });

const verificationTokenSchema = new Schema({
  user: { type: objectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['EMAIL', 'PHONE'], required: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: { type: Date, default: null },
  attempts: { type: Number, min: 0, default: 0 },
}, baseOptions);
verificationTokenSchema.index({ user: 1, type: 1, usedAt: 1 });

const quotationSchema = new Schema({
  request: { type: objectId, ref: 'RepairRequest', required: true, index: true },
  technician: { type: objectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 10_000, max: 1_000_000_000 },
  note: { type: String, trim: true, maxlength: 1000, default: '' },
  laborAmount: { type: Number, min: 0, default: 0 },
  partsAmount: { type: Number, min: 0, default: 0 },
  scope: { type: String, trim: true, maxlength: 1500, default: '' },
  exclusions: { type: String, trim: true, maxlength: 1000, default: '' },
  warrantyDays: { type: Number, min: 0, max: 3650, default: 30 },
  revision: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'], default: 'PENDING', index: true },
  validUntil: { type: Date, required: true },
}, baseOptions);
quotationSchema.index({ request: 1, technician: 1 }, { unique: true });

const bookingSchema = new Schema({
  request: { type: objectId, ref: 'RepairRequest', required: true, unique: true },
  quotation: { type: objectId, ref: 'Quotation', required: true, unique: true },
  customer: { type: objectId, ref: 'User', required: true, index: true },
  technician: { type: objectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 10_000 },
  status: {
    type: String,
    enum: [
      'CONFIRMED',
      'TECHNICIAN_ON_THE_WAY',
      'IN_PROGRESS',
      'AWAITING_CUSTOMER_CONFIRMATION',
      'CANCELLATION_REVIEW',
      'DISPUTED',
      'COMPLETED',
      'CANCELLED',
    ],
    default: 'CONFIRMED',
    index: true,
  },
  policySnapshot: {
    commissionRate: { type: Number, min: 0, max: 1, default: 0.15 },
    lateCancellationRate: { type: Number, min: 0, max: 1, default: 0.2 },
    lateCancellationCap: { type: Number, min: 0, default: 200_000 },
    laborWarrantyDays: { type: Number, min: 0, default: 30 },
    completionTimeoutHours: { type: Number, min: 1, default: 24 },
    policyVersion: { type: String, default: '2026-08-29' },
  },
  cancellationDecision: {
    type: String,
    enum: ['CUSTOMER_FAULT', 'TECHNICIAN_FAULT', 'FORCE_MAJEURE', 'WAIVED'],
    default: null,
  },
  cancellationFee: { type: Number, min: 0, default: 0 },
  cancellationDecidedBy: { type: objectId, ref: 'User', default: null },
  cancellationDecidedAt: { type: Date, default: null },
  cancellationReason: { type: String, trim: true, maxlength: 1000, default: '' },
  completionReport: {
    summary: { type: String, trim: true, maxlength: 2000, default: '' },
    submittedAt: { type: Date, default: null },
    autoCompleteAt: { type: Date, default: null },
  },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
}, baseOptions);

const paymentSchema = new Schema({
  booking: { type: objectId, ref: 'Booking', required: true, index: true },
  customer: { type: objectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, enum: ['VND'], default: 'VND' },
  method: { type: String, enum: ['CASH', 'ONLINE', 'MOCK_CARD'], required: true },
  provider: { type: String, required: true, maxlength: 80, default: 'MOCK' },
  providerPaymentId: { type: String, trim: true, maxlength: 200, default: null },
  status: {
    type: String,
    enum: ['CREATED', 'PROCESSING', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED'],
    default: 'CREATED',
    index: true,
  },
  idempotencyKey: { type: String, required: true, maxlength: 100 },
  paidAt: { type: Date, default: null },
  commissionRate: { type: Number, min: 0, max: 1, default: 0.15 },
  commissionAmount: { type: Number, min: 0, default: 0 },
  refundedAmount: { type: Number, min: 0, default: 0 },
  cashTechnicianConfirmedAt: { type: Date, default: null },
  cashCustomerConfirmedAt: { type: Date, default: null },
}, baseOptions);
paymentSchema.index({ customer: 1, idempotencyKey: 1 }, { unique: true });
paymentSchema.index(
  { booking: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'PAID' } },
);

const reviewSchema = new Schema({
  booking: { type: objectId, ref: 'Booking', required: true, unique: true },
  customer: { type: objectId, ref: 'User', required: true },
  technician: { type: objectId, ref: 'User', required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['VISIBLE', 'HIDDEN'], default: 'VISIBLE', index: true },
  history: {
    type: [{
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, maxlength: 1000, default: '' },
      changedAt: { type: Date, default: Date.now },
      action: { type: String, enum: ['UPDATED', 'DELETED', 'MODERATED'], required: true },
    }],
    default: [],
  },
  deletedAt: { type: Date, default: null },
}, baseOptions);

const complaintSchema = new Schema({
  booking: { type: objectId, ref: 'Booking', required: true, index: true },
  customer: { type: objectId, ref: 'User', required: true, index: true },
  subject: { type: String, required: true, trim: true, minlength: 5, maxlength: 150 },
  detail: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
  status: {
    type: String,
    enum: [
      'PENDING',
      'PROCESSING',
      'WAITING_FOR_CUSTOMER',
      'WAITING_FOR_TECHNICIAN',
      'RESOLVED',
      'REJECTED',
      'REOPENED',
    ],
    default: 'PENDING',
    index: true,
  },
  resolution: { type: String, trim: true, maxlength: 2000, default: '' },
  type: { type: String, enum: ['COMPLAINT', 'CANCELLATION', 'WARRANTY'], default: 'COMPLAINT' },
  timeline: {
    type: [{
      actor: { type: objectId, ref: 'User', required: true },
      actorRole: { type: String, required: true },
      message: { type: String, trim: true, maxlength: 2000, required: true },
      createdAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
  dueAt: { type: Date, default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), index: true },
  slaEscalatedAt: { type: Date, default: null },
}, baseOptions);

const notificationSchema = new Schema({
  user: { type: objectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, maxlength: 80 },
  title: { type: String, required: true, maxlength: 150 },
  message: { type: String, required: true, maxlength: 500 },
  entityType: { type: String, default: null },
  entityId: { type: objectId, default: null },
  isRead: { type: Boolean, default: false, index: true },
}, baseOptions);
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const auditLogSchema = new Schema({
  actor: { type: objectId, ref: 'User', default: null },
  action: { type: String, required: true, maxlength: 100 },
  entityType: { type: String, required: true, maxlength: 80 },
  entityId: { type: objectId, required: true },
  detail: { type: Schema.Types.Mixed, default: {} },
  before: { type: Schema.Types.Mixed, default: null },
  after: { type: Schema.Types.Mixed, default: null },
  reason: { type: String, trim: true, maxlength: 1000, default: '' },
  requestId: { type: String, maxlength: 100, default: null, index: true },
  ipHash: { type: String, maxlength: 64, default: null },
}, baseOptions);
auditLogSchema.index({ actor: 1, createdAt: -1 });

const sessionSchema = new Schema({
  user: { type: objectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  familyId: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date, default: null },
  lastUsedAt: { type: Date, default: Date.now },
  userAgent: { type: String, maxlength: 300, default: '' },
  ipHash: { type: String, maxlength: 64, default: '' },
}, baseOptions);

const consentRecordSchema = new Schema({
  user: { type: objectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['TERMS', 'PRIVACY', 'LOCATION', 'MEDIA', 'MARKETING'], required: true },
  version: { type: String, required: true, maxlength: 40 },
  granted: { type: Boolean, required: true },
  recordedAt: { type: Date, default: Date.now },
}, baseOptions);
consentRecordSchema.index({ user: 1, type: 1, version: 1 }, { unique: true });

const requestMediaSchema = new Schema({
  request: { type: objectId, ref: 'RepairRequest', required: true, index: true },
  owner: { type: objectId, ref: 'User', required: true, index: true },
  objectKey: { type: String, required: true, unique: true, maxlength: 500 },
  fileName: { type: String, required: true, maxlength: 255 },
  mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
  size: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
  status: { type: String, enum: ['PENDING', 'READY', 'REJECTED'], default: 'PENDING', index: true },
  scanResult: { type: String, maxlength: 500, default: '' },
}, baseOptions);

const bookingTimelineSchema = new Schema({
  booking: { type: objectId, ref: 'Booking', required: true, index: true },
  actor: { type: objectId, ref: 'User', default: null },
  from: { type: String, default: null },
  to: { type: String, required: true },
  reason: { type: String, trim: true, maxlength: 1000, default: '' },
  requestId: { type: String, maxlength: 100, default: null },
}, baseOptions);
bookingTimelineSchema.index({ booking: 1, createdAt: 1 });

const paymentEventSchema = new Schema({
  provider: { type: String, required: true, maxlength: 80 },
  eventId: { type: String, required: true, maxlength: 200 },
  payment: { type: objectId, ref: 'Payment', default: null, index: true },
  type: { type: String, required: true, maxlength: 100 },
  payloadHash: { type: String, required: true, maxlength: 64 },
  processedAt: { type: Date, default: null },
}, baseOptions);
paymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

const refundSchema = new Schema({
  payment: { type: objectId, ref: 'Payment', required: true, index: true },
  booking: { type: objectId, ref: 'Booking', required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
  status: { type: String, enum: ['CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED'], default: 'CREATED', index: true },
  providerRefundId: { type: String, maxlength: 200, default: null },
  idempotencyKey: { type: String, required: true, maxlength: 100 },
  actor: { type: objectId, ref: 'User', required: true },
}, baseOptions);
refundSchema.index({ payment: 1, idempotencyKey: 1 }, { unique: true });

const outboxEventSchema = new Schema({
  topic: { type: String, required: true, maxlength: 100, index: true },
  payload: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'DELIVERED', 'DEAD'], default: 'PENDING', index: true },
  attempts: { type: Number, min: 0, default: 0 },
  availableAt: { type: Date, default: Date.now, index: true },
  deliveredAt: { type: Date, default: null },
  lastError: { type: String, maxlength: 1000, default: '' },
}, baseOptions);

const idempotencyRecordSchema = new Schema({
  owner: { type: String, required: true, maxlength: 100 },
  method: { type: String, required: true, maxlength: 10 },
  route: { type: String, required: true, maxlength: 200 },
  key: { type: String, required: true, maxlength: 100 },
  requestHash: { type: String, required: true, maxlength: 64 },
  status: { type: String, enum: ['PROCESSING', 'COMPLETED'], default: 'PROCESSING' },
  responseStatus: { type: Number, default: null },
  responseBody: { type: Schema.Types.Mixed, default: null },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, baseOptions);
idempotencyRecordSchema.index({ owner: 1, method: 1, route: 1, key: 1 }, { unique: true });

const policyVersionSchema = new Schema({
  code: { type: String, required: true, maxlength: 80 },
  version: { type: String, required: true, maxlength: 40 },
  values: { type: Schema.Types.Mixed, required: true },
  effectiveAt: { type: Date, required: true },
  createdBy: { type: objectId, ref: 'User', default: null },
  isActive: { type: Boolean, default: true, index: true },
}, baseOptions);
policyVersionSchema.index({ code: 1, version: 1 }, { unique: true });

export const User = models.User || model('User', userSchema);
export const Service = models.Service || model('Service', serviceSchema);
export const TechnicianProfile = models.TechnicianProfile || model('TechnicianProfile', technicianProfileSchema);
export const RepairRequest = models.RepairRequest || model('RepairRequest', repairRequestSchema);
export const Address = models.Address || model('Address', addressSchema);
export const PasswordResetToken = models.PasswordResetToken || model('PasswordResetToken', passwordResetTokenSchema);
export const VerificationToken = models.VerificationToken || model('VerificationToken', verificationTokenSchema);
export const Quotation = models.Quotation || model('Quotation', quotationSchema);
export const Booking = models.Booking || model('Booking', bookingSchema);
export const Payment = models.Payment || model('Payment', paymentSchema);
export const Review = models.Review || model('Review', reviewSchema);
export const Complaint = models.Complaint || model('Complaint', complaintSchema);
export const Notification = models.Notification || model('Notification', notificationSchema);
export const AuditLog = models.AuditLog || model('AuditLog', auditLogSchema);
export const Session = models.Session || model('Session', sessionSchema);
export const ConsentRecord = models.ConsentRecord || model('ConsentRecord', consentRecordSchema);
export const RequestMedia = models.RequestMedia || model('RequestMedia', requestMediaSchema);
export const BookingTimeline = models.BookingTimeline || model('BookingTimeline', bookingTimelineSchema);
export const PaymentEvent = models.PaymentEvent || model('PaymentEvent', paymentEventSchema);
export const Refund = models.Refund || model('Refund', refundSchema);
export const OutboxEvent = models.OutboxEvent || model('OutboxEvent', outboxEventSchema);
export const IdempotencyRecord = models.IdempotencyRecord || model('IdempotencyRecord', idempotencyRecordSchema);
export const PolicyVersion = models.PolicyVersion || model('PolicyVersion', policyVersionSchema);
