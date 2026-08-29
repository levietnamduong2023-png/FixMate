import { useEffect, useState } from 'react';
import { api, idOf, jsonBody, money } from '../api.js';
import StatusPill from './StatusPill.jsx';

export default function AdminDashboard({ flash }) {
  const [metrics, setMetrics] = useState({});
  const [technicians, setTechnicians] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [payments, setPayments] = useState([]);
  const [audits, setAudits] = useState([]);
  const [tab, setTab] = useState('operations');
  const [forms, setForms] = useState({});

  async function refresh() {
    const [metricData, technicianData, complaintData, userData, serviceData, bookingData, reviewData, paymentData, auditData] = await Promise.all([
      api('/admin/metrics'),
      api('/admin/technicians?status=PENDING'),
      api('/admin/complaints?status=PENDING'),
      api('/admin/users'),
      api('/admin/services'),
      api('/bookings'),
      api('/admin/reviews'),
      api('/admin/payments'),
      api('/admin/audit-logs'),
    ]);
    setMetrics(metricData);
    setTechnicians(technicianData.items);
    setComplaints(complaintData.items);
    setUsers(userData.items);
    setServices(serviceData.items);
    setBookings(bookingData.items);
    setReviews(reviewData.items);
    setPayments(paymentData.items);
    setAudits(auditData.items);
  }

  useEffect(() => { refresh().catch((error) => flash(error.message, 'error')); }, []);

  async function approve(userId, status, reason = '') {
    try {
      await api('/admin/technicians/' + userId + '/approval', { method: 'PATCH', body: jsonBody({ status, reason }) });
      await refresh();
      flash(status === 'APPROVED' ? 'Hồ sơ thợ đã được duyệt.' : 'Hồ sơ đã bị từ chối.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function handleComplaint(event, id, status) {
    if (event) event.preventDefault();
    const resolution = event ? String(new FormData(event.currentTarget).get('resolution') || '') : '';
    try {
      await api('/admin/complaints/' + id, { method: 'PATCH', body: jsonBody({ status, resolution, reason: resolution }) });
      await refresh();
      setForms((current) => ({ ...current, [id]: null }));
      flash('Khiếu nại đã được cập nhật.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function updateUser(event, user) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api('/admin/users/' + idOf(user) + '/status', {
        method: 'PATCH',
        body: jsonBody({ status: data.status, reason: data.reason }),
      });
      await refresh();
      flash('Trạng thái tài khoản đã được cập nhật.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function createService(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api('/admin/services', {
        method: 'POST',
        body: jsonBody({ ...data, basePrice: Number(data.basePrice) }),
      });
      form.reset();
      await refresh();
      flash('Dịch vụ đã được tạo.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function toggleService(service) {
    try {
      await api('/admin/services/' + idOf(service), {
        method: 'PATCH',
        body: jsonBody({ isActive: !service.isActive }),
      });
      await refresh();
      flash('Dịch vụ đã được cập nhật.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function overrideBooking(event, booking) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api('/bookings/' + idOf(booking) + '/status', {
        method: 'PATCH',
        body: jsonBody(data),
      });
      await refresh();
      flash('Booking đã được override và ghi audit.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function moderateReview(event, review) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api('/admin/reviews/' + idOf(review) + '/status', {
        method: 'PATCH',
        body: jsonBody(data),
      });
      await refresh();
      flash('Review đã được moderation.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function refundPayment(event, payment) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api('/admin/payments/' + idOf(payment) + '/refunds', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: jsonBody({ amount: Number(data.amount), reason: data.reason }),
      });
      await refresh();
      flash('Yêu cầu hoàn tiền đã được xử lý.');
    } catch (error) { flash(error.message, 'error'); }
  }

  const cards = [
    ['Người dùng', metrics.users || 0, '↗'],
    ['Hồ sơ chờ duyệt', metrics.techniciansPending || 0, '◎'],
    ['Yêu cầu sửa chữa', metrics.requests || 0, '⌂'],
    ['Đơn sửa chữa', metrics.bookings || 0, '✓'],
    ['Thanh toán thành công', metrics.paymentsPaid || 0, '₫'],
    ['Doanh thu ghi nhận', money(metrics.revenue), '＋'],
  ];
  const bookingTargets = {
    CONFIRMED: ['TECHNICIAN_ON_THE_WAY', 'CANCELLED'],
    TECHNICIAN_ON_THE_WAY: ['IN_PROGRESS', 'CANCELLATION_REVIEW'],
    IN_PROGRESS: ['AWAITING_CUSTOMER_CONFIRMATION', 'CANCELLATION_REVIEW'],
    AWAITING_CUSTOMER_CONFIRMATION: ['COMPLETED', 'DISPUTED'],
    CANCELLATION_REVIEW: ['CANCELLED', 'IN_PROGRESS', 'DISPUTED'],
    DISPUTED: ['COMPLETED', 'CANCELLED'],
  };

  return (
    <main className="dashboard shell">
      <header className="dashboard-heading"><div><span className="eyebrow">Trung tâm vận hành</span><h1>Tổng quan FixMate</h1></div><button className="button" onClick={refresh}>Làm mới dữ liệu</button></header>
      <nav className="tabs admin-tabs" aria-label="Khu vực quản trị">
        {[
          ['operations', 'Vận hành'],
          ['users', 'Người dùng'],
          ['services', 'Dịch vụ'],
          ['bookings', 'Booking'],
          ['finance', 'Tài chính'],
          ['moderation', 'Review'],
          ['audit', 'Audit'],
        ].map(([value, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>)}
      </nav>
      <div className="admin-metrics">{cards.map(([label, value, icon]) => <article key={label}><span>{icon}</span><small>{label}</small><strong>{value}</strong></article>)}</div>
      {tab === 'operations' && <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading-row"><div><h2>Hồ sơ thợ chờ duyệt</h2><p>Kiểm tra chuyên môn trước khi cấp quyền nhận đơn.</p></div><span className="count-badge">{technicians.length}</span></div>
          <div className="item-list">{technicians.length === 0 && <div className="empty"><span>✓</span><p>Không có hồ sơ tồn đọng.</p></div>}{technicians.map((profile) => <article className="list-card" key={idOf(profile)}>
            <div className="list-card-head"><div><small>{profile.user?.email}</small><h3>{profile.user?.name}</h3></div><StatusPill value={profile.approvalStatus} /></div>
            <p>{profile.bio}</p><div className="meta-row"><span>{profile.experienceYears} năm kinh nghiệm</span><span>{profile.area}</span></div>
            <div className="tag-row">{profile.serviceIds?.map((service) => <span key={idOf(service)}>{service.name}</span>)}</div>
            <div className="card-actions"><button className="button small primary" onClick={() => approve(idOf(profile.user), 'APPROVED')}>Phê duyệt</button><button className="button small danger-button" onClick={() => setForms((current) => ({ ...current, [idOf(profile)]: 'reject' }))}>Từ chối</button></div>
            {forms[idOf(profile)] === 'reject' && <form className="stack-form inline-action-form" onSubmit={(event) => {
              event.preventDefault();
              approve(idOf(profile.user), 'REJECTED', new FormData(event.currentTarget).get('reason'));
            }}><label>Lý do<textarea name="reason" minLength="10" maxLength="1000" required /></label><button className="button small danger-button">Xác nhận từ chối</button></form>}
          </article>)}</div>
        </section>
        <section className="panel">
          <div className="panel-heading-row"><div><h2>Khiếu nại mới</h2><p>Các trường hợp cần phản hồi sớm.</p></div><span className="count-badge warning">{complaints.length}</span></div>
          <div className="item-list">{complaints.length === 0 && <div className="empty"><span>✓</span><p>Không có khiếu nại mới.</p></div>}{complaints.map((item) => <article className="list-card" key={idOf(item)}>
            <div className="list-card-head"><div><small>{item.customer?.name}</small><h3>{item.subject}</h3></div><StatusPill value={item.status} /></div>
            <p>{item.detail}</p><div className="card-actions"><button className="button small" onClick={() => handleComplaint(null, idOf(item), 'PROCESSING')}>Tiếp nhận</button><button className="button small primary" onClick={() => setForms((current) => ({ ...current, [idOf(item)]: 'resolve' }))}>Giải quyết</button></div>
            {forms[idOf(item)] === 'resolve' && <form className="stack-form inline-action-form" onSubmit={(event) => handleComplaint(event, idOf(item), 'RESOLVED')}><label>Kết quả xử lý<textarea name="resolution" minLength="10" maxLength="2000" required /></label><button className="button small primary">Đóng khiếu nại</button></form>}
          </article>)}</div>
        </section>
      </div>}
      {tab === 'users' && <section className="panel wide-panel">
        <div className="panel-heading-row"><div><h2>Quản lý người dùng</h2><p>Mọi thay đổi trạng thái yêu cầu lý do và tạo audit.</p></div></div>
        <div className="item-list">{users.map((user) => <article className="list-card" key={idOf(user)}>
          <div className="list-card-head"><div><small>{user.email}</small><h3>{user.name}</h3></div><StatusPill value={user.status} /></div>
          <form className="inline-quote-form" onSubmit={(event) => updateUser(event, user)}>
            <select name="status" defaultValue={user.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED'}><option value="ACTIVE">ACTIVE</option><option value="LOCKED">LOCKED</option></select>
            <input name="reason" minLength="10" maxLength="1000" required placeholder="Lý do thay đổi" />
            <button className="button small primary">Cập nhật</button>
          </form>
        </article>)}</div>
      </section>}
      {tab === 'services' && <div className="dashboard-grid">
        <section className="panel"><h2>Thêm dịch vụ</h2><form className="stack-form" onSubmit={createService}>
          <label>Tên<input name="name" minLength="2" maxLength="100" required /></label>
          <label>Mô tả<textarea name="description" minLength="10" maxLength="1000" required /></label>
          <label>Giá tham khảo<input name="basePrice" type="number" min="0" required /></label>
          <button className="button primary">Tạo dịch vụ</button>
        </form></section>
        <section className="panel"><h2>Danh mục dịch vụ</h2><div className="item-list">{services.map((service) => <article className="list-card" key={idOf(service)}>
          <div className="list-card-head"><h3>{service.name}</h3><StatusPill value={service.isActive ? 'ACTIVE' : 'INACTIVE'} /></div>
          <p>{service.description}</p><strong>{money(service.basePrice)}</strong>
          <button className="button small" onClick={() => toggleService(service)}>{service.isActive ? 'Ngừng cung cấp' : 'Kích hoạt'}</button>
        </article>)}</div></section>
      </div>}
      {tab === 'bookings' && <section className="panel wide-panel">
        <h2>Booking và override</h2><div className="item-list">{bookings.map((booking) => <article className="list-card" key={idOf(booking)}>
          <div className="list-card-head"><div><small>{booking.customer?.name} → {booking.technician?.name}</small><h3>{booking.request?.service?.name}</h3></div><StatusPill value={booking.status} /></div>
          {(bookingTargets[booking.status] || []).length > 0 && <form className="inline-quote-form" onSubmit={(event) => overrideBooking(event, booking)}>
            <select name="status">{bookingTargets[booking.status].map((status) => <option key={status}>{status}</option>)}</select>
            {booking.status === 'CANCELLATION_REVIEW' && <select name="cancellationDecision" required defaultValue="">
              <option value="" disabled>Kết luận trách nhiệm</option>
              <option value="CUSTOMER_FAULT">Lỗi khách hàng · áp phí policy</option>
              <option value="TECHNICIAN_FAULT">Lỗi thợ · miễn phí</option>
              <option value="FORCE_MAJEURE">Bất khả kháng · miễn phí</option>
              <option value="WAIVED">Admin miễn phí</option>
            </select>}
            <input name="reason" minLength="10" maxLength="1000" required placeholder="Lý do override" />
            <button className="button small primary">Override</button>
          </form>}
        </article>)}</div>
      </section>}
      {tab === 'finance' && <section className="panel wide-panel">
        <h2>Thanh toán và hoàn tiền</h2><div className="item-list">{payments.map((payment) => <article className="list-card" key={idOf(payment)}>
          <div className="list-card-head"><div><small>{payment.customer?.email}</small><h3>{money(payment.amount)} · {payment.method}</h3></div><StatusPill value={payment.status} /></div>
          <p>Đã hoàn: {money(payment.refundedAmount)} · Hoa hồng: {money(payment.commissionAmount)}</p>
          {['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status) && <form className="inline-quote-form" onSubmit={(event) => refundPayment(event, payment)}>
            <input name="amount" type="number" min="1" max={payment.amount - payment.refundedAmount} required placeholder="Số tiền hoàn" />
            <input name="reason" minLength="10" maxLength="1000" required placeholder="Lý do hoàn tiền" />
            <button className="button small danger-button">Hoàn tiền</button>
          </form>}
        </article>)}</div>
      </section>}
      {tab === 'moderation' && <section className="panel wide-panel">
        <h2>Moderation review</h2><div className="item-list">{reviews.map((review) => <article className="list-card" key={idOf(review)}>
          <div className="list-card-head"><div><small>{review.customer?.name} → {review.technician?.name}</small><h3>{review.rating}/5 sao</h3></div><StatusPill value={review.status} /></div>
          <p>{review.comment}</p>
          <form className="inline-quote-form" onSubmit={(event) => moderateReview(event, review)}>
            <select name="status" defaultValue={review.status}><option value="VISIBLE">VISIBLE</option><option value="HIDDEN">HIDDEN</option></select>
            <input name="reason" minLength="10" maxLength="1000" required placeholder="Lý do moderation" />
            <button className="button small primary">Cập nhật</button>
          </form>
        </article>)}</div>
      </section>}
      {tab === 'audit' && <section className="panel wide-panel">
        <h2>Audit log</h2><div className="item-list">{audits.map((audit) => <article className="list-card" key={idOf(audit)}>
          <div className="list-card-head"><div><small>{audit.actor?.email || 'System'} · {new Date(audit.createdAt).toLocaleString('vi-VN')}</small><h3>{audit.action}</h3></div><span>{audit.entityType}</span></div>
          <p>{audit.reason || 'Không có lý do bổ sung'} · Request ID: {audit.requestId || '—'}</p>
        </article>)}</div>
      </section>}
    </main>
  );
}
