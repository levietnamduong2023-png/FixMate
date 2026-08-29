# Kiến trúc hệ thống FixMate V0.2

## 1. Mục tiêu thiết kế

Kiến trúc được nâng từ kho mã nguồn trống lên một modular monolith MERN. Cách này phù hợp giai đoạn MVP: triển khai đơn giản, giữ transaction nghiệp vụ trong một backend, nhưng vẫn tách router, model, middleware và service để có thể tách dịch vụ khi tải tăng.

## 2. Container architecture

```mermaid
flowchart LR
    U[Guest / Customer / Technician / Admin]
    R[React SPA<br/>Vite]
    E[Express API<br/>Node.js]
    A[Auth + RBAC<br/>JWT]
    D[(MongoDB<br/>Replica Set)]
    P[Payment Adapter<br/>MVP: mock]
    N[Notification Adapter<br/>MVP: in-app]
    M[Map Adapter<br/>Planned]

    U -->|HTTPS| R
    R -->|REST / JSON| E
    E --> A
    E -->|Mongoose| D
    E -.-> P
    E -.-> N
    E -.-> M
```

## 3. Backend layers

```mermaid
flowchart TB
    HTTP[Express app / routes]
    MW[Middleware<br/>auth · role · validation · rate limit · errors]
    DOMAIN[Domain rules<br/>state transitions · ownership · idempotency]
    MODEL[Mongoose models<br/>schema · indexes · unique constraints]
    DB[(MongoDB replica set)]

    HTTP --> MW
    MW --> DOMAIN
    DOMAIN --> MODEL
    MODEL --> DB
```

| Layer | Trách nhiệm | Vị trí |
|---|---|---|
| UI | Landing page và dashboard theo vai trò | `client/src` |
| HTTP | Router và response REST | `server/src/routes` |
| Middleware | JWT, RBAC, error normalization | `server/src/middleware` |
| Domain | State machine dùng chung | `server/src/domain.js` |
| Application service | Notification và audit | `server/src/services` |
| Persistence | Schema, relationship, index | `server/src/models/index.js` |
| Runtime | Kết nối, graceful shutdown, seed | `server/src/server.js`, `seed.js` |

## 4. Luồng nghiệp vụ chính

```mermaid
sequenceDiagram
    actor C as Customer
    participant API as Express API
    participant DB as MongoDB
    actor T as Technician

    C->>API: POST /requests + Idempotency-Key
    API->>DB: Create RepairRequest(PENDING)
    T->>API: GET /technicians/opportunities
    API-->>T: Matching requests
    T->>API: POST /requests/:id/quotes
    API->>DB: Quote(PENDING), Request(QUOTED), Notification
    C->>API: POST /requests/quotes/:id/accept
    API->>DB: Transaction: accept quote + reject others + create booking + update request
    T->>API: PATCH booking status
    API->>DB: Transaction: booking + request + notification
    C->>API: Payment / Review / Complaint
```

## 5. Security architecture

- Mật khẩu băm bằng bcrypt với cost 12; mật khẩu không được trả về JSON và mặc định không được select.
- JWT HS256 có issuer, audience, hạn dùng và `authVersion`; role được đọc lại từ database ở mỗi request nên đổi quyền, logout hoặc đổi/reset mật khẩu có hiệu lực thu hồi session ngay.
- RBAC cho `CUSTOMER`, `TECHNICIAN`, `ADMIN`, kết hợp kiểm tra ownership ở cấp tài nguyên.
- Zod kiểm tra input và Mongoose kiểm tra lần hai ở lớp persistence.
- Helmet, CORS allow-list, giới hạn JSON 1 MB và rate limit riêng cho authentication.
- Audit log cho thao tác quản trị quan trọng.
- Secret và tài khoản admin đi qua environment; production từ chối chạy khi thiếu cấu hình quan trọng.

## 6. Reliability và scalability

- `Idempotency-Key` cùng unique compound index chống tạo trùng yêu cầu và thanh toán.
- Unique index bảo đảm một báo giá/thợ/yêu cầu, một booking/yêu cầu, một payment/booking và một review/booking.
- MongoDB transaction bảo đảm chấp nhận duy nhất một báo giá và đồng bộ trạng thái liên quan.
- Index theo customer, technician, service, status và thời gian hỗ trợ truy vấn chính.
- Phân trang có giới hạn tối đa 100 bản ghi.
- Graceful shutdown đóng HTTP server và MongoDB connection.
- Kiến trúc stateless ở lớp Express cho phép scale nhiều instance sau load balancer.

## 7. Deployment

```mermaid
flowchart LR
    B[Browser] -->|:3000| APP[FixMate container<br/>React static + Express]
    APP -->|Mongoose| MONGO[(MongoDB container<br/>rs0)]
    VOL[(mongo-data volume)] --- MONGO
```

`compose.yaml` cung cấp MongoDB replica set một node cho môi trường demo/development. Production nên dùng replica set ít nhất ba member, HTTPS ở reverse proxy, secret manager, backup và monitoring riêng.

## 8. Quyết định và giới hạn

- Chọn modular monolith thay vì microservices vì phạm vi V0.1 chưa cần chi phí vận hành phân tán.
- Thanh toán hiện là adapter mô phỏng `MOCK_CARD`/`CASH`; không lưu dữ liệu thẻ.
- Notification hiện lưu trong ứng dụng; email/push là điểm mở rộng.
- Map, upload ảnh, email delivery cho reset password và real-time tracking chưa triển khai trong MVP.
