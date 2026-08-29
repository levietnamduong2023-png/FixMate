# SOFTWARE REQUIREMENTS SPECIFICATION — FIXMATE

**Version:** 0.2  
**Status:** Development baseline  
**Date:** 29/08/2026  
**Supersedes:** SRS V0.1 đối với các nội dung được thay đổi trong tài liệu này

## 1. Mục tiêu phiên bản

V0.2 chuyển SRS từ bản mô tả phạm vi sang baseline có thể kiểm thử. Phiên bản này:

- Chuẩn hóa `User` là tài khoản; Customer, Technician và Admin là role.
- Chốt quyền sở hữu tài nguyên và các thao tác theo role.
- Bổ sung authentication recovery, Customer profile và address book.
- Chốt quy tắc hủy/hoàn thành ở mức MVP.
- Định lượng các NFR tối thiểu.
- Xác định rõ những tích hợp vẫn là adapter/mô phỏng.

## 2. Phạm vi và quyết định nghiệp vụ

### 2.1 Quyết định đã chốt cho MVP

| Code | Quyết định |
|---|---|
| BR-ACC-01 | Email là định danh đăng nhập duy nhất, so sánh không phân biệt hoa thường. |
| BR-ACC-02 | Đổi/reset mật khẩu phải thu hồi toàn bộ access token đã phát hành trước đó. |
| BR-ACC-03 | Yêu cầu quên mật khẩu luôn trả response giống nhau dù email có tồn tại hay không. |
| BR-ACC-04 | Reset token chỉ dùng một lần, lưu dưới dạng hash và hết hạn sau 15 phút. |
| BR-ADR-01 | Một Customer có nhiều địa chỉ và tối đa một địa chỉ mặc định. |
| BR-ADR-02 | RepairRequest lưu cả liên kết địa chỉ và address snapshot để lịch sử không thay đổi khi address book được sửa. |
| BR-CAN-01 | Customer được hủy RepairRequest khi `PENDING`, `MATCHING` hoặc `QUOTED`. |
| BR-CAN-02 | Customer được hủy Booking ở `CONFIRMED`; từ `TECHNICIAN_ON_THE_WAY` trở đi phải tạo Complaint hoặc nhờ Admin xử lý. |
| BR-CAN-03 | MVP chưa tính phí hủy và hoa hồng; mọi khoản phí tương lai phải cấu hình, không hard-code. |
| BR-BOK-01 | Technician cập nhật tiến độ theo đúng state machine; không được bỏ qua trạng thái. |
| BR-BOK-02 | V0.2 hiện ghi nhận Technician hoàn tất. Xác nhận hai bước Customer/auto-timeout là P0 trước production. |
| BR-PAY-01 | `MOCK_CARD` và `CASH` chỉ dùng cho demo; production bắt buộc provider adapter và webhook verification. |
| BR-REV-01 | Một Booking chỉ có một Review; chỉ Customer sở hữu Booking đã hoàn thành được tạo Review. |
| BR-CMP-01 | Từ khi thợ đang di chuyển, mọi tranh chấp/hủy ngoại lệ được ghi nhận bằng Complaint để có audit trail. |

### 2.2 Quyết định chưa được phép giả định

Các nội dung sau cần Product Owner phê duyệt trước production:

- Mức phí hủy theo thời điểm.
- Phần trăm hoa hồng và thời điểm ghi nhận doanh thu.
- Thời hạn/phạm vi bảo hành.
- Điều kiện hoàn tiền toàn phần hoặc một phần.
- SLA xử lý khiếu nại và cơ chế bồi thường.

## 3. Functional requirements bổ sung

### 3.1 UC-AUTH-03 — Đăng xuất

**Actor:** Authenticated User  
**Post-condition:** `authVersion` của account tăng; toàn bộ token cũ không còn hợp lệ; client xóa token cục bộ.

**Acceptance criteria:**

1. Token dùng trước logout nhận `401` ở request kế tiếp.
2. Logout lặp không làm lộ thông tin nhạy cảm.
3. Account bị khóa không thể tiếp tục sử dụng token cũ.

### 3.2 UC-AUTH-04 — Quên/reset mật khẩu

**Main flow:**

1. Guest gửi email.
2. System luôn trả thông báo chung.
3. Nếu account hợp lệ, system vô hiệu reset token cũ và tạo token mới 15 phút.
4. Notification adapter gửi reset link; môi trường development có thể trả token khi bật cờ rõ ràng.
5. Guest gửi token và mật khẩu mới.
6. System hash mật khẩu mới, đánh dấu token đã dùng và thu hồi session cũ.

**Exception flow:** token sai, hết hạn hoặc đã dùng trả cùng lỗi `RESET_TOKEN_INVALID`.

### 3.3 UC-AUTH-05 — Đổi mật khẩu

**Pre-condition:** User đã đăng nhập và cung cấp đúng mật khẩu hiện tại.  
**Post-condition:** Mật khẩu mới được hash; toàn bộ token cũ bị thu hồi; User cần đăng nhập lại.

### 3.4 UC-PRO-01/02 — Xem và cập nhật hồ sơ

Customer được xem/cập nhật `name`, `phone`. Email không đổi qua endpoint này. Input phải được trim, kiểm tra chiều dài và chỉ tài khoản sở hữu mới được sửa.

### 3.5 UC-PRO-03 — Address book

| Thao tác | Quy tắc |
|---|---|
| List | Chỉ trả địa chỉ thuộc User hiện tại |
| Create | Bắt buộc label, recipientName, phone, line1, ward, district, city |
| Update | Chỉ owner; không cho thay đổi owner |
| Set default | Bỏ default của các địa chỉ còn lại trong cùng account |
| Delete | Chỉ owner; không sửa address snapshot trong request cũ |

### 3.6 UC-REQ-01 — Chọn địa chỉ khi tạo yêu cầu

Customer chọn `addressId` từ address book hoặc nhập địa chỉ thủ công. Nếu dùng `addressId`, backend phải xác minh ownership và tạo snapshot trước khi lưu RepairRequest.

### 3.7 UC-BOK-05 — Hoàn thành

State V0.2 hiện tại:

```text
CONFIRMED → TECHNICIAN_ON_THE_WAY → IN_PROGRESS → COMPLETED
```

State mục tiêu trước production:

```text
IN_PROGRESS → AWAITING_CUSTOMER_CONFIRMATION → COMPLETED
                                            ↘ DISPUTED
```

## 4. Access-control baseline

Access-control matrix chi tiết nằm tại `docs/Design/05-Access-Control-Matrix.md`. Ba nguyên tắc bắt buộc:

1. Role chỉ xác định nhóm hành động; ownership quyết định quyền trên từng tài nguyên.
2. Client không phải security boundary; mọi kiểm tra thực hiện tại API.
3. Admin action quan trọng phải tạo AuditLog.

## 5. Non-functional requirements có thể đo

| Code | Nhóm | Yêu cầu tối thiểu V0.2 |
|---|---|---|
| NFR-PERF-01 | Latency | p95 API read ≤ 500 ms và write ≤ 800 ms ở 50 request đồng thời, không tính provider bên ngoài |
| NFR-PERF-02 | Pagination | Endpoint danh sách có limit mặc định 20 và tối đa 100 |
| NFR-REL-01 | Availability | Mục tiêu MVP production 99.5%/tháng |
| NFR-REL-02 | Recovery | RPO ≤ 24 giờ, RTO ≤ 4 giờ; phải có restore drill |
| NFR-REL-03 | Duplicate | Create request/payment không tạo trùng khi client retry cùng idempotency key |
| NFR-SEC-01 | Password | Bcrypt cost ≥ 12, password ≥ 8 ký tự có hoa, thường và số |
| NFR-SEC-02 | Token | Signed token có issuer, audience, expiry và server-side revocation version |
| NFR-SEC-03 | Input | Mọi input API qua schema validation; JSON tối đa 1 MB |
| NFR-SEC-04 | Access | Có automated test cho role và ownership của resource P0 |
| NFR-OBS-01 | Audit | Lock user, approve technician, service/complaint/review moderation phải được audit |
| NFR-OBS-02 | Logs | Production log dạng structured, có request ID và không chứa password/token/PII không cần thiết |
| NFR-UX-01 | Responsive | Chức năng P0 dùng được từ viewport 320 px |
| NFR-UX-02 | Accessibility | Form có label, focus state và status không chỉ thể hiện bằng màu |

## 6. Acceptance suite P0

| ID | Given | When | Then |
|---|---|---|---|
| AC-AUTH-01 | Email chưa tồn tại | User đăng ký dữ liệu hợp lệ | Account Customer được tạo và có thể đăng nhập |
| AC-AUTH-02 | Account tồn tại | Guest yêu cầu reset | Response không tiết lộ account; token hash có TTL 15 phút |
| AC-AUTH-03 | Reset token hợp lệ | Guest đặt mật khẩu mới | Token dùng một lần; token đăng nhập cũ bị thu hồi |
| AC-AUTH-04 | User đăng nhập | Đổi đúng mật khẩu hiện tại | Mật khẩu đổi và session cũ hết hiệu lực |
| AC-ADR-01 | Customer có hai địa chỉ | Đặt địa chỉ thứ hai mặc định | Chỉ địa chỉ thứ hai còn `isDefault=true` |
| AC-ADR-02 | Customer A có address | Customer B dùng address ID đó | API trả `404/403`, không tạo request |
| AC-REQ-01 | Customer retry cùng key | Gửi create request hai lần | Chỉ một request được lưu |
| AC-QUO-01 | Nhiều quote còn hiệu lực | Customer accept một quote | Một booking tạo ra; quote khác bị reject trong transaction |
| AC-BOK-01 | Booking CONFIRMED | Technician gửi COMPLETED | API trả conflict vì bỏ qua state |
| AC-PAY-01 | Booking COMPLETED | Customer retry payment cùng key | Chỉ một payment được lưu |
| AC-REV-01 | Booking không thuộc User | User tạo review | API trả forbidden |
| AC-ADM-01 | Admin duyệt thợ | Transaction thành công | Profile APPROVED, role TECHNICIAN, notification và audit cùng tồn tại |

## 7. Definition of Done

Một use case chỉ được đánh dấu `Done` khi:

- Business rule và acceptance criteria đã được duyệt.
- API có validation, authentication/authorization và error contract.
- UI có loading, success và error state nếu use case có giao diện.
- Có test cho happy path, validation, ownership và state conflict quan trọng.
- API/ERD/traceability được cập nhật.
- Production build và dependency audit đạt.

## 8. Version history

| Version | Date | Nội dung |
|---|---|---|
| 0.1 | 28/08/2026 | Initial draft, actor/module/use case ban đầu |
| 0.2 | 29/08/2026 | Baseline có business rule, access control, measurable NFR và acceptance criteria P0 |

