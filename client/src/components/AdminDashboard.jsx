import { useEffect, useState } from 'react';
import { api, idOf, jsonBody, money } from '../api.js';
import StatusPill from './StatusPill.jsx';

export default function AdminDashboard({ flash }) {
  const [metrics, setMetrics] = useState({});
  const [technicians, setTechnicians] = useState([]);
  const [complaints, setComplaints] = useState([]);

  async function refresh() {
    const [metricData, technicianData, complaintData] = await Promise.all([
      api('/admin/metrics'),
      api('/admin/technicians?status=PENDING'),
      api('/admin/complaints?status=PENDING'),
    ]);
    setMetrics(metricData);
    setTechnicians(technicianData.items);
    setComplaints(complaintData.items);
  }

  useEffect(() => { refresh().catch((error) => flash(error.message, 'error')); }, []);

  async function approve(userId, status) {
    try {
      await api(`/admin/technicians/${userId}/approval`, { method: 'PATCH', body: jsonBody({ status }) });
      await refresh();
      flash(status === 'APPROVED' ? 'Hồ sơ thợ đã được duyệt.' : 'Hồ sơ đã bị từ chối.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function handleComplaint(id, status) {
    const resolution = status === 'PROCESSING' ? '' : window.prompt('Nhập kết quả xử lý (ít nhất 10 ký tự):', '') || '';
    if (status !== 'PROCESSING' && !resolution) return;
    try {
      await api(`/admin/complaints/${id}`, { method: 'PATCH', body: jsonBody({ status, resolution }) });
      await refresh();
      flash('Khiếu nại đã được cập nhật.');
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

  return (
    <main className="dashboard shell">
      <header className="dashboard-heading"><div><span className="eyebrow">Trung tâm vận hành</span><h1>Tổng quan FixMate</h1></div><button className="button" onClick={refresh}>Làm mới dữ liệu</button></header>
      <div className="admin-metrics">{cards.map(([label, value, icon]) => <article key={label}><span>{icon}</span><small>{label}</small><strong>{value}</strong></article>)}</div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading-row"><div><h2>Hồ sơ thợ chờ duyệt</h2><p>Kiểm tra chuyên môn trước khi cấp quyền nhận đơn.</p></div><span className="count-badge">{technicians.length}</span></div>
          <div className="item-list">{technicians.length === 0 && <div className="empty"><span>✓</span><p>Không có hồ sơ tồn đọng.</p></div>}{technicians.map((profile) => <article className="list-card" key={idOf(profile)}>
            <div className="list-card-head"><div><small>{profile.user?.email}</small><h3>{profile.user?.name}</h3></div><StatusPill value={profile.approvalStatus} /></div>
            <p>{profile.bio}</p><div className="meta-row"><span>{profile.experienceYears} năm kinh nghiệm</span><span>{profile.area}</span></div>
            <div className="tag-row">{profile.serviceIds?.map((service) => <span key={idOf(service)}>{service.name}</span>)}</div>
            <div className="card-actions"><button className="button small primary" onClick={() => approve(idOf(profile.user), 'APPROVED')}>Phê duyệt</button><button className="button small danger-button" onClick={() => approve(idOf(profile.user), 'REJECTED')}>Từ chối</button></div>
          </article>)}</div>
        </section>
        <section className="panel">
          <div className="panel-heading-row"><div><h2>Khiếu nại mới</h2><p>Các trường hợp cần phản hồi sớm.</p></div><span className="count-badge warning">{complaints.length}</span></div>
          <div className="item-list">{complaints.length === 0 && <div className="empty"><span>✓</span><p>Không có khiếu nại mới.</p></div>}{complaints.map((item) => <article className="list-card" key={idOf(item)}>
            <div className="list-card-head"><div><small>{item.customer?.name}</small><h3>{item.subject}</h3></div><StatusPill value={item.status} /></div>
            <p>{item.detail}</p><div className="card-actions"><button className="button small" onClick={() => handleComplaint(idOf(item), 'PROCESSING')}>Tiếp nhận</button><button className="button small primary" onClick={() => handleComplaint(idOf(item), 'RESOLVED')}>Giải quyết</button></div>
          </article>)}</div>
        </section>
      </div>
    </main>
  );
}
