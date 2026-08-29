import { useEffect, useState } from 'react';
import { api, dateTime, idOf, jsonBody, money } from '../api.js';
import StatusPill from './StatusPill.jsx';

const nextStatus = {
  CONFIRMED: ['TECHNICIAN_ON_THE_WAY', 'Bắt đầu di chuyển'],
  TECHNICIAN_ON_THE_WAY: ['IN_PROGRESS', 'Bắt đầu sửa chữa'],
  IN_PROGRESS: ['AWAITING_CUSTOMER_CONFIRMATION', 'Gửi báo cáo hoàn thành'],
};

export default function TechnicianDashboard({ profile, services, flash, refreshSession }) {
  const [opportunities, setOpportunities] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [drafts, setDrafts] = useState({});

  async function refresh() {
    const [opportunityData, bookingData, complaintData] = await Promise.all([api('/technicians/opportunities'), api('/bookings'), api('/complaints')]);
    setOpportunities(opportunityData.items);
    setBookings(bookingData.items);
    setComplaints(complaintData.items);
  }

  useEffect(() => { refresh().catch((error) => flash(error.message, 'error')); }, []);

  async function toggleAvailability() {
    try {
      await api('/technicians/availability', { method: 'PATCH', body: jsonBody({ acceptingJobs: !profile.acceptingJobs }) });
      await refreshSession();
      flash(!profile.acceptingJobs ? 'Bạn đang nhận đơn mới.' : 'Đã tạm dừng nhận đơn.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function sendQuote(event, requestId) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(`/requests/${requestId}/quotes`, {
        method: 'POST',
        body: jsonBody({ amount: Number(data.amount), note: data.note, validUntil: data.validUntil }),
      });
      setDrafts((current) => ({ ...current, [requestId]: false }));
      await refresh();
      flash('Báo giá đã được gửi đến khách hàng.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function advance(bookingId, status, completionSummary = '') {
    try {
      await api('/bookings/' + bookingId + '/status', { method: 'PATCH', body: jsonBody({ status, completionSummary }) });
      await refresh();
      flash('Trạng thái đơn đã được cập nhật.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function updateProfile(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api('/technicians/profile', {
        method: 'PATCH',
        body: jsonBody({
          area: data.area,
          experienceYears: Number(data.experienceYears),
          bio: data.bio,
          serviceAreas: [{ city: data.city, district: data.district, ward: '' }],
        }),
      });
      await refreshSession();
      flash('Hồ sơ đã cập nhật và được chuyển sang chờ duyệt.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function updateSkills(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api('/technicians/skills', {
        method: 'PATCH',
        body: jsonBody({ serviceIds: data.getAll('serviceIds') }),
      });
      await refreshSession();
      flash('Chuyên môn đã cập nhật và được chuyển sang chờ duyệt.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function updateSchedule(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const toMinutes = (value) => {
      const [hour, minute] = value.split(':').map(Number);
      return hour * 60 + minute;
    };
    try {
      await api('/technicians/schedule', {
        method: 'PUT',
        body: jsonBody({
          weeklySchedule: [{
            dayOfWeek: Number(data.dayOfWeek),
            startMinutes: toMinutes(data.start),
            endMinutes: toMinutes(data.end),
          }],
          timeOff: [],
        }),
      });
      await refreshSession();
      flash('Lịch làm việc đã được cập nhật.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function replyComplaint(event, complaintId) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api('/complaints/' + complaintId + '/replies', {
        method: 'POST',
        body: jsonBody({ message: new FormData(form).get('message') }),
      });
      form.reset();
      await refresh();
      flash('Phản hồi đã được gửi.');
    } catch (error) { flash(error.message, 'error'); }
  }

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const validDefault = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <main className="dashboard shell">
      <header className="dashboard-heading">
        <div><span className="eyebrow">Không gian đối tác</span><h1>Công việc của bạn</h1></div>
        <button className={`availability ${profile?.acceptingJobs ? 'online' : ''}`} onClick={toggleAvailability}><span />{profile?.acceptingJobs ? 'Đang nhận đơn' : 'Tạm dừng nhận đơn'}</button>
      </header>
      <div className="metric-strip">
        <div><span>Đánh giá</span><strong>{profile?.ratingAverage?.toFixed?.(1) || '0.0'} ★</strong></div>
        <div><span>Lượt đánh giá</span><strong>{profile?.ratingCount || 0}</strong></div>
        <div><span>Đơn đang xử lý</span><strong>{bookings.filter((item) => !['COMPLETED', 'CANCELLED'].includes(item.status)).length}</strong></div>
        <div><span>Khu vực</span><strong>{profile?.area}</strong></div>
      </div>
      <div className="dashboard-grid technician-grid">
        <section className="panel">
          <div className="panel-heading-row"><div><h2>Yêu cầu phù hợp</h2><p>{opportunities.length} cơ hội mới</p></div><button className="icon-button" onClick={refresh}>↻</button></div>
          <div className="item-list">
            {opportunities.length === 0 && <div className="empty"><span>✓</span><p>Chưa có yêu cầu mới phù hợp.</p></div>}
            {opportunities.map((item) => {
              const requestId = idOf(item);
              return <article className="list-card" key={requestId}>
                <div className="list-card-head"><div><small>{item.service?.name}</small><h3>{item.description}</h3></div><StatusPill value={item.status} /></div>
                <div className="meta-row"><span>⌖ {[item.coarseLocation?.ward, item.coarseLocation?.district, item.coarseLocation?.city].filter(Boolean).join(', ')}</span><span>◷ {dateTime(item.desiredAt)}</span></div>
                {!drafts[requestId] ? <button className="button small primary" onClick={() => setDrafts((current) => ({ ...current, [requestId]: true }))}>Gửi báo giá</button> : <form className="inline-quote-form" onSubmit={(event) => sendQuote(event, requestId)}>
                  <input name="amount" type="number" min="10000" max="1000000000" required placeholder="Mức giá (VND)" />
                  <input name="validUntil" type="datetime-local" defaultValue={validDefault} required />
                  <input name="note" maxLength="1000" placeholder="Ghi chú phạm vi công việc" />
                  <button className="button small primary">Gửi</button><button type="button" className="text-button" onClick={() => setDrafts((current) => ({ ...current, [requestId]: false }))}>Đóng</button>
                </form>}
              </article>;
            })}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading-row"><div><h2>Đơn được giao</h2><p>Cập nhật đúng tiến độ thực tế.</p></div></div>
          <div className="item-list">
            {bookings.length === 0 && <div className="empty"><span>⌁</span><p>Chưa có đơn sửa chữa.</p></div>}
            {bookings.map((booking) => {
              const next = nextStatus[booking.status];
              return <article className="list-card" key={idOf(booking)}>
                <div className="list-card-head"><div><small>{booking.request?.service?.name}</small><h3>{booking.customer?.name}</h3></div><StatusPill value={booking.status} /></div>
                <p>{booking.request?.address}</p><div className="meta-row"><strong>{money(booking.amount)}</strong><span>{dateTime(booking.request?.desiredAt)}</span></div>
                {next && next[0] !== 'AWAITING_CUSTOMER_CONFIRMATION' && <button className="button small primary" onClick={() => advance(idOf(booking), next[0])}>{next[1]}</button>}
                {next?.[0] === 'AWAITING_CUSTOMER_CONFIRMATION' && <form className="stack-form inline-action-form" onSubmit={(event) => {
                  event.preventDefault();
                  advance(idOf(booking), next[0], new FormData(event.currentTarget).get('completionSummary'));
                }}>
                  <label>Báo cáo hoàn thành<textarea name="completionSummary" minLength="10" maxLength="2000" required /></label>
                  <button className="button small primary">{next[1]}</button>
                </form>}
              </article>;
            })}
          </div>
        </section>
      </div>
      <section className="panel wide-panel technician-settings">
        <div className="panel-heading-row"><div><h2>Hồ sơ và lịch làm việc</h2><p>Thay đổi hồ sơ/chuyên môn cần được duyệt lại.</p></div></div>
        <div className="dashboard-grid">
          <form className="stack-form" onSubmit={updateProfile}>
            <label>Khu vực mô tả<input name="area" defaultValue={profile?.area || ''} minLength="2" required /></label>
            <div className="form-row"><label>Thành phố<input name="city" defaultValue={profile?.serviceAreas?.[0]?.city || 'TP.HCM'} required /></label><label>Quận/Huyện<input name="district" defaultValue={profile?.serviceAreas?.[0]?.district || ''} required /></label></div>
            <label>Kinh nghiệm<input name="experienceYears" type="number" min="0" max="60" defaultValue={profile?.experienceYears || 0} required /></label>
            <label>Giới thiệu<textarea name="bio" minLength="20" maxLength="1000" defaultValue={profile?.bio || ''} required /></label>
            <button className="button small primary">Cập nhật hồ sơ</button>
          </form>
          <div>
            <form className="stack-form" onSubmit={updateSkills}>
              <fieldset><legend>Chuyên môn</legend><div className="check-grid">{services.map((service) => <label className="check" key={idOf(service)}><input type="checkbox" name="serviceIds" value={idOf(service)} defaultChecked={profile?.serviceIds?.some((value) => idOf(value) === idOf(service) || String(value) === idOf(service))} />{service.name}</label>)}</div></fieldset>
              <button className="button small">Cập nhật chuyên môn</button>
            </form>
            <form className="stack-form inline-action-form" onSubmit={updateSchedule}>
              <label>Ngày<select name="dayOfWeek"><option value="1">Thứ Hai</option><option value="2">Thứ Ba</option><option value="3">Thứ Tư</option><option value="4">Thứ Năm</option><option value="5">Thứ Sáu</option><option value="6">Thứ Bảy</option><option value="0">Chủ Nhật</option></select></label>
              <div className="form-row"><label>Bắt đầu<input name="start" type="time" defaultValue="08:00" required /></label><label>Kết thúc<input name="end" type="time" defaultValue="17:00" required /></label></div>
              <button className="button small">Lưu lịch</button>
            </form>
          </div>
        </div>
      </section>
      <section className="panel wide-panel">
        <div className="panel-heading-row"><div><h2>Khiếu nại liên quan</h2><p>Chỉ hiển thị case thuộc booking được giao.</p></div></div>
        <div className="item-list">{complaints.length === 0 ? <p className="muted">Không có khiếu nại.</p> : complaints.map((item) => <article className="list-card" key={idOf(item)}>
          <div className="list-card-head"><h3>{item.subject}</h3><StatusPill value={item.status} /></div>
          <p>{item.detail}</p>
          <form className="inline-quote-form" onSubmit={(event) => replyComplaint(event, idOf(item))}><input name="message" minLength="2" maxLength="2000" required placeholder="Phản hồi" /><button className="button small">Gửi</button></form>
        </article>)}</div>
      </section>
    </main>
  );
}
