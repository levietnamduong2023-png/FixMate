import mongoose from 'mongoose';
import { roles } from '../domain.js';

const { Schema, model, models } = mongoose;
const objectId = Schema.Types.ObjectId;

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
  status: { type: String, enum: ['ACTIVE', 'LOCKED'], default: 'ACTIVE', index: true },
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
  approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
  acceptingJobs: { type: Boolean, default: false, index: true },
  ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0, min: 0 },
}, baseOptions);
technicianProfileSchema.index({ serviceIds: 1, approvalStatus: 1, acceptingJobs: 1 });

const repairRequestSchema = new Schema({
  customer: { type: objectId, ref: 'User', required: true, index: true },
  service: { type: objectId, ref: 'Service', required: true, index: true },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  address: { type: String, required: true, trim: true, minlength: 5, maxlength: 300 },
  desiredAt: { type: Date, required: true, index: true },
  status: {
    type: String,
    enum: ['PENDING', 'MATCHING', 'QUOTED', 'BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  idempotencyKey: { type: String, required: true, maxlength: 100 },
}, baseOptions);
repairRequestSchema.index({ customer: 1, idempotencyKey: 1 }, { unique: true });
repairRequestSchema.index({ service: 1, status: 1, desiredAt: 1 });

const quotationSchema = new Schema({
  request: { type: objectId, ref: 'RepairRequest', required: true, index: true },
  technician: { type: objectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 10_000, max: 1_000_000_000 },
  note: { type: String, trim: true, maxlength: 1000, default: '' },
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
    enum: ['CONFIRMED', 'TECHNICIAN_ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'CONFIRMED',
    index: true,
  },
}, baseOptions);

const paymentSchema = new Schema({
  booking: { type: objectId, ref: 'Booking', required: true, unique: true },
  customer: { type: objectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 1 },
  method: { type: String, enum: ['CASH', 'MOCK_CARD'], required: true },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'PAID', 'FAILED'], default: 'PENDING' },
  idempotencyKey: { type: String, required: true, maxlength: 100 },
  paidAt: { type: Date, default: null },
}, baseOptions);
paymentSchema.index({ customer: 1, idempotencyKey: 1 }, { unique: true });

const reviewSchema = new Schema({
  booking: { type: objectId, ref: 'Booking', required: true, unique: true },
  customer: { type: objectId, ref: 'User', required: true },
  technician: { type: objectId, ref: 'User', required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['VISIBLE', 'HIDDEN'], default: 'VISIBLE', index: true },
}, baseOptions);

const complaintSchema = new Schema({
  booking: { type: objectId, ref: 'Booking', required: true, index: true },
  customer: { type: objectId, ref: 'User', required: true, index: true },
  subject: { type: String, required: true, trim: true, minlength: 5, maxlength: 150 },
  detail: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'RESOLVED', 'REJECTED'], default: 'PENDING', index: true },
  resolution: { type: String, trim: true, maxlength: 2000, default: '' },
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
}, baseOptions);
auditLogSchema.index({ actor: 1, createdAt: -1 });

export const User = models.User || model('User', userSchema);
export const Service = models.Service || model('Service', serviceSchema);
export const TechnicianProfile = models.TechnicianProfile || model('TechnicianProfile', technicianProfileSchema);
export const RepairRequest = models.RepairRequest || model('RepairRequest', repairRequestSchema);
export const Quotation = models.Quotation || model('Quotation', quotationSchema);
export const Booking = models.Booking || model('Booking', bookingSchema);
export const Payment = models.Payment || model('Payment', paymentSchema);
export const Review = models.Review || model('Review', reviewSchema);
export const Complaint = models.Complaint || model('Complaint', complaintSchema);
export const Notification = models.Notification || model('Notification', notificationSchema);
export const AuditLog = models.AuditLog || model('AuditLog', auditLogSchema);

