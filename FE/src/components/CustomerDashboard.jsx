import { useEffect, useMemo, useState } from 'react';
import { api, dateTime, idOf, jsonBody, money } from '../api.js';
import StatusPill from './StatusPill.jsx';

export default function CustomerDashboard({ services, profile, dataVersion, flash }) {
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [requestData, bookingData, addressData] = await Promise.all([api('/requests'), api('/bookings'), api('/addresses')]);
    setRequests(requestData.items);
    setBookings(bookingData.items);
    setAddresses(addressData.items);
  }

  useEffect(() => { refresh().catch((error) => flash(error.message, 'error')); }, [dataVersion]);

  async function createRequest(event) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const input = Object.fromEntries(new FormData(form));
    try {
      await api('/requests', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: jsonBody({
          serviceId: input.serviceId,
          description: input.description,
          desiredAt: input.desiredAt,
          ...(input.addressId ? { addressId: input.addressId } : {}),
          ...(!input.addressId && input.address ? { address: input.address } : {}),
        }),
      });
      form.reset();
      await refresh();
      flash('Yêu cầu sửa chữa đã được tạo.');
    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function loadQuotes(requestId) {
    try {
      const data = await api(`/requests/${requestId}/quotes`);
      setQuotes((current) => ({ ...current, [requestId]: data.items }));
    } catch (error) { flash(error.message, 'error'); }
  }

  async function acceptQuote(quoteId) {
    try {
      await api(`/requests/quotes/${quoteId}/accept`, { method: 'POST' });
      await refresh();
      flash('Đã chấp nhận báo giá và tạo đơn sửa chữa.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function cancelRequest(requestId) {
    try {
      await api(`/requests/${requestId}/cancel`, { method: 'PATCH' });
      await refresh();
      flash('Đã hủy yêu cầu.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function pay(bookingId) {
    try {
      await api(`/bookings/${bookingId}/payments`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: jsonBody({ method: 'MOCK_CARD' }),
      });
      await refresh();
      flash('Thanh toán mô phỏng đã được ghi nhận.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function review(bookingId) {
    const rating = Number(window.prompt('Điểm đánh giá (1–5):', '5'));
    if (!rating) return;
    const comment = window.prompt('Nhận xét của bạn:', '') || '';
    try {
      await api(`/bookings/${bookingId}/reviews`, { method: 'POST', body: jsonBody({ rating, comment }) });
      await refresh();
      flash('Cảm ơn bạn đã đánh giá.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function applyTechnician(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api('/technicians/apply', {
        method: 'POST',
        body: jsonBody({
          serviceIds: data.getAll('serviceIds'),
          experienceYears: Number(data.get('experienceYears')),
          area: data.get('area'),
          bio: data.get('bio'),
        }),
      });
      flash('Hồ sơ thợ đã được gửi. Đăng nhập lại sau khi quản trị viên duyệt.');
      form.reset();
    } catch (error) { flash(error.message, 'error'); }
  }

  const minDate = useMemo(() => {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }, []);

  return (
    <main className="dashboard shell">
      <header className="dashboard-heading">
        <div><span className="eyebrow">Không gian khách hàng</span><h1>Việc nhà hôm nay</h1></div>
        <nav className="tabs" aria-label="Khu vực khách hàng">
          <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Yêu cầu</button>
          <button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}>Đơn sửa chữa</button>
          <button className={tab === 'technician' ? 'active' : ''} onClick={() => setTab('technician')}>Trở thành thợ</button>
        </nav>
      </header>

      {tab === 'requests' && <div className="dashboard-grid">
        <section className="panel sticky-panel">
          <div className="panel-title"><span className="number-badge">+</span><div><h2>Tạo yêu cầu mới</h2><p>Mô tả càng rõ, báo giá càng sát.</p></div></div>
          <form className="stack-form" onSubmit={createRequest}>
            <label>Dịch vụ<select name="serviceId" required defaultValue=""><option value="" disabled>Chọn dịch vụ</option>{services.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name}</option>)}</select></label>
            <label>Vấn đề cần sửa<textarea name="description" minLength="10" maxLength="2000" rows="4" required placeholder="Ví dụ: vòi nước dưới bồn rửa bị rò liên tục…" /></label>
            {addresses.length > 0 && <label>Địa chỉ đã lưu<select name="addressId" defaultValue=""><option value="">Nhập địa chỉ khác</option>{addresses.map((address) => <option key={idOf(address)} value={idOf(address)}>{address.label}{address.isDefault ? ' · Mặc định' : ''} — {address.line1}, {address.district}</option>)}</select></label>}
            <label>{addresses.length > 0 ? 'Hoặc nhập địa chỉ khác' : 'Địa chỉ'}<input name="address" minLength="5" maxLength="500" required={addresses.length === 0} placeholder="Số nhà, đường, phường/quận" /></label>
            <label>Thời gian mong muốn<input name="desiredAt" type="datetime-local" min={minDate} required /></label>
            <button className="button primary full" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-heading-row"><div><h2>Yêu cầu gần đây</h2><p>{requests.length} yêu cầu</p></div><button className="icon-button" onClick={refresh} aria-label="Làm mới">↻</button></div>
          <div className="item-list">
            {requests.length === 0 && <Empty text="Bạn chưa có yêu cầu nào." />}
            {requests.map((item) => {
              const requestId = idOf(item);
              return <article className="list-card" key={requestId}>
                <div className="list-card-head"><div><small>{item.service?.name}</small><h3>{item.description}</h3></div><StatusPill value={item.status} /></div>
                <div className="meta-row"><span>⌖ {item.address}</span><span>◷ {dateTime(item.desiredAt)}</span></div>
                <div className="card-actions">
                  {item.status === 'QUOTED' && <button className="button small" onClick={() => loadQuotes(requestId)}>Xem báo giá</button>}
                  {['PENDING', 'MATCHING', 'QUOTED'].includes(item.status) && <button className="text-button danger" onClick={() => cancelRequest(requestId)}>Hủy yêu cầu</button>}
                </div>
                {quotes[requestId] && <div className="quote-list">{quotes[requestId].length === 0 ? <p>Chưa có báo giá.</p> : quotes[requestId].map((quote) => <div className="quote-row" key={idOf(quote)}><div><b>{quote.technician?.name}</b><small>{quote.note || 'Không có ghi chú'}</small></div><strong>{money(quote.amount)}</strong>{quote.status === 'PENDING' && <button className="button small primary" onClick={() => acceptQuote(idOf(quote))}>Chọn</button>}</div>)}</div>}
              </article>;
            })}
          </div>
        </section>
      </div>}

      {tab === 'bookings' && <section className="panel wide-panel">
        <div className="panel-heading-row"><div><h2>Đơn sửa chữa</h2><p>Theo dõi công việc từ xác nhận đến hoàn thành.</p></div><button className="icon-button" onClick={refresh}>↻</button></div>
        <div className="booking-grid">
          {bookings.length === 0 && <Empty text="Chưa có đơn sửa chữa." />}
          {bookings.map((booking) => <article className="booking-card" key={idOf(booking)}>
            <div className="list-card-head"><h3>{booking.request?.service?.name}</h3><StatusPill value={booking.status} /></div>
            <p>Thợ: <b>{booking.technician?.name}</b></p><p>{booking.request?.address}</p>
            <strong className="price">{money(booking.amount)}</strong>
            <div className="card-actions">
              {booking.status === 'COMPLETED' && !booking.paymentStatus && <button className="button small primary" onClick={() => pay(idOf(booking))}>Thanh toán</button>}
              {booking.status === 'COMPLETED' && !booking.hasReview && <button className="button small" onClick={() => review(idOf(booking))}>Đánh giá</button>}
            </div>
          </article>)}
        </div>
      </section>}

      {tab === 'technician' && <section className="panel form-panel">
        <div className="panel-title"><span className="number-badge">FM</span><div><h2>Đăng ký trở thành thợ</h2><p>Hồ sơ cần được quản trị viên xác minh trước khi nhận việc.</p></div></div>
        {profile ? <div className="alert info">Hồ sơ hiện tại: <StatusPill value={profile.approvalStatus} /></div> : <form className="stack-form two-column" onSubmit={applyTechnician}>
          <label>Khu vực hoạt động<input name="area" minLength="2" maxLength="150" required placeholder="Ví dụ: Quận 1, TP.HCM" /></label>
          <label>Số năm kinh nghiệm<input name="experienceYears" type="number" min="0" max="60" required /></label>
          <fieldset><legend>Chuyên môn</legend><div className="check-grid">{services.map((service) => <label className="check" key={idOf(service)}><input type="checkbox" name="serviceIds" value={idOf(service)} />{service.name}</label>)}</div></fieldset>
          <label className="span-two">Giới thiệu<textarea name="bio" minLength="20" maxLength="1000" rows="5" required /></label>
          <button className="button primary">Gửi hồ sơ xét duyệt</button>
        </form>}
      </section>}
    </main>
  );
}

function Empty({ text }) {
  return <div className="empty"><span>⌂</span><p>{text}</p></div>;
}
