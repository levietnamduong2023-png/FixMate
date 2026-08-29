# Wireframes FixMate V0.2

Wireframe thể hiện information architecture đã được hiện thực trong React. Giao diện desktop dùng tối đa 1180 px; dưới 900 px chuyển một cột và dưới 650 px tối ưu cho mobile.

## 1. Guest landing page

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [F] FixMate       Dịch vụ  Cách hoạt động  Hỗ trợ     Đăng nhập [Bắt đầu]│
├──────────────────────────────────────────────────────────────────────────┤
│ THỢ CHUẨN · GIÁ RÕ · ĐẾN ĐÚNG HẸN                                       │
│                                                                          │
│ Chuyện trong nhà,                    ╭──────────────────────────────╮     │
│ để FixMate lo.                       │     abstract brand visual    │     │
│                                      │ [Thợ đang trên đường]        │     │
│ Đặt lịch trong vài phút...           │          FM                  │     │
│ [Đặt dịch vụ ngay] [Khám phá]        │ [✓ Hồ sơ đã xác minh]        │     │
│ 4.9/5  ·  Giá duyệt trước  ·  7 ngày ╰──────────────────────────────╯     │
├──────────────────────────────────────────────────────────────────────────┤
│ DỊCH VỤ PHỔ BIẾN                                                        │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                    │
│ │ Điện          │ │ Nước          │ │ Điều hòa      │                    │
│ │ mô tả...      │ │ mô tả...      │ │ mô tả...      │                    │
│ │ Từ 150.000đ ↗ │ │ Từ 180.000đ ↗ │ │ Từ 250.000đ ↗ │                    │
│ └───────────────┘ └───────────────┘ └───────────────┘                    │
├──────────────────────────────────────────────────────────────────────────┤
│ 01 Mô tả vấn đề     02 Nhận báo giá     03 Sửa chữa an tâm              │
└──────────────────────────────────────────────────────────────────────────┘
```

## 2. Customer dashboard

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [F] FixMate   KHÁCH HÀNG                    ◇  [A] Nguyễn An / Đăng xuất │
├──────────────────────────────────────────────────────────────────────────┤
│ KHÔNG GIAN KHÁCH HÀNG                                                    │
│ Việc nhà hôm nay             [Yêu cầu] [Đơn sửa chữa] [Trở thành thợ]   │
├──────────────────────────────┬───────────────────────────────────────────┤
│ + TẠO YÊU CẦU MỚI            │ YÊU CẦU GẦN ĐÂY                         │
│                              │ ┌───────────────────────────────────────┐ │
│ Dịch vụ [Điện          ▼]    │ │ Điện                [CÓ BÁO GIÁ]     │ │
│ Mô tả   [______________]     │ │ Ổ cắm phát tia lửa...                │ │
│          [______________]    │ │ ⌖ Địa chỉ   ◷ 09:00 02/09           │ │
│ Địa chỉ [______________]     │ │ [Xem báo giá]  Hủy yêu cầu          │ │
│ Thời gian [____________]     │ └───────────────────────────────────────┘ │
│ [      Gửi yêu cầu      ]    │                                           │
└──────────────────────────────┴───────────────────────────────────────────┘
```

## 3. Technician dashboard

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ CÔNG VIỆC CỦA BẠN                                  ● Đang nhận đơn      │
│ [4.9 ★] [28 lượt] [3 đơn đang xử lý] [Quận 1, TP.HCM]                   │
├───────────────────────────────────┬──────────────────────────────────────┤
│ YÊU CẦU PHÙ HỢP                  │ ĐƠN ĐƯỢC GIAO                       │
│ ┌───────────────────────────────┐ │ ┌──────────────────────────────────┐ │
│ │ Nước              [CHỜ XỬ LÝ]│ │ │ Điều hòa       [ĐÃ XÁC NHẬN]   │ │
│ │ Vòi nước bị rò...             │ │ │ Nguyễn An · 12 Nguyễn Huệ      │ │
│ │ ⌖ Quận 1 · ◷ 02/09           │ │ │ 350.000đ                       │ │
│ │ [Gửi báo giá]                 │ │ │ [Bắt đầu di chuyển]            │ │
│ └───────────────────────────────┘ │ └──────────────────────────────────┘ │
└───────────────────────────────────┴──────────────────────────────────────┘
```

## 4. Admin dashboard

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ TRUNG TÂM VẬN HÀNH                                                      │
│ Tổng quan FixMate                                      [Làm mới dữ liệu]│
│ [Users 120] [Chờ duyệt 4] [Requests 83] [Bookings 62] [Paid 54] [₫...]  │
├───────────────────────────────────┬──────────────────────────────────────┤
│ HỒ SƠ THỢ CHỜ DUYỆT              │ KHIẾU NẠI MỚI                       │
│ Tên · email · bio · kinh nghiệm  │ Khách hàng · tiêu đề · nội dung     │
│ [Điện] [Nước]                    │ [Tiếp nhận] [Giải quyết]             │
│ [Phê duyệt] [Từ chối]            │                                      │
└───────────────────────────────────┴──────────────────────────────────────┘
```

## 5. Mobile behavior

```text
┌──────────────────────┐
│ [F] FixMate      ◇ [A]│
├──────────────────────┤
│ Việc nhà hôm nay     │
│ [Yêu cầu][Đơn][Thợ]  │
│                      │
│ + Tạo yêu cầu mới    │
│ [form một cột]       │
│ [   Gửi yêu cầu   ]  │
│                      │
│ Yêu cầu gần đây      │
│ [card]               │
│ [card]               │
└──────────────────────┘
```

## 6. Accessibility notes

- Semantic header, main, section, article, form và label.
- Focus state rõ cho input/select/textarea.
- Status không chỉ dựa vào màu; luôn có nhãn chữ.
- Layout không yêu cầu hover để sử dụng.
- Modal có `role=dialog`, `aria-modal` và nút đóng có label.
- Responsive từ 320 px; target thao tác chính cao tối thiểu khoảng 38–42 px.
