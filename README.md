# FixMate

FixMate là nền tảng MERN kết nối khách hàng với thợ sửa chữa tại nhà, được triển khai theo [SRS V0.2](docs/SRS/SRS%20V0.2%20FixMate.md) trên nền phạm vi của SRS V0.1.

## Công nghệ

- MongoDB + Mongoose: dữ liệu, index, transaction và ràng buộc nghiệp vụ.
- Express + Node.js: REST API, JWT, RBAC, rate limit, Helmet và validation Zod.
- React + Vite: giao diện responsive riêng cho Customer, Technician và Admin.
- Node Test Runner + Supertest: unit/API integration tests.

V0.3 bổ sung reset/đổi mật khẩu có thu hồi session, Customer profile, address book và address snapshot cho yêu cầu sửa chữa.

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

- [SRS V0.2](docs/SRS/SRS%20V0.2%20FixMate.md)
- [Architecture](docs/architecture/01-Architecture.md)
- [ERD](docs/ERD/02-ERD.md)
- [API specification](docs/Design/03-API.md)
- [Wireframes](docs/Design/04-Wireframes.md)
- [Access-control matrix](docs/Design/05-Access-Control-Matrix.md)
- [Đánh giá và truy vết SRS](docs/Assessment/SRS-V0.1-Assessment.md)
