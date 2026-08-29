import { useEffect, useMemo, useState } from 'react';
import { api, dateTime, idOf, jsonBody, money } from '../api.js';
import StatusPill from './StatusPill.jsx';

export default function CustomerDashboard({ services, profile, dataVersion, flash }) {
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [quotes, setQuotes] = useState({});
  const [bookingForms, setBookingForms] = useState({});
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [requestData, bookingData, addressData, complaintData] = await Promise.all([api('/requests'), api('/bookings'), api('/addresses'), api('/complaints')]);
    setRequests(requestData.items);
    setBookings(bookingData.items);
    setAddresses(addressData.items);
    setComplaints(complaintData.items);
    if (!selectedAddressId) {
      setSelectedAddressId(idOf(addressData.items.find((item) => item.isDefault)) || '');
    }
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
          ...(selectedAddressId ? { addressId: selectedAddressId } : {}),
          ...(!selectedAddressId ? {
            address: {
              recipientName: input.recipientName,
              phone: input.phone,
              line1: input.line1,
              ward: input.ward,
              district: input.district,
              city: input.city,
            },
          } : {}),
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
      await api('/requests/quotes/' + quoteId + '/accept', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      await refresh();
      flash('Đã chấp nhận báo giá và tạo đơn sửa chữa.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function rejectQuote(quoteId) {
    try {
      await api('/requests/quotes/' + quoteId + '/reject', { method: 'PATCH' });
      await refresh();
      flash('Đã từ chối báo giá.');
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
        body: jsonBody({ method: 'ONLINE' }),
      });
      await refresh();
      flash('Thanh toán mô phỏng đã được ghi nhận.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function review(bookingId) {
    setBookingForms((current) => ({ ...current, [bookingId]: current[bookingId] === 'review' ? null : 'review' }));
  }

  async function submitReview(event, booking) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const reviewId = idOf(booking.review);
      await api(
        reviewId
          ? '/bookings/' + idOf(booking) + '/reviews/' + reviewId
          : '/bookings/' + idOf(booking) + '/reviews',
        {
          method: reviewId ? 'PATCH' : 'POST',
          body: jsonBody({ rating: Number(data.rating), comment: data.comment }),
        },
      );
      setBookingForms((current) => ({ ...current, [idOf(booking)]: null }));
      await refresh();
      flash(reviewId ? 'Đánh giá đã được cập nhật.' : 'Cảm ơn bạn đã đánh giá.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function removeReview(booking) {
    try {
      await api('/bookings/' + idOf(booking) + '/reviews/' + idOf(booking.review), { method: 'DELETE' });
      await refresh();
      flash('Đánh giá đã được xóa.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function changeBookingStatus(bookingId, status, extra = {}) {
    try {
      await api('/bookings/' + bookingId + '/status', {
        method: 'PATCH',
        body: jsonBody({ status, ...extra }),
      });
      setBookingForms((current) => ({ ...current, [bookingId]: null }));
      await refresh();
      flash('Trạng thái đơn đã được cập nhật.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function createComplaint(event, bookingId) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api('/bookings/' + bookingId + '/complaints', {
        method: 'POST',
        body: jsonBody(data),
      });
      setBookingForms((current) => ({ ...current, [bookingId]: null }));
      flash('Yêu cầu hỗ trợ đã được gửi.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function replyComplaint(event, complaintId) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = new FormData(form).get('message');
    try {
      await api('/complaints/' + complaintId + '/replies', {
        method: 'POST',
        body: jsonBody({ message }),
      });
      form.reset();
      await refresh();
      flash('Phản hồi đã được gửi.');
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
          <button className={tab === 'support' ? 'active' : ''} onClick={() => setTab('support')}>Hỗ trợ</button>
          <button className={tab === 'technician' ? 'active' : ''} onClick={() => setTab('technician')}>Trở thành thợ</button>
        </nav>
      </header>

      {tab === 'requests' && <div className="dashboard-grid">
        <section className="panel sticky-panel">
          <div className="panel-title"><span className="number-badge">+</span><div><h2>Tạo yêu cầu mới</h2><p>Mô tả càng rõ, báo giá càng sát.</p></div></div>
          <form className="stack-form" onSubmit={createRequest}>
            <label>Dịch vụ<select name="serviceId" required defaultValue=""><option value="" disabled>Chọn dịch vụ</option>{services.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name}</option>)}</select></label>
            <label>Vấn đề cần sửa<textarea name="description" minLength="10" maxLength="2000" rows="4" required placeholder="Ví dụ: vòi nước dưới bồn rửa bị rò liên tục…" /></label>
            {addresses.length > 0 && <label>Địa chỉ đã lưu<select value={selectedAddressId} onChange={(event) => setSelectedAddressId(event.target.value)}><option value="">Nhập địa chỉ khác</option>{addresses.map((address) => <option key={idOf(address)} value={idOf(address)}>{address.label}{address.isDefault ? ' · Mặc định' : ''} — {address.line1}, {address.district}</option>)}</select></label>}
            {!selectedAddressId && <fieldset className="manual-address"><legend>Địa chỉ sửa chữa</legend>
              <div className="form-row"><label>Người nhận<input name="recipientName" minLength="2" maxLength="100" required /></label><label>Điện thoại<input name="phone" minLength="8" maxLength="20" required /></label></div>
              <label>Số nhà, đường<input name="line1" minLength="3" maxLength="150" required /></label>
              <div className="form-row"><label>Phường/Xã<input name="ward" minLength="2" maxLength="100" required /></label><label>Quận/Huyện<input name="district" minLength="2" maxLength="100" required /></label></div>
              <label>Tỉnh/Thành phố<input name="city" minLength="2" maxLength="100" required /></label>
            </fieldset>}
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
                <div className="meta-row"><span>⌖ {item.location?.formatted || [item.location?.ward, item.location?.district, item.location?.city].filter(Boolean).join(', ')}</span><span>◷ {dateTime(item.desiredAt)}</span></div>
                <div className="card-actions">
                  {item.status === 'QUOTED' && <button className="button small" onClick={() => loadQuotes(requestId)}>Xem báo giá</button>}
                  {['PENDING', 'MATCHING', 'QUOTED'].includes(item.status) && <button className="text-button danger" onClick={() => cancelRequest(requestId)}>Hủy yêu cầu</button>}
                </div>
                {quotes[requestId] && <div className="quote-list">{quotes[requestId].length === 0 ? <p>Chưa có báo giá.</p> : quotes[requestId].map((quote) => <div className="quote-row" key={idOf(quote)}><div><b>{quote.technician?.name}</b><small>{quote.note || 'Không có ghi chú'} · Bảo hành {quote.warrantyDays || 0} ngày</small></div><strong>{money(quote.amount)}</strong>{quote.status === 'PENDING' && <div className="card-actions"><button className="button small primary" onClick={() => acceptQuote(idOf(quote))}>Chọn</button><button className="text-button danger" onClick={() => rejectQuote(idOf(quote))}>Từ chối</button></div>}</div>)}</div>}
              </article>;
            })}
          </div>
        </section>
      </div>}

      {tab === 'bookings' && <section className="panel wide-panel">
        <div className="panel-heading-row"><div><h2>Đơn sửa chữa</h2><p>Theo dõi công việc từ xác nhận đến hoàn thành.</p></div><button className="icon-button" onClick={refresh}>↻</button></div>
        <div className="booking-grid">
          {bookings.length === 0 && <Empty text="Chưa có đơn sửa chữa." />}
          {bookings.map((booking) => {
            const bookingId = idOf(booking);
            return <article className="booking-card" key={bookingId}>
              <div className="list-card-head"><h3>{booking.request?.service?.name}</h3><StatusPill value={booking.status} /></div>
              <p>Thợ: <b>{booking.technician?.name}</b></p><p>{booking.request?.address}</p>
              <strong className="price">{money(booking.amount)}</strong>
              {booking.paymentStatus && <p>Thanh toán: <StatusPill value={booking.paymentStatus} /></p>}
              <div className="card-actions">
                {booking.status === 'CONFIRMED' && <button className="text-button danger" onClick={() => changeBookingStatus(bookingId, 'CANCELLED')}>Hủy đơn</button>}
                {booking.status === 'AWAITING_CUSTOMER_CONFIRMATION' && <button className="button small primary" onClick={() => changeBookingStatus(bookingId, 'COMPLETED')}>Xác nhận hoàn thành</button>}
                {booking.status === 'AWAITING_CUSTOMER_CONFIRMATION' && <button className="button small danger-button" onClick={() => setBookingForms((current) => ({ ...current, [bookingId]: 'dispute' }))}>Tranh chấp</button>}
                {booking.status === 'COMPLETED' && !['PAID', 'PROCESSING'].includes(booking.paymentStatus) && <button className="button small primary" onClick={() => pay(bookingId)}>Thanh toán</button>}
                {booking.status === 'COMPLETED' && <button className="button small" onClick={() => review(bookingId)}>{booking.hasReview ? 'Sửa đánh giá' : 'Đánh giá'}</button>}
                {booking.hasReview && <button className="text-button danger" onClick={() => removeReview(booking)}>Xóa đánh giá</button>}
                <button className="text-button" onClick={() => setBookingForms((current) => ({ ...current, [bookingId]: 'complaint' }))}>Yêu cầu hỗ trợ</button>
              </div>
              {bookingForms[bookingId] === 'review' && <form className="stack-form inline-action-form" onSubmit={(event) => submitReview(event, booking)}>
                <label>Điểm<select name="rating" defaultValue={booking.review?.rating || 5}><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select></label>
                <label>Nhận xét<textarea name="comment" maxLength="1000" defaultValue={booking.review?.comment || ''} /></label>
                <button className="button small primary">Lưu đánh giá</button>
              </form>}
              {bookingForms[bookingId] === 'dispute' && <form className="stack-form inline-action-form" onSubmit={(event) => {
                event.preventDefault();
                const reason = new FormData(event.currentTarget).get('reason');
                changeBookingStatus(bookingId, 'DISPUTED', { reason });
              }}>
                <label>Lý do tranh chấp<textarea name="reason" minLength="10" maxLength="1000" required /></label>
                <button className="button small danger-button">Gửi tranh chấp</button>
              </form>}
              {bookingForms[bookingId] === 'complaint' && <form className="stack-form inline-action-form" onSubmit={(event) => createComplaint(event, bookingId)}>
                <label>Loại<select name="type"><option value="COMPLAINT">Khiếu nại</option><option value="CANCELLATION">Yêu cầu hủy</option><option value="WARRANTY">Bảo hành</option></select></label>
                <label>Tiêu đề<input name="subject" minLength="5" maxLength="150" required /></label>
                <label>Nội dung<textarea name="detail" minLength="20" maxLength="2000" required /></label>
                <button className="button small primary">Gửi hỗ trợ</button>
              </form>}
            </article>;
          })}
        </div>
      </section>}

      {tab === 'support' && <section className="panel wide-panel">
        <div className="panel-heading-row"><div><h2>Khiếu nại và bảo hành</h2><p>Theo dõi phản hồi của FixMate theo timeline.</p></div></div>
        <div className="item-list">{complaints.length === 0 && <Empty text="Chưa có yêu cầu hỗ trợ." />}{complaints.map((item) => <article className="list-card" key={idOf(item)}>
          <div className="list-card-head"><div><small>{item.type}</small><h3>{item.subject}</h3></div><StatusPill value={item.status} /></div>
          <p>{item.detail}</p>
          <form className="inline-quote-form" onSubmit={(event) => replyComplaint(event, idOf(item))}>
            <input name="message" minLength="2" maxLength="2000" required placeholder="Bổ sung thông tin" />
            <button className="button small">Gửi phản hồi</button>
          </form>
        </article>)}</div>
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
