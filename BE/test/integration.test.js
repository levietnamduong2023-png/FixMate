import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../src/app.js';
import { OutboxEvent, Service, User } from '../src/models/index.js';
import { hashPassword } from '../src/utils/security.js';

let replicaSet;
let service;
let adminToken;

const auth = (token) => ({ Authorization: 'Bearer ' + token });

async function verifyContact(accessToken, type, recipient) {
  if (type === 'PHONE') {
    await request(app)
      .post('/api/auth/verification/request')
      .set(auth(accessToken))
      .send({ type })
      .expect(202);
  }
  const template = type === 'EMAIL' ? 'VERIFY_EMAIL' : 'VERIFY_PHONE';
  const event = await OutboxEvent.findOne({
    topic: 'EMAIL',
    'payload.template': template,
    'payload.recipient': recipient,
  }).sort({ createdAt: -1 }).lean();
  assert.ok(event?.payload?.token);
  await request(app)
    .post('/api/auth/verify')
    .send({ type, token: event.payload.token })
    .expect(200);
}

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replicaSet.getUri(), { dbName: 'fixmate_test' });
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  service = await Service.create({
    name: 'Điện dân dụng',
    description: 'Sửa chữa và kiểm tra hệ thống điện trong nhà',
    basePrice: 150000,
  });
  await User.create({
    name: 'Test Admin',
    email: 'admin@fixmate.test',
    passwordHash: await hashPassword('AdminPass123'),
    role: 'ADMIN',
  });
  const login = await request(app).post('/api/auth/login').send({ email: 'admin@fixmate.test', password: 'AdminPass123' });
  adminToken = login.body.token;
}, { timeout: 180_000 });

after(async () => {
  await mongoose.disconnect();
  if (replicaSet) await replicaSet.stop();
}, { timeout: 60_000 });

test('health endpoint exposes database readiness', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'connected');
});

test('refresh tokens rotate and reuse revokes the whole session family', async () => {
  const registration = await request(app).post('/api/auth/register').send({
    name: 'Session Test',
    email: 'session@fixmate.test',
    password: 'SessionPass123',
    acceptTerms: true,
  }).expect(201);
  const originalCookie = registration.headers['set-cookie'][0].split(';')[0];

  const refresh = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', originalCookie)
    .expect(200);
  const rotatedCookie = refresh.headers['set-cookie'][0].split(';')[0];
  assert.notEqual(rotatedCookie, originalCookie);

  const reuse = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', originalCookie)
    .expect(401);
  assert.equal(reuse.body.error.code, 'REFRESH_REUSE_DETECTED');

  await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', rotatedCookie)
    .expect(401);
  await request(app).get('/api/auth/me').set(auth(refresh.body.token)).expect(401);
});

test('complete customer-to-technician repair journey is protected and consistent', { timeout: 90_000 }, async () => {
  const customerRegistration = await request(app).post('/api/auth/register').send({
    name: 'Nguyễn Khách',
    email: 'customer@fixmate.test',
    password: 'Customer123',
    phone: '0901234567',
    acceptTerms: true,
  }).expect(201);
  const customerToken = customerRegistration.body.token;
  await verifyContact(customerToken, 'EMAIL', 'customer@fixmate.test');
  await verifyContact(customerToken, 'PHONE', '0901234567');

  const updatedProfile = await request(app)
    .patch('/api/profile')
    .set(auth(customerToken))
    .send({ name: 'Nguyễn Khách Hàng', phone: '0912345678' })
    .expect(200);
  assert.equal(updatedProfile.body.user.name, 'Nguyễn Khách Hàng');

  const homeAddressResponse = await request(app)
    .post('/api/addresses')
    .set(auth(customerToken))
    .send({
      label: 'Nhà',
      recipientName: 'Nguyễn Khách Hàng',
      phone: '0912345678',
      line1: '12 Nguyễn Huệ',
      ward: 'Bến Nghé',
      district: 'Quận 1',
      city: 'TP.HCM',
    })
    .expect(201);
  const homeAddressId = homeAddressResponse.body.address.id;
  assert.equal(homeAddressResponse.body.address.isDefault, true);

  const officeAddressResponse = await request(app)
    .post('/api/addresses')
    .set(auth(customerToken))
    .send({
      label: 'Công ty',
      recipientName: 'Nguyễn Khách Hàng',
      phone: '0912345678',
      line1: '25 Lê Lợi',
      ward: 'Bến Thành',
      district: 'Quận 1',
      city: 'TP.HCM',
      isDefault: true,
    })
    .expect(201);
  const officeAddressId = officeAddressResponse.body.address.id;
  const addressList = await request(app).get('/api/addresses').set(auth(customerToken)).expect(200);
  assert.equal(addressList.body.items.filter((item) => item.isDefault).length, 1);
  assert.equal(addressList.body.items.find((item) => item.isDefault).id, officeAddressId);
  await request(app).delete(`/api/addresses/${officeAddressId}`).set(auth(customerToken)).expect(204);
  const addressesAfterDelete = await request(app).get('/api/addresses').set(auth(customerToken)).expect(200);
  assert.equal(addressesAfterDelete.body.items.length, 1);
  assert.equal(addressesAfterDelete.body.items[0].id, homeAddressId);
  assert.equal(addressesAfterDelete.body.items[0].isDefault, true);

  await request(app).post('/api/auth/register').send({
    name: 'Nguyễn Khách',
    email: 'customer@fixmate.test',
    password: 'Customer123',
    acceptTerms: true,
  }).expect(409);

  const technicianRegistration = await request(app).post('/api/auth/register').send({
    name: 'Trần Thợ',
    email: 'technician@fixmate.test',
    password: 'Technician123',
    acceptTerms: true,
  }).expect(201);
  const technicianId = technicianRegistration.body.user.id;
  const technicianToken = technicianRegistration.body.token;
  await verifyContact(technicianToken, 'EMAIL', 'technician@fixmate.test');

  await request(app)
    .post('/api/technicians/apply')
    .set(auth(technicianToken))
    .send({
      serviceIds: [service.id],
      experienceYears: 7,
      bio: 'Thợ điện dân dụng có kinh nghiệm xử lý sự cố tại nhà.',
      area: 'Quận 1, TP.HCM',
    })
    .expect(201);

  await request(app)
    .patch(`/api/admin/technicians/${technicianId}/approval`)
    .set(auth(adminToken))
    .send({ status: 'APPROVED' })
    .expect(200);

  const desiredAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const requestPayload = {
    serviceId: service.id,
    description: 'Ổ cắm trong phòng khách phát tia lửa khi sử dụng.',
    addressId: homeAddressId,
    desiredAt,
  };
  const repairResponse = await request(app)
    .post('/api/requests')
    .set(auth(customerToken))
    .set('Idempotency-Key', 'repair-request-journey-001')
    .send(requestPayload)
    .expect(201);
  const repairId = repairResponse.body.request.id;

  const duplicate = await request(app)
    .post('/api/requests')
    .set(auth(customerToken))
    .set('Idempotency-Key', 'repair-request-journey-001')
    .send(requestPayload)
    .expect(201);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(duplicate.body.request.id, repairId);

  const idempotencyConflict = await request(app)
    .post('/api/requests')
    .set(auth(customerToken))
    .set('Idempotency-Key', 'repair-request-journey-001')
    .send({ ...requestPayload, description: 'Dữ liệu khác với cùng khóa lặp.' })
    .expect(409);
  assert.equal(idempotencyConflict.body.error.code, 'IDEMPOTENCY_KEY_REUSED');

  const opportunities = await request(app)
    .get('/api/technicians/opportunities')
    .set(auth(technicianToken))
    .expect(200);
  assert.equal(opportunities.body.items.some((item) => item._id === repairId || item.id === repairId), true);
  const opportunity = opportunities.body.items.find((item) => item._id === repairId || item.id === repairId);
  assert.equal(opportunity.address, undefined);
  assert.equal(opportunity.addressSnapshot, undefined);
  assert.equal(opportunity.customer, undefined);
  assert.equal(opportunity.coarseLocation.district, 'Quận 1');

  const quoteResponse = await request(app)
    .post(`/api/requests/${repairId}/quotes`)
    .set(auth(technicianToken))
    .send({
      amount: 320000,
      note: 'Bao gồm kiểm tra và thay ổ cắm tiêu chuẩn.',
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .expect(201);
  const quoteId = quoteResponse.body.quotation.id;

  const intruder = await request(app).post('/api/auth/register').send({
    name: 'Người Không Liên Quan',
    email: 'intruder@fixmate.test',
    password: 'Intruder123',
    acceptTerms: true,
  }).expect(201);
  await request(app).get(`/api/requests/${repairId}`).set(auth(intruder.body.token)).expect(403);
  await request(app)
    .post('/api/requests')
    .set(auth(intruder.body.token))
    .set('Idempotency-Key', 'intruder-address-attempt-001')
    .send({ ...requestPayload, description: 'Thử dùng địa chỉ không thuộc tài khoản.' })
    .expect(404);

  const quoteList = await request(app)
    .get(`/api/requests/${repairId}/quotes`)
    .set(auth(customerToken))
    .expect(200);
  assert.equal(quoteList.body.items.length, 1);

  const bookingResponse = await request(app)
    .post(`/api/requests/quotes/${quoteId}/accept`)
    .set(auth(customerToken))
    .set('Idempotency-Key', 'accept-quote-journey-001')
    .expect(201);
  const bookingId = bookingResponse.body.booking.id;

  const repeatedAcceptance = await request(app)
    .post(`/api/requests/quotes/${quoteId}/accept`)
    .set(auth(customerToken))
    .set('Idempotency-Key', 'accept-quote-journey-001')
    .expect(201);
  assert.equal(repeatedAcceptance.body.replayed, true);
  assert.equal(repeatedAcceptance.body.booking.id, bookingId);

  await request(app)
    .patch(`/api/bookings/${bookingId}/status`)
    .set(auth(technicianToken))
    .send({ status: 'COMPLETED' })
    .expect(409);

  for (const status of ['TECHNICIAN_ON_THE_WAY', 'IN_PROGRESS']) {
    await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set(auth(technicianToken))
      .send({ status })
      .expect(200);
  }
  await request(app)
    .patch(`/api/bookings/${bookingId}/status`)
    .set(auth(technicianToken))
    .send({
      status: 'AWAITING_CUSTOMER_CONFIRMATION',
      completionSummary: 'Đã thay ổ cắm và kiểm tra tải điện an toàn.',
    })
    .expect(200);
  await request(app)
    .patch(`/api/bookings/${bookingId}/status`)
    .set(auth(customerToken))
    .send({ status: 'COMPLETED' })
    .expect(200);

  const payment = await request(app)
    .post(`/api/bookings/${bookingId}/payments`)
    .set(auth(customerToken))
    .set('Idempotency-Key', 'payment-journey-001')
    .send({ method: 'MOCK_CARD' })
    .expect(201);
  assert.equal(payment.body.payment.status, 'PAID');

  const repeatedPayment = await request(app)
    .post(`/api/bookings/${bookingId}/payments`)
    .set(auth(customerToken))
    .set('Idempotency-Key', 'payment-journey-001')
    .send({ method: 'MOCK_CARD' })
    .expect(201);
  assert.equal(repeatedPayment.body.duplicate, true);

  await request(app)
    .post(`/api/bookings/${bookingId}/reviews`)
    .set(auth(customerToken))
    .send({ rating: 5, comment: 'Đến đúng giờ, sửa nhanh và giải thích rõ ràng.' })
    .expect(201);

  const publicProfile = await request(app).get(`/api/technicians/${technicianId}`).expect(200);
  assert.equal(publicProfile.body.technician.ratingAverage, 5);
  assert.equal(publicProfile.body.reviews.length, 1);
  assert.equal(publicProfile.body.technician.weeklySchedule, undefined);
  assert.equal(publicProfile.body.technician.timeOff, undefined);
  assert.equal(publicProfile.body.reviews[0].booking, undefined);

  const complaintResponse = await request(app)
    .post(`/api/bookings/${bookingId}/complaints`)
    .set(auth(customerToken))
    .send({
      subject: 'Cần làm rõ phạm vi bảo hành',
      detail: 'Tôi muốn xác nhận lại thời gian bảo hành cho linh kiện vừa thay.',
    })
    .expect(201);
  const complaintId = complaintResponse.body.complaint.id;

  await request(app)
    .patch(`/api/admin/complaints/${complaintId}`)
    .set(auth(adminToken))
    .send({ status: 'RESOLVED', resolution: 'Đã xác nhận bảo hành linh kiện trong ba tháng.' })
    .expect(200);

  const metrics = await request(app).get('/api/admin/metrics').set(auth(adminToken)).expect(200);
  assert.equal(metrics.body.bookings, 1);
  assert.equal(metrics.body.paymentsPaid, 1);

  const notifications = await request(app).get('/api/notifications').set(auth(customerToken)).expect(200);
  assert.ok(notifications.body.items.length > 0);

  const forgotResponse = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'customer@fixmate.test' })
    .expect(202);
  assert.equal(forgotResponse.body.resetToken, undefined);
  const unknownForgot = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'unknown@fixmate.test' })
    .expect(202);
  assert.equal(unknownForgot.body.message, forgotResponse.body.message);
  assert.equal(unknownForgot.body.resetToken, undefined);

  const resetEmail = await OutboxEvent.findOne({
    topic: 'EMAIL',
    'payload.template': 'RESET_PASSWORD',
    'payload.recipient': 'customer@fixmate.test',
  }).sort({ createdAt: -1 }).lean();
  assert.ok(resetEmail?.payload?.token);

  await request(app)
    .post('/api/auth/reset-password')
    .send({ token: resetEmail.payload.token, newPassword: 'CustomerReset456' })
    .expect(200);
  await request(app)
    .post('/api/auth/reset-password')
    .send({ token: resetEmail.payload.token, newPassword: 'AnotherPass789' })
    .expect(400);
  await request(app).get('/api/auth/me').set(auth(customerToken)).expect(401);
  await request(app).post('/api/auth/login').send({ email: 'customer@fixmate.test', password: 'Customer123' }).expect(401);
  const relogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'customer@fixmate.test', password: 'CustomerReset456' })
    .expect(200);

  await request(app)
    .post('/api/auth/change-password')
    .set(auth(relogin.body.token))
    .send({ currentPassword: 'CustomerReset456', newPassword: 'CustomerFinal789' })
    .expect(200);
  await request(app).get('/api/auth/me').set(auth(relogin.body.token)).expect(401);

  const finalLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'customer@fixmate.test', password: 'CustomerFinal789' })
    .expect(200);
  await request(app).post('/api/auth/logout').set(auth(finalLogin.body.token)).expect(204);
  await request(app).get('/api/auth/me').set(auth(finalLogin.body.token)).expect(401);

});
