# Access-control matrix FixMate V0.2

Ký hiệu: `Own` là tài nguyên thuộc account hiện tại; `Assigned` là Technician được gán cho Booking; `All` là toàn hệ thống.

| Resource / Action | Guest | Customer | Technician | Admin |
|---|---|---|---|---|
| Service: list/detail | All active | All active | All active | All |
| Service: create/update/deactivate | — | — | — | All + audit |
| TechnicianProfile: public view | Approved | Approved | Approved | All |
| TechnicianProfile: apply | — | Own | — | — |
| TechnicianProfile: update/skills | — | Own pending | Own | All + audit |
| TechnicianProfile: approve/reject | — | — | — | All + audit |
| User profile: view/update | — | Own | Own | View all; status update + audit |
| Address: CRUD/default | — | Own | Own account | — |
| RepairRequest: create | — | Own | — | — |
| RepairRequest: list/detail | — | Own | Quoted/matched scope | All |
| RepairRequest: update/cancel | — | Own + valid state | — | Override + audit |
| Quotation: create | — | — | Own + approved + matching skill | — |
| Quotation: list | — | Request owner | Own | All |
| Quotation: accept/reject | — | Request owner + valid state | — | — |
| Booking: list/detail | — | Own | Assigned | All |
| Booking: state update | — | Cancel Own CONFIRMED | Assigned + valid transition | Override + audit |
| Payment: create/list | — | Own booking | Read assigned summary | All |
| Review: create/update/delete | Read visible | Own completed booking | Read received | Moderate + audit |
| Complaint: create/list | — | Own booking / Own complaints | Assigned read when required | All + resolve + audit |
| Notification: list/read | — | Own | Own | Own |
| AuditLog: list | — | — | — | All |

## Enforcement checklist

- JWT middleware luôn tải lại User và kiểm tra `status`, `role`, `authVersion`.
- Query update/delete phải bao gồm owner trong filter, không chỉ kiểm tra ID từ client.
- Resource không thuộc owner ưu tiên trả `404` khi cần tránh enumeration.
- Admin override phải có AuditLog gồm actor, action, entity và detail tối thiểu.
- Automated integration test phải có ít nhất một negative ownership test cho mỗi resource P0.
