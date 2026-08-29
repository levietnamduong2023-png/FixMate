# Đánh giá SRS V0.1 và hệ thống FixMate

**Ngày đánh giá:** 29/08/2026  
**Baseline:** commit `ab8803e` trước khi cải thiện  
**Phiên bản cải thiện:** FixMate V0.2 MERN MVP

## 1. Kết luận điều hành

SRS V0.1 xác định đúng bài toán, actor, 13 module và luồng end-to-end. Tuy nhiên đây vẫn là draft: nhiều use case mới có tên, NFR chưa đo được, policy thanh toán/hủy/hoa hồng còn TBD và interface bên ngoài chưa có contract.

Kho mã nguồn baseline chỉ có README hai dòng cùng hai thư mục `client`/`server` trống (nay được chuẩn hóa thành `FE`/`BE`); chưa có hệ thống chạy được. Bản cải thiện dựng một MERN MVP có API, database, giao diện theo vai trò, transaction, kiểm thử và tài liệu thiết kế.

| Đối tượng | Điểm | Nhận định |
|---|---:|---|
| Chất lượng SRS V0.1 | **7.1/10** | Phạm vi tốt, đặc tả chi tiết và khả năng kiểm thử còn thiếu |
| Hệ thống baseline | **0.2/10** | Chưa có implementation hoặc runtime |
| Hệ thống sau cải thiện V0.3 | **8.9/10** | MVP end-to-end, account recovery và address book; chưa phải production hoàn chỉnh |

## 2. Đánh giá SRS V0.1

### Điểm mạnh

- Actor và vai trò chính được nhận diện, kể cả Payment/Map/Notification Service.
- Bao phủ đầy đủ vòng đời dịch vụ từ yêu cầu, báo giá, booking, payment đến review/complaint.
- Có danh sách UC code, business rule ban đầu, state diagram, messages, mockup inventory và NFR.
- Tách chức năng Customer, Technician và Admin rõ ràng.
- Có giả định và danh sách chức năng mở rộng, giúp kiểm soát scope.

### Khoảng trống cần nâng SRS lên V0.2/V1.0

| Mức | Vấn đề | Đề xuất |
|---|---|---|
| Critical | Payment chưa có provider, callback signature, retry, refund và reconciliation | Đặc tả payment state machine, webhook, idempotency và refund |
| Critical | Policy hủy, phí, hoa hồng, tranh chấp đều TBD | Chốt business rule trước production |
| High | NFR dùng “hợp lý”, “ổn định”, không có chỉ số | Đặt SLO: p95 latency, uptime, RPO/RTO, concurrency |
| High | Nhiều UC chỉ có tên, thiếu main/alternate/exception flow | Hoàn thiện mọi UC P0/P1 kèm acceptance criteria |
| High | Data dictionary và ERD chi tiết chưa có | Chốt field, type, nullability, unique/index và retention |
| High | Quyền sở hữu dữ liệu chưa mô tả cụ thể | Lập access-control matrix actor × resource × action |
| Medium | User/Customer được dùng chưa nhất quán | Chốt `User` là account, `Customer` là role/profile |
| Medium | Booking completion có cả Customer và Technician nhưng chưa định nghĩa ai quyết định cuối | Thêm xác nhận hai bước hoặc auto-complete timeout |
| Medium | Upload ảnh không có định dạng, kích thước, số lượng và retention | Thêm media policy và malware scanning |
| Medium | Map/Notification interface chưa có contract và failure behavior | Định nghĩa adapter, timeout, retry, circuit breaker |
| Medium | Chưa có yêu cầu privacy, consent, log redaction, data deletion | Thêm privacy/security section theo dữ liệu thực tế |

### Điểm SRS theo tiêu chí

| Tiêu chí | Trọng số | Điểm đạt |
|---|---:|---:|
| Scope, actor, module | 20 | 18 |
| Functional requirements | 25 | 19 |
| Business rules/state | 15 | 11 |
| Data/interface | 15 | 8 |
| NFR/security | 15 | 9 |
| Testability/acceptance criteria | 10 | 6 |
| **Tổng** | **100** | **71** |

## 3. Chấm điểm hệ thống trước và sau

Rubric đánh giá implementation, không cộng điểm riêng cho ý tưởng trong SRS.

| Tiêu chí | Trọng số | Baseline | V0.2 | Bằng chứng V0.2 |
|---|---:|---:|---:|---|
| Functional coverage | 25 | 0 | 21 | 13 nhóm endpoint và 3 dashboard theo role |
| Architecture/code quality | 15 | 1 | 13 | React/Express module, middleware, domain, models |
| Data model/integrity | 10 | 0 | 9.5 | 13 Mongoose model, index, unique, TTL và transaction |
| Security/access control | 15 | 0 | 14 | bcrypt, JWT revocation version, reset TTL, RBAC, ownership, Zod, Helmet, rate limit |
| Reliability/performance | 10 | 0 | 8.5 | idempotency, state machine, pagination, indexes, graceful shutdown |
| UX/accessibility | 10 | 0 | 8 | responsive UI và workspace riêng theo actor |
| Testing/verification | 10 | 0 | 8.5 | unit + integration replica set, full journey, production build |
| Documentation/deployment | 5 | 1 | 5 | README, Docker, ERD, architecture, API, wireframe |
| **Tổng / 100** | **100** | **2** | **89** | |

## 4. Traceability SRS → implementation

| Module SRS | Trạng thái | Implementation |
|---|---|---|
| Tài khoản/xác thực | Implemented core | Register, login/logout revoke, forgot/reset/change password, lock; email delivery còn là adapter |
| Hồ sơ khách hàng | Implemented core | Xem/cập nhật account, address book, default address và ownership |
| Hồ sơ thợ | Implemented core | Apply, approval, skill, availability, public profile/rating |
| Dịch vụ | Implemented core | Public search/list và Admin create/update/deactivate |
| Yêu cầu sửa chữa | Implemented core | Create/list/detail/cancel, validation thời gian, idempotency |
| Tìm/lựa chọn thợ | Implemented core | Filter service/area/rating và opportunity matching |
| Báo giá | Implemented core | Send/list/accept, valid-until, unique quote, reject alternatives |
| Đơn sửa chữa | Implemented core | Transaction create, scoped list, guarded state transition |
| Thanh toán | MVP mock | Payment record/idempotency; chưa provider/webhook/refund |
| Đánh giá | Implemented core | Create/view/moderate và tính lại rating; chưa customer update/delete |
| Khiếu nại | Implemented core | Create, admin workflow, resolution, notification |
| Thông báo | Implemented core | In-app list/unread/read; chưa email/push |
| Quản trị | Implemented core | Metrics, user lock, technician approval, service, complaint, audit |

## 5. Nâng cấp đã thực hiện

### Functional

- Hoàn chỉnh happy path Customer ↔ Technician ↔ Admin.
- UI responsive cho Guest, Customer, Technician, Admin.
- Matching theo dịch vụ; tìm thợ theo dịch vụ/khu vực; rating công khai.
- Notification cho báo giá, booking, payment, review, hồ sơ thợ và complaint.

### Security và integrity

- Bcrypt cost 12 và password policy.
- JWT không nhúng role để tránh stale permission; account được kiểm tra lại mỗi request.
- RBAC kết hợp resource ownership.
- Unique compound index và idempotency key chống gửi lặp.
- MongoDB transaction cho accept quotation, booking transition và technician approval.
- Audit log cho thay đổi quản trị.

### Engineering

- Cấu trúc module, error contract thống nhất, validation hai lớp.
- Health check, graceful shutdown, production configuration guard.
- Docker multi-stage và MongoDB replica set Compose.
- Test trên MongoDB replica set in-memory, không mock transaction.
- Tài liệu ERD, architecture, API và wireframe khớp code.

## 6. Rủi ro còn lại và roadmap

### P0 trước production

1. Tích hợp payment provider thật, webhook verification, refund và reconciliation.
2. Tích hợp email delivery, email/phone verification và refresh-token rotation nếu cần session dài hạn.
3. Phê duyệt các quyết định còn mở về hủy/hoàn tiền/hoa hồng/bảo hành.
4. Object storage cho ảnh, type/size limit, signed URL và malware scan.
5. SLO, centralized log, metrics, alert, backup/restore drill và secret manager.

### P1 sau MVP

1. Customer profile/address book và technician schedule/expertise update.
2. Map/geocoding, khoảng cách thực, vùng phục vụ và ETA.
3. Email/push notification với retry/outbox.
4. Customer confirmation khi hoàn thành; review update/delete; complaint evidence.
5. E2E browser test và accessibility audit tự động.

## 7. Tiêu chí để đạt 9.5/10

- Đóng toàn bộ P0, có payment sandbox verified end-to-end.
- Coverage đầy đủ cho state/authorization matrix và ít nhất 80% critical backend branches.
- Có performance test đạt SLO đã định nghĩa, security scan và backup restore test.
- Không còn UC P0/P1 trong SRS ở trạng thái partial.
