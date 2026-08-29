import { useEffect, useState } from 'react';
import { api, dateTime, idOf, jsonBody, money } from '../api.js';
import StatusPill from './StatusPill.jsx';

const nextStatus = {
  CONFIRMED: ['TECHNICIAN_ON_THE_WAY', 'Bắt đầu di chuyển'],
  TECHNICIAN_ON_THE_WAY: ['IN_PROGRESS', 'Bắt đầu sửa chữa'],
  IN_PROGRESS: ['COMPLETED', 'Xác nhận hoàn thành'],
};

export default function TechnicianDashboard({ profile, flash, refreshSession }) {
  const [opportunities, setOpportunities] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [drafts, setDrafts] = useState({});

  async function refresh() {
    const [opportunityData, bookingData] = await Promise.all([api('/technicians/opportunities'), api('/bookings')]);
    setOpportunities(opportunityData.items);
    setBookings(bookingData.items);
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

  async function advance(bookingId, status) {
    try {
      await api(`/bookings/${bookingId}/status`, { method: 'PATCH', body: jsonBody({ status }) });
      await refresh();
      flash('Trạng thái đơn đã được cập nhật.');
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
                <div className="meta-row"><span>⌖ {item.address}</span><span>◷ {dateTime(item.desiredAt)}</span></div>
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
                {next && <button className="button small primary" onClick={() => advance(idOf(booking), next[0])}>{next[1]}</button>}
              </article>;
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
