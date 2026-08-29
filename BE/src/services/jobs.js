import mongoose from 'mongoose';
import { roles } from '../domain.js';
import {
  Booking,
  BookingTimeline,
  Complaint,
  Quotation,
  RepairRequest,
  User,
} from '../models/index.js';
import { createNotification } from './notifications.js';

export async function runMaintenanceJobs() {
  await Quotation.updateMany(
    { status: 'PENDING', validUntil: { $lte: new Date() } },
    { status: 'EXPIRED' },
  );

  const dueBookings = await Booking.find({
    status: 'AWAITING_CUSTOMER_CONFIRMATION',
    'completionReport.autoCompleteAt': { $lte: new Date() },
  }).select('_id request customer technician status');
  for (const booking of dueBookings) {
    const hasOpenComplaint = await Complaint.exists({
      booking: booking._id,
      status: { $nin: ['RESOLVED', 'REJECTED'] },
    });
    if (hasOpenComplaint) continue;
    await mongoose.connection.transaction(async (session) => {
      const updated = await Booking.updateOne(
        { _id: booking._id, status: 'AWAITING_CUSTOMER_CONFIRMATION' },
        { status: 'COMPLETED', completedAt: new Date() },
        { session },
      );
      if (!updated.modifiedCount) return;
      await RepairRequest.updateOne({ _id: booking.request }, { status: 'COMPLETED' }, { session });
      await BookingTimeline.create([{
          booking: booking._id,
          actor: null,
          from: 'AWAITING_CUSTOMER_CONFIRMATION',
          to: 'COMPLETED',
          reason: 'Tự động hoàn thành sau thời hạn xác nhận.',
        }], { session });
      await createNotification(
          booking.customer,
          'BOOKING_AUTO_COMPLETED',
          'Đơn đã tự động hoàn thành',
          'Đơn được hoàn thành do đã hết thời hạn xác nhận và không có tranh chấp.',
          'Booking',
          booking._id,
          { session },
        );
    });
  }

  const overdue = await Complaint.find({
    dueAt: { $lte: new Date() },
    status: { $nin: ['RESOLVED', 'REJECTED'] },
    slaEscalatedAt: null,
  }).select('_id subject');
  if (overdue.length) {
    const admins = await User.find({ role: roles.ADMIN, status: 'ACTIVE' }).select('_id').lean();
    for (const complaint of overdue) {
      await Promise.all(admins.map((admin) => createNotification(
        admin._id,
        'COMPLAINT_SLA_BREACH',
        'Khiếu nại quá SLA',
        complaint.subject,
        'Complaint',
        complaint._id,
      )));
      complaint.slaEscalatedAt = new Date();
      await complaint.save();
    }
  }
}
