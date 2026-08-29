# SOFTWARE REQUIREMENT SPECIFICATION

# Nền tảng kết nối khách hàng với dịch vụ sửa chữa tại nhà

**Document:** Software Requirement Specification  
**Version:** 0.1  
**Status:** Draft  
**Project:** Home Repair Service Platform  FIXMATE
**Date:** 28/08/2026

---

# 1. Introduction

## 1.1 Purpose

Tài liệu SRS mô tả các yêu cầu phần mềm của **Nền tảng kết nối khách hàng với dịch vụ sửa chữa tại nhà**.

Hệ thống nhằm kết nối khách hàng có nhu cầu sửa chữa với các thợ sửa chữa phù hợp, hỗ trợ khách hàng tạo yêu cầu, tìm kiếm và lựa chọn thợ, quản lý đơn sửa chữa, theo dõi trạng thái xử lý, thanh toán và đánh giá dịch vụ.

Tài liệu này làm cơ sở cho phân tích yêu cầu, thiết kế hệ thống, thiết kế cơ sở dữ liệu, phát triển, xây dựng Test Case và kiểm thử.

## 1.2 Overview

### 1.2.1 Actors and Roles

| Actor | Role |
|---|---|
| **Guest** | Người chưa đăng nhập; có thể xem dịch vụ, đăng ký và đăng nhập. |
| **User** | Tạo yêu cầu, lựa chọn thợ, quản lý đơn, thanh toán và đánh giá. |
| **Technician** | Quản lý hồ sơ, chuyên môn, nhận yêu cầu, báo giá và thực hiện đơn. |
| **Admin** | Quản lý tài khoản, thợ, dịch vụ, đơn, đánh giá và khiếu nại. |
| **Payment Service** | Hỗ trợ xử lý giao dịch thanh toán. |
| **Map Service** | Hỗ trợ xác định và hiển thị vị trí. |
| **Notification Service** | Hỗ trợ gửi thông báo. |

### 1.2.2 System Modules

| # | Module | Mô tả |
|---|---|---|
| 1 | Tài khoản và xác thực | Đăng ký, đăng nhập, đăng xuất, quản lý mật khẩu. |
| 2 | Hồ sơ khách hàng | Quản lý thông tin cá nhân và địa chỉ. |
| 3 | Hồ sơ thợ | Quản lý thông tin, chuyên môn, kinh nghiệm và trạng thái. |
| 4 | Quản lý dịch vụ | Quản lý các nhóm dịch vụ sửa chữa. |
| 5 | Yêu cầu sửa chữa | Tạo và quản lý yêu cầu sửa chữa. |
| 6 | Tìm kiếm và lựa chọn thợ | Tìm kiếm, lọc và lựa chọn thợ. |
| 7 | Báo giá | Thợ gửi báo giá cho yêu cầu. |
| 8 | Đơn sửa chữa | Quản lý quá trình từ nhận đơn đến hoàn thành. |
| 9 | Thanh toán | Xử lý và ghi nhận thanh toán. |
| 10 | Đánh giá | Khách hàng đánh giá dịch vụ và thợ. |
| 11 | Khiếu nại | Tiếp nhận và xử lý khiếu nại. |
| 12 | Thông báo | Gửi thông báo về yêu cầu và đơn. |
| 13 | Quản trị hệ thống | Quản lý dữ liệu và hoạt động hệ thống. |

## 1.3 Intended Audience and Reading Suggestions

Tài liệu hướng đến thành viên nhóm phát triển, giảng viên, người phân tích, thiết kế, lập trình và kiểm thử.

Thứ tự đề xuất:
1. Introduction
2. High Level Requirements
3. Use Case Specifications
4. Mockups
5. Non-functional Requirements

## 1.4 Abbreviations

| Acronym | Meaning |
|---|---|
| SRS | Software Requirement Specification |
| UC | Use Case |
| BR | Business Rule |
| ERD | Entity Relationship Diagram |
| API | Application Programming Interface |
| UI | User Interface |
| PK | Primary Key |
| FK | Foreign Key |
| OTP | One-Time Password |

## 1.5 References

| # | Reference |
|---|---|
| 1 | Requirement Outline của dự án |
| 2 | Quy định và hướng dẫn đồ án môn Công nghệ phần mềm |
| 3 | Tài liệu SRS mẫu của dự án HueTrip |

---

# 2. High Level Requirements

## 2.1 Entity Relationship Diagram

### 2.1.1 Các thực thể chính dự kiến

```text
User
CustomerProfile
TechnicianProfile
ServiceCategory
Service
Address
RepairRequest
Quotation
Booking
Payment
Review
Complaint
Notification
```

Quan hệ tổng quát:

```text
User
 ├── CustomerProfile
 └── TechnicianProfile

ServiceCategory
 └── Service

Customer
 └── RepairRequest
       ├── Address
       ├── Quotation
       └── Booking
             ├── Payment
             └── Review

Technician
 └── Quotation

Booking
 └── Complaint

User
 └── Notification
```

> ERD chi tiết sẽ được hoàn thiện sau khi thống nhất nghiệp vụ.

## 2.2 Workflow

### 2.2.1 Tài khoản và xác thực

```text
Guest
  ↓
Đăng ký
  ↓
Tài khoản được tạo
  ↓
Đăng nhập
  ↓
Truy cập hệ thống
```

### 2.2.2 Tạo yêu cầu sửa chữa

```text
Customer
  ↓
Chọn loại dịch vụ
  ↓
Nhập mô tả vấn đề
  ↓
Chọn địa chỉ
  ↓
Chọn thời gian mong muốn
  ↓
Thêm hình ảnh nếu cần
  ↓
Gửi yêu cầu
  ↓
Repair Request = PENDING
```

### 2.2.3 Tìm và lựa chọn thợ

```text
Repair Request
      ↓
Hệ thống tìm thợ phù hợp
      ↓
Customer xem danh sách thợ
      ↓
Xem hồ sơ / đánh giá / chuyên môn
      ↓
Nhận báo giá
      ↓
Customer lựa chọn thợ
```

### 2.2.4 Thực hiện đơn sửa chữa

```text
Booking
   ↓
CONFIRMED
   ↓
TECHNICIAN_ON_THE_WAY
   ↓
IN_PROGRESS
   ↓
COMPLETED
   ↓
Payment
   ↓
Review
```

### 2.2.5 Khiếu nại

```text
Customer
   ↓
Gửi khiếu nại
   ↓
Complaint = PENDING
   ↓
Admin tiếp nhận
   ↓
Xử lý
   ↓
RESOLVED / REJECTED
```

## 2.3 State Transition Diagram

### 2.3.1 Repair Request

```text
PENDING
   ↓
MATCHING
   ↓
QUOTED
   ↓
BOOKED
   ↓
IN_PROGRESS
   ↓
COMPLETED
```

Có thể hủy:

```text
PENDING ─────→ CANCELLED
MATCHING ────→ CANCELLED
QUOTED ──────→ CANCELLED
BOOKED ──────→ CANCELLED
```

### 2.3.2 Booking

```text
PENDING
   ↓
CONFIRMED
   ↓
TECHNICIAN_ON_THE_WAY
   ↓
IN_PROGRESS
   ↓
COMPLETED
```

Hoặc:

```text
PENDING → REJECTED
PENDING → CANCELLED
CONFIRMED → CANCELLED
```

### 2.3.3 Payment

```text
PENDING
   ↓
PROCESSING
   ↓
PAID
```

Hoặc:

```text
PROCESSING → FAILED
```

### 2.3.4 Review

```text
CREATED
   ↓
VISIBLE

VISIBLE → HIDDEN
HIDDEN  → VISIBLE
```

## 2.4 Use Case Diagram

### 2.4.1 Tổng quan Actor

```text
                  ┌───────────────────────┐
                  │        System         │
                  │                       │
 Customer ───────→│  Repair Service       │
 Technician ─────→│  Platform             │
 Admin ──────────→│                       │
 Guest ──────────→│                       │
                  └───────────────────────┘

 Payment Service ─────→ Payment
 Map Service ─────────→ Location
 Notification Service → Notification
```

### 2.4.2 Danh sách Use Case dự kiến

#### Tài khoản và xác thực

| UC Code | UC Name |
|---|---|
| UC-AUTH-01 | Đăng ký tài khoản |
| UC-AUTH-02 | Đăng nhập |
| UC-AUTH-03 | Đăng xuất |
| UC-AUTH-04 | Quên mật khẩu |
| UC-AUTH-05 | Đổi mật khẩu |

#### Hồ sơ cá nhân

| UC Code | UC Name |
|---|---|
| UC-PRO-01 | Xem hồ sơ |
| UC-PRO-02 | Cập nhật hồ sơ |
| UC-PRO-03 | Quản lý địa chỉ |

#### Hồ sơ thợ

| UC Code | UC Name |
|---|---|
| UC-TEC-01 | Đăng ký làm thợ |
| UC-TEC-02 | Cập nhật hồ sơ thợ |
| UC-TEC-03 | Quản lý chuyên môn |
| UC-TEC-04 | Xem trạng thái hồ sơ |
| UC-TEC-05 | Bật/tắt trạng thái nhận đơn |

#### Dịch vụ

| UC Code | UC Name |
|---|---|
| UC-SVC-01 | Xem danh sách dịch vụ |
| UC-SVC-02 | Tìm kiếm dịch vụ |
| UC-SVC-03 | Xem chi tiết dịch vụ |

#### Yêu cầu sửa chữa

| UC Code | UC Name |
|---|---|
| UC-REQ-01 | Tạo yêu cầu sửa chữa |
| UC-REQ-02 | Xem yêu cầu của tôi |
| UC-REQ-03 | Xem chi tiết yêu cầu |
| UC-REQ-04 | Cập nhật yêu cầu |
| UC-REQ-05 | Hủy yêu cầu |

#### Tìm kiếm thợ

| UC Code | UC Name |
|---|---|
| UC-FND-01 | Tìm kiếm thợ |
| UC-FND-02 | Lọc thợ |
| UC-FND-03 | Xem hồ sơ thợ |
| UC-FND-04 | Xem đánh giá của thợ |

#### Báo giá

| UC Code | UC Name |
|---|---|
| UC-QUO-01 | Gửi báo giá |
| UC-QUO-02 | Xem báo giá |
| UC-QUO-03 | Chấp nhận báo giá |
| UC-QUO-04 | Từ chối báo giá |

#### Đơn sửa chữa

| UC Code | UC Name |
|---|---|
| UC-BOK-01 | Tạo đơn sửa chữa |
| UC-BOK-02 | Xem đơn sửa chữa |
| UC-BOK-03 | Cập nhật trạng thái đơn |
| UC-BOK-04 | Hủy đơn |
| UC-BOK-05 | Xác nhận hoàn thành |

#### Thanh toán

| UC Code | UC Name |
|---|---|
| UC-PAY-01 | Tạo giao dịch thanh toán |
| UC-PAY-02 | Xử lý thanh toán |
| UC-PAY-03 | Xem lịch sử thanh toán |

#### Đánh giá

| UC Code | UC Name |
|---|---|
| UC-REV-01 | Xem đánh giá |
| UC-REV-02 | Đánh giá thợ |
| UC-REV-03 | Cập nhật đánh giá |
| UC-REV-04 | Xóa đánh giá |

#### Khiếu nại

| UC Code | UC Name |
|---|---|
| UC-CMP-01 | Gửi khiếu nại |
| UC-CMP-02 | Xem khiếu nại |
| UC-CMP-03 | Xử lý khiếu nại |

#### Thông báo

| UC Code | UC Name |
|---|---|
| UC-NOT-01 | Xem thông báo |
| UC-NOT-02 | Đánh dấu đã đọc |

#### Quản trị

| UC Code | UC Name |
|---|---|
| UC-ADM-01 | Tra cứu người dùng |
| UC-ADM-02 | Khóa tài khoản |
| UC-ADM-03 | Mở khóa tài khoản |
| UC-ADM-04 | Duyệt hồ sơ thợ |
| UC-ADM-05 | Quản lý dịch vụ |
| UC-ADM-06 | Quản lý đơn sửa chữa |
| UC-ADM-07 | Quản lý đánh giá |
| UC-ADM-08 | Quản lý khiếu nại |

---

# 3. Use Case Specifications

> Phần này là đặc tả sơ bộ của v0.1. Business Rule và điều kiện chi tiết sẽ được review ở các phiên bản sau.

## 3.1 Tài khoản, xác thực và hồ sơ

### 3.1.1 UC-AUTH-01: Đăng ký tài khoản

**Objective:** Tạo tài khoản mới.

**Actor:** Guest

**Trigger:** Guest chọn chức năng đăng ký.

**Pre-condition:**
- Người dùng chưa đăng nhập.
- Email chưa được sử dụng.

**Post-condition:**
- Tài khoản mới được tạo.
- Tài khoản có thể đăng nhập.

**Activities Flow:**

| Step | Actor | Description |
|---|---|---|
| 1 | Guest | Chọn đăng ký |
| 2 | Guest | Nhập thông tin tài khoản |
| 3 | System | Kiểm tra dữ liệu |
| 4 | System | Kiểm tra email tồn tại |
| 5 | System | Tạo tài khoản |
| 6 | System | Thông báo thành công |

**Business Rules:**

| Code | Description |
|---|---|
| BR-AUTH-01 | Email phải hợp lệ. |
| BR-AUTH-02 | Email không được trùng tài khoản. |
| BR-AUTH-03 | Mật khẩu phải đáp ứng yêu cầu bảo mật. |

### 3.1.2 UC-AUTH-02: Đăng nhập

**Objective:** Xác thực tài khoản.

**Actor:** Guest

**Trigger:** Guest nhập thông tin đăng nhập.

**Pre-condition:**
- Tài khoản tồn tại.
- Tài khoản không bị khóa.

**Post-condition:**
- Người dùng đăng nhập thành công.
- Hệ thống tạo phiên đăng nhập.

**Activities Flow:**

```text
Guest
 ↓
Nhập email + mật khẩu
 ↓
System kiểm tra
 ↓
Thông tin hợp lệ?
 ├── Không → Hiển thị lỗi
 └── Có → Đăng nhập thành công
```

### 3.1.3 UC-AUTH-03: Đăng xuất

**Objective:** Kết thúc phiên đăng nhập.

**Actor:** Customer, Technician, Admin

**Trigger:** Người dùng chọn đăng xuất.

**Pre-condition:** Người dùng đang đăng nhập.

**Post-condition:** Phiên đăng nhập được kết thúc.

## 3.2 Hồ sơ thợ sửa chữa

### 3.2.1 UC-TEC-01: Đăng ký làm thợ

**Objective:** Cho phép người dùng đăng ký trở thành thợ sửa chữa.

**Actor:** Customer

**Trigger:** Người dùng chọn đăng ký làm thợ.

**Pre-condition:** Người dùng đã đăng nhập.

**Post-condition:**
- Hồ sơ thợ được tạo.
- Hồ sơ ở trạng thái chờ xét duyệt.

**Activities Flow:**

| Step | Actor | Description |
|---|---|---|
| 1 | Customer | Chọn đăng ký làm thợ |
| 2 | Customer | Nhập thông tin cá nhân |
| 3 | Customer | Chọn chuyên môn |
| 4 | Customer | Nhập kinh nghiệm |
| 5 | Customer | Cung cấp thông tin xác minh |
| 6 | System | Kiểm tra dữ liệu |
| 7 | System | Tạo hồ sơ thợ |
| 8 | System | Chuyển sang trạng thái chờ duyệt |

**Business Rules:**

| Code | Description |
|---|---|
| BR-TEC-01 | Người đăng ký phải có tài khoản. |
| BR-TEC-02 | Hồ sơ phải được Admin duyệt trước khi nhận đơn. |
| BR-TEC-03 | Thợ chỉ được cung cấp dịch vụ thuộc danh mục hệ thống. |

## 3.3 Quản lý dịch vụ

### 3.3.1 UC-SVC-01: Xem danh sách dịch vụ

**Objective:** Cho phép người dùng xem các dịch vụ sửa chữa.

**Actor:** Guest, Customer, Technician

**Trigger:** Người dùng truy cập danh sách dịch vụ.

**Pre-condition:** Không yêu cầu.

**Post-condition:** Danh sách dịch vụ được hiển thị.

Ví dụ:
- Điện
- Nước
- Điều hòa
- Máy giặt
- Tủ lạnh
- Điện lạnh
- Thiết bị gia dụng

## 3.4 Yêu cầu sửa chữa

### 3.4.1 UC-REQ-01: Tạo yêu cầu sửa chữa

**Objective:** Cho phép khách hàng tạo yêu cầu sửa chữa tại nhà.

**Actor:** Customer

**Trigger:** Customer chọn “Đặt dịch vụ”.

**Pre-condition:**
- Customer đã đăng nhập.
- Tài khoản đang hoạt động.

**Post-condition:**
- Yêu cầu được tạo.
- Yêu cầu có trạng thái `PENDING`.

**Activities Flow:**

| Step | Actor | Description |
|---|---|---|
| 1 | Customer | Chọn loại dịch vụ |
| 2 | Customer | Nhập mô tả vấn đề |
| 3 | Customer | Chọn địa chỉ |
| 4 | Customer | Chọn thời gian mong muốn |
| 5 | Customer | Thêm hình ảnh nếu cần |
| 6 | Customer | Gửi yêu cầu |
| 7 | System | Kiểm tra dữ liệu |
| 8 | System | Tạo yêu cầu |
| 9 | System | Gán trạng thái `PENDING` |
| 10 | System | Thông báo thành công |

**Business Rules:**

| Code | Description |
|---|---|
| BR-REQ-01 | Customer phải đăng nhập. |
| BR-REQ-02 | Loại dịch vụ là bắt buộc. |
| BR-REQ-03 | Mô tả vấn đề là bắt buộc. |
| BR-REQ-04 | Địa chỉ sửa chữa là bắt buộc. |
| BR-REQ-05 | Thời gian yêu cầu không được nằm trong quá khứ. |
| BR-REQ-06 | Yêu cầu mới có trạng thái `PENDING`. |

### 3.4.2 UC-REQ-02: Xem yêu cầu của tôi

**Objective:** Xem các yêu cầu sửa chữa do mình tạo.

**Actor:** Customer

**Trigger:** Customer truy cập “Yêu cầu của tôi”.

**Pre-condition:** Customer đã đăng nhập.

**Post-condition:** Danh sách yêu cầu của Customer được hiển thị.

### 3.4.3 UC-REQ-05: Hủy yêu cầu

**Objective:** Hủy yêu cầu sửa chữa chưa được thực hiện.

**Actor:** Customer

**Trigger:** Customer chọn “Hủy yêu cầu”.

**Pre-condition:**
- Yêu cầu thuộc Customer hiện tại.
- Yêu cầu chưa hoàn thành.

**Post-condition:** Yêu cầu chuyển sang `CANCELLED`.

## 3.5 Tìm kiếm và lựa chọn thợ

### 3.5.1 UC-FND-01: Tìm kiếm thợ

**Objective:** Tìm các thợ phù hợp với yêu cầu.

**Actor:** Customer

**Pre-condition:** Customer đã tạo yêu cầu sửa chữa.

**Post-condition:** Danh sách thợ phù hợp được hiển thị.

Tiêu chí dự kiến:
- Loại dịch vụ.
- Vị trí.
- Khoảng cách.
- Đánh giá.
- Kinh nghiệm.
- Trạng thái đang nhận đơn.

### 3.5.2 UC-FND-03: Xem hồ sơ thợ

**Objective:** Xem thông tin của thợ trước khi lựa chọn.

**Actor:** Customer

**Post-condition:** Hiển thị thông tin như:
- Họ tên.
- Ảnh đại diện.
- Chuyên môn.
- Kinh nghiệm.
- Khu vực hoạt động.
- Đánh giá.

## 3.6 Báo giá

### 3.6.1 UC-QUO-01: Gửi báo giá

**Objective:** Cho phép Technician gửi mức giá dự kiến.

**Actor:** Technician

**Pre-condition:**
- Technician đã được Admin duyệt.
- Technician đang hoạt động.
- Yêu cầu vẫn có thể nhận báo giá.

**Post-condition:**
- Báo giá được tạo.
- Customer nhận thông báo.

### 3.6.2 UC-QUO-03: Chấp nhận báo giá

**Objective:** Cho phép Customer chấp nhận báo giá.

**Actor:** Customer

**Pre-condition:**
- Báo giá còn hiệu lực.
- Yêu cầu chưa bị hủy.

**Post-condition:**
- Báo giá được chấp nhận.
- Đơn sửa chữa được tạo.

## 3.7 Đơn sửa chữa

### 3.7.1 UC-BOK-01: Tạo đơn sửa chữa

**Objective:** Tạo đơn sau khi Customer lựa chọn báo giá.

**Actor:** Customer, System

**Pre-condition:** Customer đã chọn báo giá hợp lệ.

**Post-condition:**
- Booking được tạo.
- Technician được thông báo.

### 3.7.2 UC-BOK-03: Cập nhật trạng thái đơn

**Objective:** Cho phép Technician cập nhật tiến trình.

**Actor:** Technician

**Trạng thái dự kiến:**

```text
CONFIRMED
    ↓
TECHNICIAN_ON_THE_WAY
    ↓
IN_PROGRESS
    ↓
COMPLETED
```

### 3.7.3 UC-BOK-05: Xác nhận hoàn thành

**Objective:** Xác nhận dịch vụ đã hoàn thành.

**Actor:** Customer, Technician

**Pre-condition:** Technician đã hoàn thành công việc.

**Post-condition:**
- Đơn chuyển sang `COMPLETED`.
- Có thể thực hiện đánh giá.

## 3.8 Thanh toán

### 3.8.1 UC-PAY-01: Tạo giao dịch thanh toán

**Objective:** Tạo giao dịch thanh toán cho đơn sửa chữa.

**Actor:** Customer, Payment Service

**Pre-condition:**
- Đơn hợp lệ.
- Có số tiền cần thanh toán.

**Post-condition:** Giao dịch có trạng thái `PENDING`.

### 3.8.2 UC-PAY-02: Xử lý thanh toán

**Objective:** Xử lý giao dịch và cập nhật trạng thái.

**Flow:**

```text
PENDING
   ↓
PROCESSING
   ↓
 ┌───────────────┐
 ↓               ↓
PAID           FAILED
```

## 3.9 Đánh giá và nhận xét

### 3.9.1 UC-REV-01: Xem đánh giá

**Objective:** Xem đánh giá dành cho Technician.

**Actor:** Guest, Customer, Technician, Admin

### 3.9.2 UC-REV-02: Đánh giá thợ

**Objective:** Cho phép Customer đánh giá Technician sau khi đơn hoàn thành.

**Actor:** Customer

**Pre-condition:**
- Customer là người thực hiện đơn.
- Đơn đã hoàn thành.
- Customer chưa đánh giá đơn này.

**Post-condition:**
- Review được tạo.
- Điểm đánh giá của Technician được cập nhật.

**Business Rules:**

| Code | Description |
|---|---|
| BR-REV-01 | Chỉ được đánh giá sau khi đơn hoàn thành. |
| BR-REV-02 | Customer chỉ được đánh giá đơn thuộc tài khoản của mình. |
| BR-REV-03 | Một đơn chỉ được đánh giá theo quy định của hệ thống. |

## 3.10 Khiếu nại

### 3.10.1 UC-CMP-01: Gửi khiếu nại

**Objective:** Cho phép Customer gửi khiếu nại liên quan đến dịch vụ.

**Actor:** Customer

**Pre-condition:** Customer có đơn liên quan.

**Post-condition:**
- Khiếu nại được tạo.
- Trạng thái `PENDING`.
- Admin nhận thông báo.

### 3.10.2 UC-CMP-03: Xử lý khiếu nại

**Objective:** Cho phép Admin xử lý khiếu nại.

**Actor:** Admin

**Pre-condition:** Có khiếu nại cần xử lý.

**Post-condition:** Khiếu nại chuyển sang trạng thái phù hợp.

## 3.11 Quản trị hệ thống

### 3.11.1 UC-ADM-01: Tra cứu người dùng

**Objective:** Admin xem danh sách và thông tin tài khoản.

**Actor:** Admin

Chức năng dự kiến:
- Xem danh sách.
- Tìm kiếm.
- Lọc.
- Xem chi tiết.
- Xem trạng thái tài khoản.

### 3.11.2 UC-ADM-04: Duyệt hồ sơ thợ

**Objective:** Admin kiểm tra và phê duyệt hồ sơ thợ.

**Actor:** Admin

**Flow:**

```text
Technician đăng ký
        ↓
PENDING
        ↓
Admin kiểm tra
     ↙     ↘
 APPROVE   REJECT
    ↓
 ACTIVE
```

### 3.11.3 UC-ADM-05: Quản lý dịch vụ

**Objective:** Admin quản lý danh mục dịch vụ.

**Actor:** Admin

Có thể bao gồm:
- Thêm dịch vụ.
- Cập nhật dịch vụ.
- Xóa/ngừng cung cấp dịch vụ.
- Xem danh sách dịch vụ.

## 3.12 Thông báo

### 3.12.1 UC-NOT-01: Xem thông báo

**Objective:** Xem các thông báo liên quan đến tài khoản và đơn sửa chữa.

**Actor:** Customer, Technician, Admin

Ví dụ:
- Có thợ mới gửi báo giá.
- Báo giá đã được chấp nhận.
- Thợ đang trên đường đến.
- Đơn sửa chữa đã hoàn thành.
- Có thể đánh giá dịch vụ.
- Có khiếu nại mới cần xử lý.

---

# 4. Mockups Screen

## 4.1 Authentication

- Đăng ký.
- Đăng nhập.
- Quên mật khẩu.
- Đổi mật khẩu.

## 4.2 Customer

- Trang chủ.
- Danh sách dịch vụ.
- Tìm kiếm thợ.
- Chi tiết thợ.
- Tạo yêu cầu sửa chữa.
- Yêu cầu của tôi.
- Chi tiết yêu cầu.
- Danh sách báo giá.
- Đơn sửa chữa.
- Thanh toán.
- Lịch sử thanh toán.
- Đánh giá.
- Khiếu nại.
- Thông báo.
- Hồ sơ cá nhân.

## 4.3 Technician

- Dashboard.
- Hồ sơ thợ.
- Chuyên môn.
- Yêu cầu phù hợp.
- Chi tiết yêu cầu.
- Gửi báo giá.
- Đơn đang thực hiện.
- Lịch sử đơn.
- Doanh thu.
- Đánh giá.
- Thông báo.

## 4.4 Admin

- Dashboard.
- Quản lý người dùng.
- Quản lý thợ.
- Duyệt hồ sơ thợ.
- Quản lý dịch vụ.
- Quản lý yêu cầu.
- Quản lý đơn.
- Quản lý thanh toán.
- Quản lý đánh giá.
- Quản lý khiếu nại.

---

# 5. Appendices

## 5.1 Messages List

| Code | Message |
|---|---|
| MSG-AUTH-001 | Đăng ký tài khoản thành công. |
| MSG-AUTH-002 | Email hoặc mật khẩu không chính xác. |
| MSG-AUTH-003 | Tài khoản đã bị khóa. |
| MSG-REQ-001 | Tạo yêu cầu sửa chữa thành công. |
| MSG-REQ-002 | Không thể tạo yêu cầu sửa chữa. |
| MSG-REQ-003 | Yêu cầu đã được hủy. |
| MSG-QUO-001 | Gửi báo giá thành công. |
| MSG-QUO-002 | Báo giá đã được chấp nhận. |
| MSG-BOK-001 | Đặt dịch vụ thành công. |
| MSG-BOK-002 | Đơn sửa chữa đã được hoàn thành. |
| MSG-PAY-001 | Thanh toán thành công. |
| MSG-PAY-002 | Thanh toán thất bại. |
| MSG-REV-001 | Đánh giá thành công. |
| MSG-CMP-001 | Gửi khiếu nại thành công. |
| MSG-ADM-001 | Hồ sơ thợ đã được duyệt. |
| MSG-ADM-002 | Hồ sơ thợ đã bị từ chối. |

---

# 6. NON-FUNCTIONAL REQUIREMENTS AND OTHERS

## 6.1 Performance

- Các thao tác thông thường cần phản hồi trong thời gian hợp lý.
- Danh sách dữ liệu cần hỗ trợ phân trang khi số lượng bản ghi lớn.
- Tìm kiếm cần trả về kết quả phù hợp.
- Hệ thống cần tránh gửi request không cần thiết.

> Thời gian phản hồi cụ thể sẽ được xác định ở phiên bản sau.

## 6.2 Scalability

Hệ thống cần có khả năng mở rộng để hỗ trợ:
- Tăng số lượng Customer.
- Tăng số lượng Technician.
- Tăng số lượng yêu cầu.
- Tăng số lượng giao dịch.
- Bổ sung loại dịch vụ.
- Bổ sung phương thức thanh toán.

## 6.3 Security

Hệ thống cần:
- Xác thực người dùng.
- Phân quyền theo Actor.
- Bảo vệ mật khẩu.
- Không cho phép truy cập dữ liệu ngoài quyền.
- Kiểm tra dữ liệu đầu vào.
- Bảo vệ API khỏi request không hợp lệ.
- Bảo vệ thông tin thanh toán.
- Ghi nhận thao tác quản trị quan trọng.

## 6.4 Infrastructure

```text
Client
   ↓
Frontend
   ↓
Backend API
   ↓
Database
```

Dịch vụ bên ngoài dự kiến:

```text
Backend
 ├── Map Service
 ├── Payment Service
 └── Notification / Email Service
```

## 6.5 Browser

Hệ thống web dự kiến hỗ trợ:
- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Safari

## 6.6 Reliability

- Dữ liệu yêu cầu sửa chữa cần được lưu trữ ổn định.
- Không tạo nhiều đơn ngoài ý muốn do thao tác gửi lặp.
- Trạng thái đơn phải được cập nhật nhất quán.
- Giao dịch thanh toán cần có trạng thái rõ ràng.
- Xử lý trường hợp dịch vụ bên ngoài không phản hồi.

## 6.7 Purchased Components

Chưa xác định ở phiên bản v0.1.

## 6.8 Interfaces

### User Interface

Hệ thống cung cấp giao diện web cho:
- Guest.
- Customer.
- Technician.
- Admin.

### External Interfaces

Dự kiến tích hợp:
- Map API.
- Payment API.
- Email/Notification API.

## 6.9 Extensibility

Hệ thống có thể mở rộng:
- Thêm loại dịch vụ.
- Thêm phương thức thanh toán.
- Thêm phương thức thông báo.
- Chat giữa Customer và Technician.
- Hệ thống khuyến mãi.
- Quản lý lịch làm việc của Technician.
- AI hỗ trợ xác định vấn đề hoặc đề xuất Technician.

Các chức năng mở rộng không thuộc phạm vi bắt buộc của v0.1.

## 6.10 Assumptions

1. Người dùng có kết nối Internet.
2. Customer cung cấp thông tin yêu cầu tương đối chính xác.
3. Technician cung cấp thông tin hồ sơ và chuyên môn chính xác.
4. Technician phải được xác minh trước khi nhận đơn.
5. Dịch vụ bản đồ cung cấp thông tin vị trí cần thiết.
6. Dịch vụ thanh toán có API để tích hợp.
7. Admin chịu trách nhiệm quản lý và kiểm duyệt dữ liệu.
8. Chính sách phí dịch vụ, hoa hồng và hủy đơn sẽ được xác định ở phiên bản sau.

---

# 7. Version History

| Version | Date | Description |
|---|---|---|
| **0.1** | 28/08/2026 | Initial draft. Xác định phạm vi, actor, module và các Use Case chính. |
| 0.2 | TBD | Bổ sung và điều chỉnh theo self-review. |
| 1.0 | TBD | Baseline SRS lần đầu. |
| 2.0 | TBD | Cập nhật sau review. |
| 3.0 | TBD | Phiên bản hoàn thiện theo yêu cầu môn học. |
