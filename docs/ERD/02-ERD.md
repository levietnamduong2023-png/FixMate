# ERD FixMate V0.2

SRS V0.1 chỉ liệt kê entity dự kiến. ERD dưới đây phản ánh trực tiếp các Mongoose schema đã triển khai.

```mermaid
erDiagram
    USER ||--o| TECHNICIAN_PROFILE : owns
    USER ||--o{ REPAIR_REQUEST : creates
    USER ||--o{ ADDRESS : owns
    USER ||--o{ PASSWORD_RESET_TOKEN : receives
    USER ||--o{ QUOTATION : sends
    USER ||--o{ BOOKING : customer
    USER ||--o{ BOOKING : technician
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ AUDIT_LOG : performs
    SERVICE ||--o{ REPAIR_REQUEST : classifies
    SERVICE }o--o{ TECHNICIAN_PROFILE : expertise
    ADDRESS ||--o{ REPAIR_REQUEST : snapshot_source
    REPAIR_REQUEST ||--o{ QUOTATION : receives
    REPAIR_REQUEST ||--o| BOOKING : produces
    QUOTATION ||--o| BOOKING : accepted_as
    BOOKING ||--o| PAYMENT : paid_by
    BOOKING ||--o| REVIEW : reviewed_by
    BOOKING ||--o{ COMPLAINT : concerns
    USER ||--o{ REVIEW : writes
    USER ||--o{ COMPLAINT : files

    USER {
      ObjectId _id PK
      string email UK
      string passwordHash
      string name
      string phone
      enum role
      enum status
      number authVersion
      datetime createdAt
      datetime updatedAt
    }

    SERVICE {
      ObjectId _id PK
      string name UK
      string description
      number basePrice
      boolean isActive
    }

    TECHNICIAN_PROFILE {
      ObjectId _id PK
      ObjectId user FK,UK
      ObjectId[] serviceIds FK
      number experienceYears
      string bio
      string area
      enum approvalStatus
      boolean acceptingJobs
      number ratingAverage
      number ratingCount
    }

    REPAIR_REQUEST {
      ObjectId _id PK
      ObjectId customer FK
      ObjectId service FK
      string description
      string address
      ObjectId addressRef FK
      datetime desiredAt
      enum status
      string idempotencyKey UK
    }

    ADDRESS {
      ObjectId _id PK
      ObjectId user FK
      string label
      string recipientName
      string phone
      string line1
      string ward
      string district
      string city
      number latitude
      number longitude
      boolean isDefault
    }

    PASSWORD_RESET_TOKEN {
      ObjectId _id PK
      ObjectId user FK
      string tokenHash UK
      datetime expiresAt TTL
      datetime usedAt
    }

    QUOTATION {
      ObjectId _id PK
      ObjectId request FK
      ObjectId technician FK
      number amount
      string note
      enum status
      datetime validUntil
    }

    BOOKING {
      ObjectId _id PK
      ObjectId request FK,UK
      ObjectId quotation FK,UK
      ObjectId customer FK
      ObjectId technician FK
      number amount
      enum status
    }

    PAYMENT {
      ObjectId _id PK
      ObjectId booking FK,UK
      ObjectId customer FK
      number amount
      enum method
      enum status
      string idempotencyKey UK
      datetime paidAt
    }

    REVIEW {
      ObjectId _id PK
      ObjectId booking FK,UK
      ObjectId customer FK
      ObjectId technician FK
      number rating
      string comment
      enum status
    }

    COMPLAINT {
      ObjectId _id PK
      ObjectId booking FK
      ObjectId customer FK
      string subject
      string detail
      enum status
      string resolution
    }

    NOTIFICATION {
      ObjectId _id PK
      ObjectId user FK
      string type
      string title
      string message
      string entityType
      ObjectId entityId
      boolean isRead
    }

    AUDIT_LOG {
      ObjectId _id PK
      ObjectId actor FK
      string action
      string entityType
      ObjectId entityId
      object detail
      datetime createdAt
    }
```

## Unique constraints quan trọng

| Collection | Unique key | Mục đích |
|---|---|---|
| `users` | `email` | Không trùng tài khoản |
| `addresses` | partial `user + isDefault=true` | Tối đa một địa chỉ mặc định/account |
| `passwordresettokens` | `tokenHash`, TTL `expiresAt` | Token duy nhất và tự xóa khi hết hạn |
| `technicianprofiles` | `user` | Một hồ sơ thợ/tài khoản |
| `repairrequests` | `customer + idempotencyKey` | Không tạo yêu cầu lặp |
| `quotations` | `request + technician` | Một báo giá/thợ/yêu cầu |
| `bookings` | `request`, `quotation` | Chỉ một booking được tạo |
| `payments` | `booking`; `customer + idempotencyKey` | Một payment/booking, chống submit lặp |
| `reviews` | `booking` | Một đánh giá/đơn |

## State models

```text
RepairRequest: PENDING → MATCHING → QUOTED → BOOKED → IN_PROGRESS → COMPLETED
               └───────────────────────────────→ CANCELLED

Booking: CONFIRMED → TECHNICIAN_ON_THE_WAY → IN_PROGRESS → COMPLETED
         └──────────────────────────────────────────────→ CANCELLED

Complaint: PENDING → PROCESSING → RESOLVED | REJECTED
```
