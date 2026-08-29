# FixMate

FixMate là nền tảng MERN kết nối khách hàng với thợ sửa chữa tại nhà, được triển khai theo baseline hợp nhất [SRS V0.3](docs/SRS/SRS%20V0.3%20FixMate.md).

## Công nghệ

- MongoDB + Mongoose: dữ liệu, index, transaction và ràng buộc nghiệp vụ.
- Express + Node.js: REST API, JWT, RBAC, rate limit, Helmet và validation Zod.
- React + Vite: giao diện responsive riêng cho Customer, Technician và Admin.
- Node Test Runner + Supertest: unit/API integration tests.

V0.3 bổ sung session rotation, privacy theo scope, structured address snapshot, matching theo khu vực/lịch, completion hai bước, payment adapter/webhook/refund, outbox, observability và các UC còn thiếu.

## Chạy nhanh bằng Docker

1. Sao chép `.env.example` thành `.env` và đổi `JWT_SECRET`, `ADMIN_PASSWORD`.
2. Chạy `docker compose up --build`.
3. Mở `http://localhost:3000`.

Docker Compose khởi tạo MongoDB replica set vì các luồng nhận báo giá và duyệt hồ sơ sử dụng transaction.

## Chạy môi trường phát triển

Yêu cầu Node.js 22+ và MongoDB replica set:

```bash
npm install
npm run seed
npm run dev
```

- React: `http://localhost:5173`
- API: `http://localhost:3000/api`
- Health check: `http://localhost:3000/api/health`

Tài khoản admin phát triển mặc định sau khi seed là `admin@fixmate.local` / `FixMate@123`. Không dùng mật khẩu mặc định trong production.

## Kiểm tra chất lượng

```bash
npm test
npm run check
```

## Tài liệu

- [SRS V0.3](docs/SRS/SRS%20V0.3%20FixMate.md)
- [Architecture](docs/architecture/01-Architecture.md)
- [ERD](docs/ERD/02-ERD.md)
- [API specification](docs/Design/03-API.md)
- [Wireframes](docs/Design/04-Wireframes.md)
- [Access-control matrix](docs/Design/05-Access-Control-Matrix.md)
- [Đánh giá và truy vết SRS](docs/Assessment/SRS-V0.1-Assessment.md)
