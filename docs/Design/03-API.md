# REST API FixMate V0.2

## 1. Quy ước

- Base URL: `/api`.
- Request/response dùng JSON UTF-8.
- Route bảo vệ nhận `Authorization: Bearer <JWT>`.
- Tạo RepairRequest và Payment bắt buộc `Idempotency-Key` dài 8–100 ký tự.
- Phân trang dùng `page` và `limit`; `limit` tối đa 100.
- Giá trị tiền là số nguyên VND.

Response lỗi chuẩn:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ.",
    "details": [{ "field": "email", "message": "Invalid email address" }]
  }
}
```

## 2. Endpoint catalog

### Public và authentication

| Method | Endpoint | Role | Mô tả |
|---|---|---|---|
| GET | `/health` | Public | Health và trạng thái MongoDB |
| POST | `/auth/register` | Public | Đăng ký Customer |
| POST | `/auth/login` | Public | Đăng nhập, nhận JWT |
| GET | `/auth/me` | Authenticated | User và hồ sơ thợ hiện tại |
| POST | `/auth/logout` | Authenticated | Thu hồi toàn bộ token hiện tại của account |
| POST | `/auth/change-password` | Authenticated | Đổi mật khẩu và thu hồi session cũ |
| POST | `/auth/forgot-password` | Public | Tạo reset token 15 phút, response chống enumeration |
| POST | `/auth/reset-password` | Public | Dùng token một lần để đặt mật khẩu mới |
| GET | `/services?q=` | Public | Danh sách/tìm dịch vụ đang hoạt động |
| GET | `/technicians?serviceId=&area=` | Public | Tìm thợ đã duyệt và đang nhận đơn |
| GET | `/technicians/:id` | Public | Hồ sơ và đánh giá công khai |

### Technician profile

| Method | Endpoint | Role | Mô tả |
|---|---|---|---|
| POST | `/technicians/apply` | Customer | Gửi hồ sơ thợ |
| PATCH | `/technicians/availability` | Technician | Bật/tắt nhận đơn |
| GET | `/technicians/opportunities` | Technician | Yêu cầu khớp chuyên môn |

### Customer profile và address book

| Method | Endpoint | Role | Mô tả |
|---|---|---|---|
| GET | `/profile` | Authenticated | Xem hồ sơ account hiện tại |
| PATCH | `/profile` | Authenticated | Cập nhật tên và số điện thoại |
| GET | `/addresses` | Authenticated owner | Danh sách địa chỉ của account |
| POST | `/addresses` | Authenticated owner | Tạo địa chỉ; địa chỉ đầu tiên tự mặc định |
| PATCH | `/addresses/:id` | Address owner | Cập nhật hoặc đặt mặc định |
| DELETE | `/addresses/:id` | Address owner | Xóa; tự chọn mặc định mới khi cần |

### Repair request và quotation

| Method | Endpoint | Role | Mô tả |
|---|---|---|---|
| POST | `/requests` | Customer | Tạo yêu cầu, chống lặp |
| GET | `/requests` | Customer/Technician/Admin | Danh sách theo scope |
| GET | `/requests/:id` | Owner/quoted tech/Admin | Chi tiết yêu cầu |
| PATCH | `/requests/:id/cancel` | Customer owner | Hủy yêu cầu trước booking |
| POST | `/requests/:id/quotes` | Approved Technician | Gửi báo giá |
| GET | `/requests/:id/quotes` | Owner/Technician/Admin | Xem báo giá theo scope |
| POST | `/requests/quotes/:quoteId/accept` | Customer owner | Transaction chọn báo giá và tạo booking |

### Booking, payment, review và complaint

| Method | Endpoint | Role | Mô tả |
|---|---|---|---|
| GET | `/bookings` | Customer/Technician/Admin | Danh sách đơn theo scope |
| PATCH | `/bookings/:id/status` | Assigned tech/Owner cancel/Admin | Chuyển trạng thái hợp lệ |
| POST | `/bookings/:id/payments` | Customer owner | Ghi nhận thanh toán mock |
| POST | `/bookings/:id/reviews` | Customer owner | Đánh giá sau hoàn thành |
| POST | `/bookings/:id/complaints` | Customer owner | Tạo khiếu nại liên quan đơn |

### Notification

| Method | Endpoint | Role | Mô tả |
|---|---|---|---|
| GET | `/notifications` | Authenticated | Danh sách và số chưa đọc |
| PATCH | `/notifications/:id/read` | Notification owner | Đánh dấu đã đọc |

### Administration

| Method | Endpoint | Role | Mô tả |
|---|---|---|---|
| GET | `/admin/metrics` | Admin | Số liệu dashboard |
| GET | `/admin/users?q=` | Admin | Tra cứu người dùng |
| PATCH | `/admin/users/:id/status` | Admin | Khóa/mở khóa tài khoản |
| GET | `/admin/technicians?status=` | Admin | Danh sách hồ sơ thợ |
| PATCH | `/admin/technicians/:id/approval` | Admin | Duyệt/từ chối hồ sơ trong transaction |
| POST | `/admin/services` | Admin | Thêm dịch vụ |
| PATCH | `/admin/services/:id` | Admin | Sửa/ngừng dịch vụ |
| GET | `/admin/complaints?status=` | Admin | Danh sách khiếu nại |
| PATCH | `/admin/complaints/:id` | Admin | Xử lý khiếu nại |
| PATCH | `/admin/reviews/:id/status` | Admin | Ẩn/hiện đánh giá và tính lại rating |
| GET | `/admin/audit-logs` | Admin | Nhật ký quản trị |

## 3. Payload chính

Đăng ký:

```json
{
  "name": "Nguyễn An",
  "email": "an@example.com",
  "phone": "0901234567",
  "password": "FixMate123"
}
```

Tạo yêu cầu:

```http
POST /api/requests
Authorization: Bearer <token>
Idempotency-Key: 1dc58934-44f8-46b4-b099-6838dca2d584
```

```json
{
  "serviceId": "66d000000000000000000001",
  "description": "Vòi nước dưới bồn rửa bị rò liên tục.",
  "addressId": "66d000000000000000000002",
  "desiredAt": "2026-09-02T09:00:00.000Z"
}
```

`addressId` có thể thay bằng `address` nhập thủ công. Khi dùng địa chỉ đã lưu, API xác minh ownership và lưu snapshot vào RepairRequest.

Gửi báo giá:

```json
{
  "amount": 350000,
  "note": "Bao gồm công kiểm tra và thay van; chưa gồm linh kiện phát sinh.",
  "validUntil": "2026-09-01T12:00:00.000Z"
}
```

Cập nhật booking:

```json
{ "status": "TECHNICIAN_ON_THE_WAY" }
```

Thanh toán mô phỏng:

```json
{ "method": "MOCK_CARD" }
```

## 4. HTTP status

| Status | Ý nghĩa |
|---|---|
| 200 | Thành công hoặc idempotent replay |
| 201 | Tạo tài nguyên thành công |
| 400 | ID/JSON không hợp lệ |
| 401 | Thiếu/hết hạn token |
| 403 | Sai role hoặc không sở hữu dữ liệu |
| 404 | Không tìm thấy tài nguyên |
| 409 | Trùng dữ liệu hoặc sai trạng thái nghiệp vụ |
| 422 | Input không đạt validation |
| 423 | Tài khoản bị khóa |
| 429 | Vượt rate limit |
