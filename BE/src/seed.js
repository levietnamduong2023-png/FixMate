import mongoose from 'mongoose';
import { config } from './config.js';
import { Service, User } from './models/index.js';
import { hashPassword } from './utils/security.js';

const services = [
  ['Điện dân dụng', 'Sửa chữa, lắp đặt và kiểm tra hệ thống điện trong nhà', 150000],
  ['Nước & đường ống', 'Xử lý rò rỉ, nghẹt ống và lắp đặt thiết bị nước', 180000],
  ['Điều hòa', 'Vệ sinh, bảo trì và sửa chữa điều hòa', 250000],
  ['Máy giặt', 'Kiểm tra và sửa chữa máy giặt tại nhà', 220000],
  ['Tủ lạnh', 'Chẩn đoán và sửa chữa tủ lạnh', 250000],
  ['Thiết bị gia dụng', 'Sửa chữa các thiết bị gia dụng phổ biến', 180000],
];

await mongoose.connect(config.mongoUri);
for (const [name, description, basePrice] of services) {
  await Service.updateOne({ name }, { $setOnInsert: { name, description, basePrice, isActive: true } }, { upsert: true });
}

const adminEmail = (process.env.ADMIN_EMAIL || 'admin@fixmate.local').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'FixMate@123';
if (config.nodeEnv === 'production' && !process.env.ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD là bắt buộc khi seed production.');
await User.updateOne(
  { email: adminEmail },
  {
    $setOnInsert: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      name: process.env.ADMIN_NAME || 'FixMate Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  },
  { upsert: true },
);

console.log(`Đã seed ${services.length} dịch vụ và tài khoản admin ${adminEmail}.`);
await mongoose.disconnect();
