# SOFTWARE REQUIREMENTS SPECIFICATION — FIXMATE

**Version:** 0.3  
**Status:** Proposed consolidated baseline  
**Date:** 29/08/2026  
**Target release:** FixMate 0.3.x production candidate  
**Supersedes:** Toàn bộ SRS V0.1 và SRS V0.2 sau khi Product Owner phê duyệt  
**Document owner:** Product Owner và Technical Lead

## 0. Quản trị tài liệu

### 0.1 Mục đích

SRS V0.3 là baseline độc lập, hợp nhất và có thể kiểm thử cho FixMate. Người đọc không cần tham chiếu V0.1 hoặc V0.2 để xác định hành vi bắt buộc.

Tài liệu này:

- Chuẩn hóa toàn bộ actor, use case, business rule, state machine và quyền sở hữu dữ liệu.
- Chốt baseline nghiệp vụ về hủy, hoa hồng, hoàn tiền, bảo hành và SLA khiếu nại.
- Bổ sung yêu cầu privacy cho địa chỉ, hồ sơ và dữ liệu trước/sau khi giao việc.
- Định nghĩa contract cho payment, email, media, map và notification.
- Chuyển NFR thành tiêu chí có môi trường, workload và release gate đo được.
- Ghi nhận toàn bộ khoảng trống của hệ thống hiện tại trong remediation matrix.

### 0.2 Từ khóa quy chuẩn

- **MUST / Bắt buộc:** Điều kiện phải đạt để release.
- **SHOULD / Nên:** Điều kiện có thể hoãn khi có risk acceptance bằng văn bản.
- **MAY / Có thể:** Tùy chọn không ảnh hưởng nghiệm thu bắt buộc.
- **P0:** Bắt buộc trước production.
- **P1:** Bắt buộc để tuyên bố hoàn tất V0.3 nhưng có thể không chặn bản demo nội bộ.
- **P2:** Cải tiến sau V0.3.

### 0.3 Nguyên tắc thay đổi

Mọi thay đổi business rule P0 phải có:

1. Mã change request.
2. Người phê duyệt và ngày hiệu lực.
3. Use case, API, data migration và test bị ảnh hưởng.
4. Cập nhật version SRS và traceability matrix.

Không được sửa policy trực tiếp bằng hard-code. Policy có giá trị tiền, tỷ lệ hoặc thời hạn phải được cấu hình, có version và audit.

## 1. Tổng quan sản phẩm

### 1.1 Mục tiêu

FixMate kết nối Customer có nhu cầu sửa chữa tại nhà với Technician đã được xác minh. Hệ thống hỗ trợ toàn bộ vòng đời:

~~~text
Đăng ký → Tạo yêu cầu → Matching → Báo giá → Booking
→ Thực hiện → Xác nhận hoàn thành → Thanh toán
→ Đánh giá / Bảo hành / Khiếu nại
~~~

### 1.2 Phạm vi V0.3

- Tài khoản, xác thực, recovery, verification và quản lý phiên.
- Hồ sơ Customer, address book và quyền riêng tư vị trí.
- Đăng ký, xét duyệt, cập nhật chuyên môn và vùng phục vụ của Technician.
- Danh mục dịch vụ, tìm kiếm và chi tiết dịch vụ.
- RepairRequest, media, matching, quotation và booking.
- Thanh toán thật qua provider adapter, cash confirmation, refund và reconciliation.
- Review, complaint, warranty và evidence.
- Notification in-app và email có retry/outbox.
- Admin operations, audit, observability, backup và restore.
- Web responsive và accessible từ viewport 320 px.

### 1.3 Ngoài phạm vi V0.3

- Đấu giá thời gian thực.
- Ví điện tử nội bộ hoặc giữ tiền escrow do FixMate tự vận hành.
- Dynamic surge pricing tự động.
- Theo dõi GPS liên tục của Technician.
- Multi-country, multi-currency và multi-language.
- Native mobile application.

Các mục ngoài phạm vi không được mô phỏng như chức năng production.

### 1.4 Actor và hệ thống ngoài

| Actor / System | Trách nhiệm |
|---|---|
| Guest | Xem dịch vụ, tìm Technician công khai, đăng ký và đăng nhập |
| Customer | Quản lý hồ sơ/địa chỉ, tạo yêu cầu, chọn báo giá, quản lý booking, thanh toán, review và complaint |
| Technician | Quản lý hồ sơ/chuyên môn/vùng phục vụ, nhận cơ hội phù hợp, gửi báo giá và thực hiện booking |
| Admin | Quản lý vận hành, override có kiểm soát, moderation và audit |
| Payment Provider | Xử lý giao dịch, webhook, refund và reconciliation |
| Email Provider | Gửi verification, reset password và thông báo quan trọng |
| Object Storage / Scanner | Lưu media riêng tư, quét malware và cấp signed URL |
| Map Provider | Geocoding, chuẩn hóa khu vực và ước lượng khoảng cách |
| Monitoring Platform | Thu thập log, metric, trace và alert |

## 2. Business rules và policy baseline

### 2.1 Tài khoản, xác thực và phiên

| Code | Quy tắc bắt buộc |
|---|---|
| BR-ACC-01 | Email đã trim và lowercase là định danh đăng nhập duy nhất. |
| BR-ACC-02 | Password dài 8–128 ký tự, có chữ hoa, chữ thường và số; băm bcrypt cost tối thiểu 12. |
| BR-ACC-03 | Access token có issuer, audience, expiry và server-side revocation version. |
| BR-ACC-04 | Logout, đổi/reset password, khóa tài khoản và security incident phải thu hồi các token liên quan. |
| BR-ACC-05 | Forgot-password luôn trả cùng HTTP status, schema và thông điệp, không tiết lộ account. API không được trả raw reset token ở bất kỳ môi trường nào. |
| BR-ACC-06 | Reset token ngẫu nhiên tối thiểu 256 bit, lưu dạng hash, hết hạn 15 phút và chỉ dùng một lần. Development dùng mail sink riêng để đọc email, không dùng response API. |
| BR-ACC-07 | Email phải được xác minh trước payment production hoặc trước khi trở thành Technician. Phone verification bắt buộc trước khi Customer tạo booking đầu tiên. |
| BR-ACC-08 | Admin không được tự khóa account đang dùng; khóa/mở khóa phải audit và khóa phải tăng authVersion. |
| BR-ACC-09 | Login, forgot/reset và verification có rate limit riêng theo IP và account fingerprint; không log credential/token. |
| BR-ACC-10 | Production session dùng access token tối đa 15 phút và refresh token tối đa 30 ngày. Refresh token lưu dạng hash, rotate sau mỗi lần dùng, có reuse detection và được bảo vệ bằng HttpOnly/Secure/SameSite cookie hoặc cơ chế tương đương đã được security review. |

### 2.2 Privacy, địa chỉ và dữ liệu cá nhân

| Code | Quy tắc bắt buộc |
|---|---|
| BR-PRI-01 | Guest không được xem PII của Customer. |
| BR-PRI-02 | Trước khi booking được tạo, Technician chỉ thấy mô tả công việc, dịch vụ, thời gian và vị trí thô gồm ward/district/city; không thấy số nhà, tên đầy đủ hoặc phone. |
| BR-PRI-03 | Chỉ Technician được gán booking mới được xem exact address, recipient name và contact phone. Quyền này chấm dứt 30 ngày sau khi booking đóng, trừ complaint/warranty đang mở. |
| BR-PRI-04 | Opportunity matching bắt buộc lọc cả chuyên môn, approval, acceptingJobs và vùng phục vụ; không chỉ lọc serviceId. |
| BR-PRI-05 | RepairRequest lưu addressRef và immutable structured snapshot gồm recipientName, phone, line1, ward, district, city và tọa độ nếu có. Sửa/xóa address book không thay đổi snapshot. |
| BR-PRI-06 | API áp dụng data minimization theo response DTO, không trả nguyên Mongoose document khi không cần. |
| BR-PRI-07 | Media phải xóa EXIF/location metadata trước khi cung cấp cho người dùng khác. |
| BR-PRI-08 | User có thể yêu cầu export hoặc xóa account. PII được anonymize trong 30 ngày, trừ dữ liệu đang bị legal/business hold được ghi nhận. |
| BR-PRI-09 | System hiển thị privacy notice/terms có version trước khi thu thập dữ liệu; lưu ConsentRecord cho điều khoản bắt buộc và cho phép rút consent đối với location/media/marketing tùy chọn mà không làm sai lệch lịch sử giao dịch. |

### 2.3 RepairRequest, media và matching

| Code | Quy tắc bắt buộc |
|---|---|
| BR-REQ-01 | Customer chỉ được dùng address thuộc account hoặc nhập địa chỉ thủ công hợp lệ. |
| BR-REQ-02 | Desired time phải ở tương lai và nằm trong service availability policy. |
| BR-REQ-03 | Customer được sửa mô tả, media, địa chỉ và desired time khi request ở PENDING/MATCHING và chưa có quotation; mọi thay đổi quan trọng được audit history. |
| BR-REQ-04 | Customer được hủy request ở PENDING, MATCHING hoặc QUOTED; quotation còn hiệu lực chuyển REJECTED. |
| BR-REQ-05 | Tối đa 5 media/request; JPEG, PNG hoặc WebP; tối đa 5 MB/file; phải kiểm tra MIME thực, quét malware và lưu private. |
| BR-MAT-01 | Matching không tiết lộ exact address và chỉ trả cơ hội nằm trong service area của Technician. |
| BR-MAT-02 | Distance/ETA từ provider chỉ là ước lượng và phải có fallback theo district/city khi provider lỗi. |
| BR-MAT-03 | Technician bị khóa, chưa APPROVED hoặc tắt acceptingJobs không nhận cơ hội và không gửi quotation. |
| BR-MAT-04 | Matching phải kiểm tra weekly schedule, time-off và booking conflict của Technician với desired time; Admin override cần reason/audit. |

### 2.4 Quotation

| Code | Quy tắc bắt buộc |
|---|---|
| BR-QUO-01 | Một Technician chỉ có một quotation active cho mỗi request; được cập nhật trước khi Customer quyết định nếu request còn QUOTED. |
| BR-QUO-02 | Quotation có amount, labor/parts breakdown, scope, exclusions, warranty proposal và validUntil. |
| BR-QUO-03 | Customer có thể reject từng quotation hoặc accept đúng một quotation còn hiệu lực. |
| BR-QUO-04 | Accept quotation là transaction: accept một quote, reject các quote khác, tạo một booking, cập nhật request và tạo notification/outbox. |
| BR-QUO-05 | Quotation hết hạn tự chuyển EXPIRED bằng job idempotent. |

### 2.5 Booking, hủy và hoàn thành

State machine production:

~~~text
CONFIRMED
  → TECHNICIAN_ON_THE_WAY
  → IN_PROGRESS
  → AWAITING_CUSTOMER_CONFIRMATION
      → COMPLETED
      → DISPUTED

CONFIRMED → CANCELLED
TECHNICIAN_ON_THE_WAY / IN_PROGRESS → CANCELLATION_REVIEW
CANCELLATION_REVIEW → CANCELLED | IN_PROGRESS | DISPUTED
~~~

| Code | Quy tắc bắt buộc |
|---|---|
| BR-BOK-01 | Technician chỉ chuyển theo state machine, không bỏ qua trạng thái. |
| BR-BOK-02 | Technician không tự chuyển trực tiếp từ IN_PROGRESS sang COMPLETED. |
| BR-BOK-03 | Sau khi Technician gửi completion report, booking chuyển AWAITING_CUSTOMER_CONFIRMATION. Customer xác nhận COMPLETED hoặc tạo DISPUTED. |
| BR-BOK-04 | Không có phản hồi sau 24 giờ kể từ completion report thì system auto-complete nếu không có complaint/payment anomaly. |
| BR-BOK-05 | Customer được tự hủy booking ở CONFIRMED. Từ TECHNICIAN_ON_THE_WAY trở đi phải tạo cancellation review/complaint. |
| BR-BOK-06 | Technician muốn hủy booking phải nêu lý do; Admin hoặc policy engine quyết định, không dùng transition dành cho Customer. |
| BR-BOK-07 | Admin override cần reason tối thiểu 10 ký tự, before/after state, actor, requestId và AuditLog trong cùng transaction. |
| BR-BOK-08 | Mọi transition dùng optimistic concurrency hoặc atomic compare-and-set. |

### 2.6 Cancellation policy

Policy là cấu hình versioned, không hard-code:

| Trường hợp | Baseline V0.3 |
|---|---|
| Hủy RepairRequest trước booking | Miễn phí |
| Customer hủy Booking ở CONFIRMED | Miễn phí |
| Technician chưa di chuyển nhưng chủ động hủy | Miễn phí cho Customer; ghi reliability incident cho Technician |
| Customer hủy sau TECHNICIAN_ON_THE_WAY do đổi ý/no-show | Phí mặc định 20% giá booking, tối đa 200.000 VND; Admin có thể waive có audit |
| Technician fault, unsafe service hoặc force majeure | Không phí; hoàn 100% phần đã thanh toán |
| Tranh chấp trách nhiệm | Chuyển complaint; không tự động thu phí/hoàn tiền trước quyết định |

Mọi thay đổi tỷ lệ/cap phải tạo policy version mới và không hồi tố booking cũ.

### 2.7 Payment, commission và refund

Payment state machine:

~~~text
CREATED → PROCESSING → PAID
                    ↘ FAILED
PAID → PARTIALLY_REFUNDED → REFUNDED
PAID → REFUNDED
~~~

| Code | Quy tắc bắt buộc |
|---|---|
| BR-PAY-01 | MOCK_CARD chỉ được phép khi NODE_ENV không phải production. Production startup phải từ chối mock provider. |
| BR-PAY-02 | Online payment chỉ chuyển PAID từ webhook đã xác minh; browser redirect không phải bằng chứng thanh toán. |
| BR-PAY-03 | Webhook kiểm tra signature, timestamp, provider event ID, merchant/order ID, currency và amount; event trùng phải replay idempotent. |
| BR-PAY-04 | Cash payment cần Technician đánh dấu đã thu và Customer xác nhận; bất đồng chuyển complaint. |
| BR-PAY-05 | Một booking có thể có nhiều payment attempt nhưng chỉ một successful settlement cho cùng obligation. |
| BR-PAY-06 | Commission baseline là 15% trên số tiền thực thu sau refund, ghi nhận khi booking COMPLETED và payment PAID. Tỷ lệ được lưu snapshot trên booking/payment. |
| BR-PAY-07 | Refund có thể full/partial, bắt buộc reason, actor và reference tới complaint/cancellation; trạng thái chỉ cập nhật từ provider response/webhook. |
| BR-PAY-08 | Refund được gửi provider trong 1 ngày làm việc sau quyết định; thời gian tiền về phụ thuộc provider và phải hiển thị cho Customer. |
| BR-PAY-09 | Reconciliation chạy hằng ngày, phát hiện chênh lệch provider/internal và tạo alert. |
| BR-PAY-10 | Không lưu PAN, CVV hoặc raw payment credential. |

### 2.8 Warranty, review và complaint

| Code | Quy tắc bắt buộc |
|---|---|
| BR-WAR-01 | Baseline warranty công sửa chữa là 30 ngày từ COMPLETED; linh kiện theo warranty ghi trong accepted quotation, tối thiểu không thấp hơn cam kết của Technician. |
| BR-WAR-02 | Warranty claim tham chiếu booking, evidence và phạm vi quote; không tự động coi mọi lỗi mới là warranty. |
| BR-REV-01 | Một review/booking; chỉ Customer owner của booking COMPLETED được tạo. |
| BR-REV-02 | Customer được update hoặc delete review trong 30 ngày; mỗi thay đổi có history. |
| BR-REV-03 | Admin moderation không sửa nội dung/rating; chỉ VISIBLE/HIDDEN với reason và audit. |
| BR-CMP-01 | Customer tạo complaint/cancellation/warranty claim cho booking của mình và xem toàn bộ timeline của complaint đó. |
| BR-CMP-02 | Assigned Technician chỉ xem complaint liên quan mình, PII tối thiểu và được phản hồi/evidence. |
| BR-CMP-03 | Complaint acknowledgment ngay sau khi tạo; triage trong 4 giờ làm việc; resolution target 3 ngày làm việc, tối đa 7 ngày nếu có lý do và thông báo. |
| BR-CMP-04 | Complaint terminal phải có resolution tối thiểu, actor, timestamp, refund/cancellation reference nếu có. |
| BR-CMP-05 | Complaint RESOLVED/REJECTED chỉ được reopen bởi Admin cấp cao với reason và audit. |

### 2.9 Notification và audit

| Code | Quy tắc bắt buộc |
|---|---|
| BR-NOT-01 | Notification in-app là nguồn hiển thị; email là delivery channel cho sự kiện quan trọng. |
| BR-NOT-02 | Notification/outbound email tạo qua transactional outbox; retry exponential và dead-letter sau ngưỡng cấu hình. |
| BR-NOT-03 | User được list, mark read, mark all read và quản lý preference, trừ security notification bắt buộc. |
| BR-AUD-01 | Audit bắt buộc cho user lock/unlock, technician approval/profile override, service/policy change, booking override, payment/refund, complaint/review moderation và access vào dữ liệu nhạy cảm của Admin. |
| BR-AUD-02 | Audit append-only, không có endpoint update/delete, retention tối thiểu 24 tháng. |
| BR-AUD-03 | Audit lưu actor, action, entity, before/after được redaction, reason, requestId, IP hash và timestamp. |

## 3. Functional requirements

### 3.1 Account, authentication và profile

| ID | Priority | Actor | Requirement và acceptance tối thiểu |
|---|---:|---|---|
| UC-AUTH-01 | P0 | Guest | Đăng ký Customer; email trùng trả EMAIL_EXISTS; account và verification được tạo. |
| UC-AUTH-02 | P0 | Guest | Đăng nhập; credential sai dùng lỗi chung; account locked không nhận token. |
| UC-AUTH-03 | P0 | User | Logout thu hồi session theo policy và client xóa token. |
| UC-AUTH-04 | P0 | Guest | Forgot/reset password chống enumeration, token hash 15 phút, one-time và thu hồi session cũ. |
| UC-AUTH-05 | P0 | User | Đổi password sau khi xác minh password hiện tại; thu hồi session và reset token cũ. |
| UC-AUTH-06 | P0 | User | Xác minh email/phone bằng token/OTP có expiry, attempt limit và audit security event. |
| UC-AUTH-07 | P0 | User/System | Rotate refresh token, phát hiện reuse, xem và thu hồi các session đang hoạt động. |
| UC-PRO-01 | P0 | User | Xem profile của chính mình bằng response DTO không chứa field nhạy cảm. |
| UC-PRO-02 | P0 | User | Update name/phone; email đổi qua verification flow riêng. |
| UC-PRO-03 | P0 | User | CRUD address, một default, ownership và immutable snapshot cho request cũ. |
| UC-PRO-04 | P1 | User | Export dữ liệu và yêu cầu xóa/anonymize account. |
| UC-PRO-05 | P1 | User | Xem version privacy notice/terms đã chấp nhận và quản lý consent tùy chọn. |

### 3.2 Technician

| ID | Priority | Actor | Requirement và acceptance tối thiểu |
|---|---:|---|---|
| UC-TEC-01 | P0 | Customer | Gửi application gồm chuyên môn, kinh nghiệm, bio, vùng phục vụ và evidence xác minh. |
| UC-TEC-02 | P0 | Technician | Update profile; field xác minh quan trọng chuyển trạng thái cần Admin review. |
| UC-TEC-03 | P0 | Technician | Quản lý chuyên môn và vùng phục vụ; chỉ service active; thay đổi được audit. |
| UC-TEC-04 | P0 | Applicant | Xem trạng thái, reason từ chối và yêu cầu bổ sung. |
| UC-TEC-05 | P0 | Technician | Bật/tắt acceptingJobs; tắt thì không nhận opportunity mới. |
| UC-TEC-06 | P1 | Technician | Xem performance summary không tiết lộ dữ liệu Customer ngoài phạm vi. |
| UC-TEC-07 | P1 | Technician | Quản lý weekly schedule, time-off và xem booking conflict. |

### 3.3 Service, request, matching và quotation

| ID | Priority | Actor | Requirement và acceptance tối thiểu |
|---|---:|---|---|
| UC-SVC-01 | P0 | All | List service active có pagination. |
| UC-SVC-02 | P0 | All | Search service theo query đã sanitize. |
| UC-SVC-03 | P0 | All | Xem service detail, scope, base price, exclusions và warranty baseline. |
| UC-REQ-01 | P0 | Customer | Tạo request bằng address owner hoặc manual address, snapshot, media và idempotency. |
| UC-REQ-02 | P0 | Customer | List request owner có filter/pagination. |
| UC-REQ-03 | P0 | Scoped actor | Xem detail theo ownership/matched/assigned/Admin scope và privacy DTO. |
| UC-REQ-04 | P0 | Customer | Update request theo BR-REQ-03, chống concurrent update. |
| UC-REQ-05 | P0 | Customer | Cancel request theo state và reject quote còn active. |
| UC-REQ-06 | P0 | Customer | Upload/delete media bằng signed URL, type/size scan và owner authorization. |
| UC-FND-01 | P0 | Guest/Customer | Search Technician APPROVED/acceptingJobs. |
| UC-FND-02 | P0 | Guest/Customer | Filter theo service, vùng phục vụ, rating và availability; pagination ổn định. |
| UC-FND-03 | P0 | All | Xem public Technician profile không có PII private. |
| UC-FND-04 | P0 | All | Xem review VISIBLE có pagination. |
| UC-MAT-01 | P0 | Technician | List opportunity theo service và service area, chỉ có coarse location. |
| UC-QUO-01 | P0 | Technician | Tạo/update quotation hợp lệ theo breakdown và expiry. |
| UC-QUO-02 | P0 | Scoped actor | Customer xem mọi quote của request; Technician chỉ quote của mình; Admin theo permission. |
| UC-QUO-03 | P0 | Customer | Accept đúng một quote trong transaction và tạo booking. |
| UC-QUO-04 | P0 | Customer | Reject quotation; Technician nhận notification, request vẫn nhận quote khác. |

### 3.4 Booking, payment, review và complaint

| ID | Priority | Actor | Requirement và acceptance tối thiểu |
|---|---:|---|---|
| UC-BOK-01 | P0 | System | Tạo booking duy nhất từ accepted quotation. |
| UC-BOK-02 | P0 | Scoped actor | List/detail booking theo owner/assigned/Admin scope. |
| UC-BOK-03 | P0 | Technician | Transition tuần tự bằng atomic compare-and-set. |
| UC-BOK-04 | P0 | Customer/Technician/Admin | Cancel theo actor-specific policy, phí cấu hình và audit. |
| UC-BOK-05 | P0 | Technician/Customer/System | Completion report → customer confirmation/dispute → auto-timeout. |
| UC-BOK-06 | P1 | Customer/Technician | Xem immutable timeline của state transition. |
| UC-PAY-01 | P0 | Customer | Tạo payment attempt idempotent cho booking thuộc owner. |
| UC-PAY-02 | P0 | Provider/System | Xử lý webhook verified và state machine payment. |
| UC-PAY-03 | P0 | Scoped actor | Xem payment history/attempt/refund theo scope, không có credential nhạy cảm. |
| UC-PAY-04 | P0 | Admin/System | Full/partial refund có provider confirmation, reason và audit. |
| UC-PAY-05 | P0 | System/Admin | Daily reconciliation và xử lý discrepancy. |
| UC-REV-01 | P0 | All | Xem review VISIBLE. |
| UC-REV-02 | P0 | Customer | Tạo review cho booking COMPLETED thuộc owner. |
| UC-REV-03 | P1 | Customer | Update review trong 30 ngày và recalculation rating. |
| UC-REV-04 | P1 | Customer | Delete review trong 30 ngày và recalculation rating. |
| UC-CMP-01 | P0 | Customer | Tạo complaint/cancellation/warranty claim kèm evidence. |
| UC-CMP-02 | P0 | Customer/Technician | Xem complaint timeline theo ownership/assignment và privacy scope. |
| UC-CMP-03 | P0 | Admin | Triage, request evidence, resolve/reject theo state và SLA. |
| UC-CMP-04 | P1 | Customer/Technician | Phản hồi và bổ sung evidence trước terminal state. |
| UC-NOT-01 | P0 | User | List notification và unread count. |
| UC-NOT-02 | P0 | User | Mark read/mark all read theo ownership. |
| UC-NOT-03 | P1 | User | Quản lý channel preference cho notification không bắt buộc. |

### 3.5 Administration

| ID | Priority | Actor | Requirement và acceptance tối thiểu |
|---|---:|---|---|
| UC-ADM-01 | P0 | Admin | Tra cứu user có pagination và field minimization. |
| UC-ADM-02 | P0 | Admin | Lock user, revoke session và audit. |
| UC-ADM-03 | P0 | Admin | Unlock user có reason và audit; token trước lúc lock vẫn bị revoke. |
| UC-ADM-04 | P0 | Admin | Approve/reject Technician trong transaction với role, notification và audit. |
| UC-ADM-05 | P0 | Admin | CRUD/deactivate service và policy version có audit. |
| UC-ADM-06 | P0 | Admin | Quản lý/override booking với reason, state guard và audit. |
| UC-ADM-07 | P0 | Admin | Moderate review theo BR-REV-03. |
| UC-ADM-08 | P0 | Admin | Quản lý complaint/refund theo SLA và permission. |
| UC-ADM-09 | P0 | Auditor/Admin | Tra cứu AuditLog read-only có filter/pagination và export được kiểm soát. |
| UC-ADM-10 | P1 | Admin | Dashboard operational metrics có định nghĩa và thời điểm cập nhật rõ ràng. |

## 4. Luồng P0 chi tiết

### 4.1 Forgot/reset password

1. Guest gửi email.
2. API validate và luôn trả 202 với cùng schema/message.
3. Nếu account ACTIVE, system invalidate reset token cũ và tạo token mới.
4. Transactional outbox gửi email; API không trả token.
5. Guest gửi token và password mới.
6. System hash token để tìm, kiểm tra expiry/usedAt/account.
7. Trong transaction, password đổi, authVersion tăng, token đánh dấu used và token khác bị vô hiệu.
8. Security notification được gửi.

Exception token sai/hết hạn/đã dùng/account không hợp lệ đều trả RESET_TOKEN_INVALID. Test phải kiểm tra response của email có/không tồn tại cùng status và schema.

### 4.2 Tạo request và opportunity privacy

1. Customer chọn address owner hoặc nhập manual address.
2. System validate service, desired time, address và media.
3. System tạo structured immutable address snapshot.
4. Idempotency middleware lưu request hash và kết quả.
5. Matching lọc Technician theo approval, acceptingJobs, service và service area.
6. Opportunity DTO chỉ trả coarse location.
7. Sau khi accept quotation và booking commit, assigned Technician mới nhận exact address/contact.

### 4.3 Accept quotation

Trong một transaction:

1. Lock/compare request và selected quotation còn hiệu lực.
2. Xác minh Customer ownership.
3. Chuyển selected quote ACCEPTED.
4. Chuyển quote khác REJECTED.
5. Tạo một Booking CONFIRMED với policy/commission/warranty snapshot.
6. Chuyển request BOOKED.
7. Ghi outbox event.

Concurrent accept chỉ một transaction thành công; request khác nhận kết quả idempotent hoặc conflict xác định.

### 4.4 Completion và dispute

1. Technician ở IN_PROGRESS gửi completion report và evidence.
2. Booking chuyển AWAITING_CUSTOMER_CONFIRMATION.
3. Customer chọn Confirm completed hoặc Dispute.
4. Confirm chuyển COMPLETED; dispute chuyển DISPUTED và tạo complaint.
5. Job auto-complete sau 24 giờ chỉ chạy khi không có complaint/anomaly.
6. Mọi bước có immutable timeline.

### 4.5 Payment webhook và refund

1. Customer tạo payment attempt với Idempotency-Key.
2. Backend tạo provider order, không đánh dấu PAID.
3. Provider gửi webhook.
4. Backend verify signature/timestamp/event/order/amount/currency.
5. Event ID được deduplicate; transaction cập nhật payment và outbox.
6. Refund chỉ tạo từ policy/complaint decision, gửi provider và chờ confirmation.
7. Reconciliation so sánh dữ liệu provider hằng ngày.

## 5. State model

### 5.1 RepairRequest

~~~text
PENDING → MATCHING → QUOTED → BOOKED → IN_PROGRESS
PENDING | MATCHING | QUOTED → CANCELLED
BOOKED | IN_PROGRESS → đồng bộ từ Booking
~~~

### 5.2 Quotation

~~~text
PENDING → ACCEPTED | REJECTED | EXPIRED
PENDING → PENDING (update có version)
~~~

### 5.3 Booking

Theo state machine tại mục 2.5. State terminal: COMPLETED, CANCELLED; DISPUTED chỉ thoát khi complaint resolution tạo transition hợp lệ.

### 5.4 Complaint

~~~text
PENDING → PROCESSING → WAITING_FOR_CUSTOMER | WAITING_FOR_TECHNICIAN
PROCESSING | WAITING_* → RESOLVED | REJECTED
RESOLVED | REJECTED → REOPENED (Admin cấp cao + audit)
REOPENED → PROCESSING
~~~

## 6. Data requirements

### 6.1 Entity bắt buộc

User, VerificationToken, Session, RefreshToken, ConsentRecord, Address, Service, TechnicianProfile, ServiceArea, TechnicianSchedule, RepairRequest, RequestMedia, Quotation, Booking, BookingTimeline, Payment, PaymentEvent, Refund, Review, ReviewHistory, Complaint, ComplaintEvidence, Notification, OutboxEvent, IdempotencyRecord, PolicyVersion và AuditLog.

### 6.2 Idempotency contract

- Bắt buộc cho create request, accept quote, payment attempt, provider webhook và refund.
- Scope key: principal/provider + HTTP method + normalized route + Idempotency-Key.
- Lưu canonical request hash, response status/body reference và trạng thái xử lý.
- Cùng key/cùng payload: trả nguyên kết quả đầu tiên, kể cả concurrent request.
- Cùng key/khác payload: trả 409 IDEMPOTENCY_KEY_REUSED.
- Record giữ tối thiểu 24 giờ cho user command và theo retention provider cho webhook.
- Không lưu credential hoặc raw sensitive payload trong record.

### 6.3 Concurrency và integrity

- Unique index: user.email; technicianProfile.user; quotation(request, technician); booking.request; review.booking; providerEvent(provider, eventId).
- Transition dùng version hoặc compare-and-set trên current state.
- Multi-document nghiệp vụ P0 dùng transaction.
- Side effect ra ngoài transaction dùng transactional outbox, không gọi provider/email trực tiếp trước commit.

### 6.4 Retention baseline

| Dữ liệu | Retention mặc định |
|---|---|
| Reset/verification token | Expiry 15 phút; purge trong 24 giờ |
| Application log | 30 ngày hot, tối đa 90 ngày |
| AuditLog | Tối thiểu 24 tháng |
| Notification | 12 tháng |
| Request/quotation không thành booking | 12 tháng sau terminal |
| Booking/payment/refund/complaint | 60 tháng hoặc lâu hơn khi có hold được phê duyệt |
| Media | 12 tháng sau khi booking/complaint/warranty cuối cùng đóng |
| PII account đã xóa | Anonymize trong 30 ngày nếu không có hold |

Retention phải là scheduled job có metric và audit; backup hết hạn cũng phải tuân theo lifecycle riêng.

## 7. External interface contracts

### 7.1 REST API

- Base URL: /api/v1 cho contract V0.3; endpoint legacy /api có deprecation plan.
- JSON UTF-8, body tối đa 1 MB trừ direct-to-storage upload.
- Body, path, query và security-relevant header đều qua schema validation.
- Pagination mặc định 20, tối đa 100; list lớn dùng stable sort và cursor khi cần.
- Money là integer VND; timestamp ISO 8601 UTC.
- Mọi response có X-Request-Id; error không chứa stack/secret.

Error contract:

~~~json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ.",
    "details": [
      { "field": "email", "message": "Email không hợp lệ" }
    ],
    "requestId": "01J..."
  }
}
~~~

### 7.2 Payment provider

- Adapter interface: createPayment, getPayment, refund, verifyWebhook và reconcile.
- Webhook signature dùng provider SDK/contract; raw body được giữ chỉ trong thời gian verify và không log.
- Timestamp tolerance mặc định 5 phút nếu provider hỗ trợ.
- Backend trả 2xx chỉ sau khi event đã durable commit/deduplicate.
- Retry từ provider không tạo duplicate payment/refund.
- Provider timeout có timeout budget, retry chỉ cho operation an toàn/idempotent.

### 7.3 Email và notification

- Email đi qua outbox worker.
- Retry exponential có jitter; tối đa mặc định 8 lần trong 24 giờ.
- Dead-letter tạo alert và cho phép replay có audit.
- Template không chứa exact address trừ email booking gửi đúng assigned Technician/Customer.

### 7.4 Media

- Client xin signed upload URL sau authorization.
- Storage private; signed read URL tối đa 15 phút.
- MIME sniffing, malware scan và EXIF removal trước trạng thái READY.
- File chưa READY không xuất hiện trong API cho actor khác.

### 7.5 Map/geocoding

- Exact address chỉ gửi provider theo mục đích matching/ETA đã công bố.
- Cache geocode có expiry; không log raw exact address.
- Khi provider lỗi, fallback district/city và không chặn tạo request.

## 8. Access-control baseline

| Resource / Action | Guest | Customer | Technician | Admin |
|---|---|---|---|---|
| Service public | Active only | Active only | Active only | All + manage/audit |
| Technician public profile | Approved DTO | Approved DTO | Approved DTO | All scoped fields |
| Technician application/profile | — | Create/view own application | View/update own | Review/override + audit |
| User profile/address | — | Own | Own | Support access có reason/audit |
| Request create/update/cancel | — | Own + valid state | — | Override + reason/audit |
| Opportunity | — | — | Matched + coarse location | Operational view |
| Request exact address | — | Own | Assigned booking only | Need-to-know + audit |
| Quotation | — | Request owner | Own | Read/override có permission |
| Booking | — | Own | Assigned | All; override + audit |
| Payment/refund | — | Own booking | Settlement summary cần thiết | Finance permission + audit |
| Review | Visible | Own CRUD window | Received view | Moderate + reason/audit |
| Complaint | — | Own | Assigned complaint scope | Assigned case/admin role |
| Notification | — | Own | Own | Own |
| AuditLog | — | — | — | Read-only auditor/admin permission |

Enforcement bắt buộc ở API. UI không phải security boundary. Resource không thuộc owner ưu tiên 404 khi cần chống enumeration.

## 9. Non-functional requirements

### 9.1 Performance

| Code | Requirement |
|---|---|
| NFR-PERF-01 | p95 read ≤ 500 ms, write ≤ 800 ms; p99 read ≤ 1.000 ms, write ≤ 1.500 ms, không tính provider latency. |
| NFR-PERF-02 | Error rate do hệ thống < 1% trong load test. |
| NFR-PERF-03 | Workload: ramp 2 phút, steady 10 phút, 50 concurrent virtual users, mix 70% read/30% write. |
| NFR-PERF-04 | Dataset tối thiểu: 100.000 users, 50.000 requests, 20.000 bookings và 1.000.000 notifications. |
| NFR-PERF-05 | Test chạy trên môi trường staging có cấu hình tài nguyên được ghi lại; report lưu cùng release artifact. |

### 9.2 Availability và recovery

| Code | Requirement |
|---|---|
| NFR-REL-01 | Availability mục tiêu 99,5%/tháng, loại trừ maintenance được báo trước. |
| NFR-REL-02 | RPO ≤ 24 giờ, RTO ≤ 4 giờ. |
| NFR-REL-03 | Backup encrypted, restore drill ít nhất mỗi quý và trước production launch. |
| NFR-REL-04 | Health/readiness trả non-2xx khi dependency bắt buộc không sẵn sàng. |
| NFR-REL-05 | Graceful shutdown ngừng nhận traffic, hoàn tất request trong timeout và đóng connection. |
| NFR-REL-06 | Outbox, scheduled job và reconciliation có retry, lease/lock và metric chống chạy trùng. |

### 9.3 Security

| Code | Requirement |
|---|---|
| NFR-SEC-01 | TLS bắt buộc ngoài local development; HSTS/CSP/security headers cấu hình production. |
| NFR-SEC-02 | Secret chỉ từ secret manager/runtime env, có rotation; không commit hoặc log secret. |
| NFR-SEC-03 | Mọi input body/path/query/header qua schema và output qua DTO. |
| NFR-SEC-04 | Dependency audit không có known Critical/High chưa được risk-accept; SAST và secret scan chạy CI. |
| NFR-SEC-05 | Automated negative test cho role và ownership của mọi resource P0. |
| NFR-SEC-06 | Token trong browser dùng cơ chế giảm XSS exposure; nếu dùng cookie phải HttpOnly, Secure, SameSite và có CSRF defense. |
| NFR-SEC-07 | Admin/finance action nhạy cảm yêu cầu recent authentication và có thể bật MFA trước production. |
| NFR-SEC-08 | Media scan, rate limit, payload limit và regex/query safety được kiểm thử. |

### 9.4 Observability

| Code | Requirement |
|---|---|
| NFR-OBS-01 | Production log là JSON structured có timestamp, level, service, requestId, traceId, route, status và duration. |
| NFR-OBS-02 | Log không chứa password, token, reset code, PAN/CVV, raw exact address hoặc PII không cần thiết. |
| NFR-OBS-03 | Metric tối thiểu: request rate/error/latency, DB pool, queue/outbox lag, payment webhook, reconciliation discrepancy, email failure và job result. |
| NFR-OBS-04 | Alert P0 có owner, threshold và runbook; alert payment/security không chỉ dựa vào log thủ công. |
| NFR-OBS-05 | AuditLog và application log là hai nguồn riêng; log lỗi không thay thế business audit. |

### 9.5 UX và accessibility

| Code | Requirement |
|---|---|
| NFR-UX-01 | Mọi P0 flow dùng được ở viewport 320 px, không có horizontal scroll không chủ ý. |
| NFR-UX-02 | Form có label, instruction, inline error và focus chuyển đến lỗi đầu tiên. |
| NFR-UX-03 | Keyboard-only sử dụng được; modal có focus trap, Escape close và trả focus về trigger. |
| NFR-UX-04 | Status không chỉ dùng màu; contrast và semantic đáp ứng WCAG 2.2 AA cho flow P0. |
| NFR-UX-05 | Không dùng browser prompt/confirm cho flow nghiệp vụ P0; dùng dialog/form có validation. |
| NFR-UX-06 | UI có loading, empty, success, retry và recoverable error state. |

### 9.6 Quality gates

| Code | Requirement |
|---|---|
| NFR-TST-01 | 100% acceptance P0 có automated integration hoặc E2E test. |
| NFR-TST-02 | Backend overall line ≥ 85%, branch ≥ 75%; auth/access/payment/booking branch ≥ 80%. |
| NFR-TST-03 | Có frontend component test cho form/state quan trọng và browser E2E cho Customer, Technician, Admin. |
| NFR-TST-04 | Có concurrency test cho idempotency, accept quote, transition và webhook duplicate. |
| NFR-TST-05 | Có accessibility scan tự động và manual keyboard/screen-reader smoke test. |
| NFR-TST-06 | Build, lint/type or static check, test, audit, migration check và documentation check phải đạt trong CI. |

## 10. Acceptance suite P0

### 10.1 Authentication và privacy

| ID | Given / When | Then |
|---|---|---|
| AC-AUTH-01 | Email mới đăng ký dữ liệu hợp lệ | Account Customer và verification được tạo |
| AC-AUTH-02 | Forgot với email tồn tại và không tồn tại | Cùng 202, cùng schema/message; không có reset token |
| AC-AUTH-03 | Reset token hợp lệ dùng hai lần | Lần đầu thành công, lần hai RESET_TOKEN_INVALID |
| AC-AUTH-04 | Password reset/change thành công | Token/session cũ bị thu hồi |
| AC-AUTH-05 | User bị lock rồi unlock | Token trước lock vẫn không hợp lệ |
| AC-PRI-01 | Technician phù hợp xem opportunity | Chỉ thấy ward/district/city, không exact address/name/phone |
| AC-PRI-02 | Technician ngoài service area | Không nhận opportunity |
| AC-PRI-03 | Technician không assigned gọi booking/request exact detail | 404/403 và không lộ PII |
| AC-PRI-04 | Assigned Technician sau booking | Nhận exact address/contact đúng scope |

### 10.2 Request, quotation và booking

| ID | Given / When | Then |
|---|---|---|
| AC-REQ-01 | Customer B dùng addressId của Customer A | 404/403, không tạo request |
| AC-REQ-02 | Retry cùng idempotency key và cùng payload, kể cả concurrent | Một resource, mọi caller nhận cùng kết quả |
| AC-REQ-03 | Dùng lại key với payload khác | 409 IDEMPOTENCY_KEY_REUSED |
| AC-REQ-04 | Update request sau khi đã có quote | Conflict theo policy |
| AC-MED-01 | Upload file sai MIME/quá size/malware | Reject và không cấp read URL |
| AC-QUO-01 | Hai Customer/concurrent command accept quote | Chỉ một booking/accepted quote |
| AC-QUO-02 | Customer reject một quote | Quote REJECTED, quote khác không đổi |
| AC-BOK-01 | Technician từ CONFIRMED gửi COMPLETED | Conflict vì bỏ state |
| AC-BOK-02 | Technician hoàn tất công việc | AWAITING_CUSTOMER_CONFIRMATION, chưa COMPLETED |
| AC-BOK-03 | Customer dispute completion | Booking DISPUTED và complaint được tạo |
| AC-BOK-04 | Admin override | Reason, before/after và AuditLog cùng commit |
| AC-BOK-05 | Customer hủy sau ON_THE_WAY | Không hủy trực tiếp; tạo cancellation review |

### 10.3 Payment, review, complaint và audit

| ID | Given / When | Then |
|---|---|---|
| AC-PAY-01 | Browser redirect báo success nhưng chưa có webhook | Payment không PAID |
| AC-PAY-02 | Webhook signature sai/amount sai | Reject, không đổi payment, có security metric |
| AC-PAY-03 | Provider retry cùng event | Một state change, response idempotent |
| AC-PAY-04 | Refund partial được duyệt | Chỉ cập nhật sau provider confirmation và commission recalculated |
| AC-PAY-05 | Production cấu hình MOCK_CARD | Startup/config validation thất bại |
| AC-REV-01 | User không sở hữu booking tạo/update/delete review | 404/403 |
| AC-CMP-01 | Customer/Technician xem complaint ngoài scope | 404/403 |
| AC-CMP-02 | Complaint quá SLA | Alert và escalation được tạo |
| AC-ADM-01 | Admin lock/approve/service/booking/payment/review/complaint action | Audit có actor, reason, before/after, requestId |
| AC-NOT-01 | User mark notification của account khác | 404 |

### 10.4 NFR và release

| ID | Given / When | Then |
|---|---|---|
| AC-NFR-01 | Load test theo workload mục 9.1 | Đạt latency/error rate target |
| AC-NFR-02 | Restore drill từ backup production-like | Đạt RPO/RTO, có report |
| AC-NFR-03 | Log sample từ P0 flow | Có requestId, structured và không có secret/PII cấm |
| AC-NFR-04 | Automated authorization suite | Mọi resource P0 có happy và negative role/ownership test |
| AC-NFR-05 | Browser E2E ở 320 px và desktop | Customer/Technician/Admin P0 flow hoàn tất |
| AC-NFR-06 | Dependency/SAST/secret scan | Không có blocker chưa được phê duyệt |

## 11. Remediation matrix từ hệ thống hiện tại

Phần này là informative tracking nhưng exit criteria là release gate bắt buộc.

| Gap | Priority | Điểm yếu hiện tại | Requirement khắc phục | Exit criteria |
|---|---:|---|---|---|
| GAP-001 | P0 | Opportunity lộ exact address và không lọc area | BR-PRI-02/03/04, UC-MAT-01 | Privacy tests AC-PRI-01..04 đạt |
| GAP-002 | P0 | Reset token có thể xuất hiện trong API response | BR-ACC-05/06, UC-AUTH-04 | API không trả token ở mọi env; mail sink riêng |
| GAP-003 | P0 | SRS phân mảnh V0.1/V0.2 | Mục 0 | V0.3 được phê duyệt và là nguồn chuẩn duy nhất |
| GAP-004 | P0 | 54 UC cũ thiếu priority/acceptance/trace | Mục 3 và 10 | Mỗi UC có owner, priority, API/UI/test link |
| GAP-005 | P0 | Thiếu update profile/chuyên môn/vùng thợ | UC-TEC-02/03 | API, UI, ownership/audit test đạt |
| GAP-006 | P0 | Thiếu service detail, request update, reject quote | UC-SVC-03, UC-REQ-04, UC-QUO-04 | API/UI/integration test đạt |
| GAP-007 | P0 | Completion do Technician quyết định một bước | BR-BOK-02..04, UC-BOK-05 | Customer confirmation/dispute/timeout đạt |
| GAP-008 | P0 | Admin booking update không override/audit đúng contract | BR-BOK-07, UC-ADM-06 | Atomic audit test AC-BOK-04 đạt |
| GAP-009 | P0 | Payment chỉ mock, thiếu webhook/refund/reconciliation | BR-PAY-01..10, UC-PAY-01..05 | Sandbox provider E2E và AC-PAY đạt |
| GAP-010 | P0 | Idempotency không bind payload/concurrency | Mục 6.2 | Same/different payload và concurrency test đạt |
| GAP-011 | P0 | Side effect notification có thể lệch transaction | BR-NOT-02, mục 6.3 | Transactional outbox và replay test đạt |
| GAP-012 | P0 | Complaint Customer/Technician view và SLA chưa đủ | BR-CMP-01..05, UC-CMP-02..04 | Timeline/scope/SLA test đạt |
| GAP-013 | P1 | Review update/delete thiếu | UC-REV-03/04 | UI/API/rating recalculation test đạt |
| GAP-014 | P0 | UI thiếu cancel booking, complaint, notification read và nhiều Admin flow | UC-BOK-04, UC-CMP-01/02, UC-NOT-02, UC-ADM-* | Browser E2E theo role đạt |
| GAP-015 | P0 | Admin access matrix và code chưa đồng nhất | Mục 8, BR-AUD-* | Matrix test tự động cho mọi P0 resource |
| GAP-016 | P0 | Query/path/header validation chưa đồng nhất | NFR-SEC-03 | Schema coverage test và invalid-input suite đạt |
| GAP-017 | P0 | Log chưa structured, không request ID | NFR-OBS-* | AC-NFR-03 và alert smoke test đạt |
| GAP-018 | P0 | Chưa có performance/backup/restore evidence | NFR-PERF-*, NFR-REL-* | Load report và restore drill được phê duyệt |
| GAP-019 | P0 | Chỉ có ít test và branch coverage thấp | NFR-TST-* | Coverage gate và E2E/concurrency suite đạt |
| GAP-020 | P0 | Media/email/map chưa có production contract | Mục 7 | Adapter, failure/retry/privacy tests đạt |
| GAP-021 | P0 | Policy hủy/commission/refund/warranty/SLA còn mở | Mục 2.6..2.8 | PolicyVersion seed và PO sign-off |
| GAP-022 | P0 | Chưa có privacy retention/deletion | BR-PRI-08, mục 6.4 | Lifecycle/anonymization job và test đạt |
| GAP-023 | P1 | Modal/prompt và accessibility chưa đạt | NFR-UX-* | A11y automation + manual smoke đạt |
| GAP-024 | P0 | Version package/README/SRS/UI không đồng nhất | Mục 12 | Một release version xuất hiện nhất quán |
| GAP-025 | P0 | Access token dài hạn lưu localStorage, chưa có refresh rotation/reuse detection | BR-ACC-10, UC-AUTH-07, NFR-SEC-06 | Session security tests và browser storage review đạt |

## 12. Traceability và release governance

### 12.1 Traceability record bắt buộc

Mỗi UC phải có một record:

| Field | Nội dung |
|---|---|
| Requirement | UC/BR/NFR ID |
| API | Method + versioned endpoint hoặc N/A |
| UI | Screen/component hoặc N/A |
| Data | Entity/index/migration bị ảnh hưởng |
| Test | Unit/integration/E2E/performance test ID |
| Owner | Product + engineering owner |
| Status | Not started / In progress / Implemented / Verified |
| Evidence | CI run, report hoặc screenshot phù hợp |

Không được đánh dấu Done chỉ vì endpoint tồn tại.

### 12.2 Definition of Done

Một UC chỉ Done khi:

- Business rule, priority và acceptance đã được phê duyệt.
- API có validation cho body/path/query/header, auth, role, ownership và error contract.
- Response dùng DTO và privacy scope phù hợp.
- UI có loading, empty, success, error/retry và accessibility behavior.
- Happy path, validation, negative ownership/role, state conflict và concurrency quan trọng có test.
- Audit/outbox/idempotency được áp dụng khi requirement yêu cầu.
- API, data model, access matrix và traceability được cập nhật.
- Build, quality gates và dependency/security checks đạt.

### 12.3 Production release gates

| Gate | Điều kiện |
|---|---|
| RG-01 Requirements | Không còn quyết định nghiệp vụ P0 chưa chốt; SRS V0.3 được PO/Tech/Security ký |
| RG-02 Functional | Tất cả UC P0 Implemented và Verified |
| RG-03 Security/Privacy | AC-AUTH, AC-PRI, authorization suite, scan và secret review đạt |
| RG-04 Payment | Provider sandbox E2E, webhook, refund, reconciliation và mock-production guard đạt |
| RG-05 Reliability | Load test, backup/restore, outbox/job retry và readiness đạt |
| RG-06 UX | Browser E2E role chính, 320 px và accessibility smoke đạt |
| RG-07 Operations | Dashboard, alert, runbook, incident owner và rollback plan sẵn sàng |
| RG-08 Documentation | README, API, ERD, architecture, UI footer và package dùng cùng version |

Production release bị chặn nếu bất kỳ RG nào chưa đạt hoặc có P0 gap chưa được đóng. Risk acceptance không được dùng để bỏ qua lỗi lộ PII, payment integrity, authorization hoặc backup restore.

## 13. Giả định đã chốt

- Currency duy nhất là VND.
- Timezone hiển thị mặc định Asia/Ho_Chi_Minh; dữ liệu lưu UTC.
- Một account có một role hoạt động tại một thời điểm trong V0.3; lịch sử role được audit.
- Commission mặc định 15%, cancellation fee mặc định 20% cap 200.000 VND và labor warranty 30 ngày là baseline cấu hình, có thể thay đổi bằng PolicyVersion sau PO approval.
- Provider cụ thể được chọn qua adapter; SRS không phụ thuộc vendor.
- MongoDB production dùng replica set tối thiểu ba member hoặc managed service tương đương.
- HTTPS, secret manager, object storage private, email provider và monitoring là dependency production bắt buộc.

## 14. Version history

| Version | Date | Nội dung |
|---|---|---|
| 0.1 | 28/08/2026 | Draft phạm vi, actor, module và use case ban đầu |
| 0.2 | 29/08/2026 | Bổ sung business rule, access control, NFR và acceptance P0 |
| 0.3 | 29/08/2026 | Hợp nhất baseline; xử lý privacy, recovery, UC gaps, payment/refund/commission, completion, idempotency, audit, observability, recovery, test và release gates |
