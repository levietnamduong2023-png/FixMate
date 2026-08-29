const labels = {
  PENDING: 'Chờ xử lý',
  MATCHING: 'Đang tìm thợ',
  QUOTED: 'Có báo giá',
  BOOKED: 'Đã đặt',
  CONFIRMED: 'Đã xác nhận',
  TECHNICIAN_ON_THE_WAY: 'Thợ đang đến',
  IN_PROGRESS: 'Đang sửa chữa',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  PROCESSING: 'Đang xử lý',
  RESOLVED: 'Đã giải quyết',
  REJECTED: 'Từ chối',
  APPROVED: 'Đã duyệt',
  PAID: 'Đã thanh toán',
};

export default function StatusPill({ value }) {
  return <span className={`status-pill status-${String(value).toLowerCase()}`}>{labels[value] || value}</span>;
}
