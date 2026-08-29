import { useEffect, useState } from 'react';
import { api, idOf, jsonBody, setToken } from '../api.js';
import useDialogFocus from '../hooks/useDialogFocus.js';

export default function AccountPanel({ session, onClose, onSessionChanged, onAddressesChanged, onSignedOut, flash }) {
  const dialogRef = useDialogFocus(onClose);
  const [addresses, setAddresses] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [consents, setConsents] = useState([]);
  const [tab, setTab] = useState('profile');

  async function loadAddresses() {
    const result = await api('/addresses');
    setAddresses(result.items);
  }

  async function loadSecurity() {
    const [sessionData, consentData] = await Promise.all([
      api('/auth/sessions'),
      api('/profile/consents'),
    ]);
    setActiveSessions(sessionData.items);
    setConsents(consentData.items);
  }

  useEffect(() => {
    Promise.all([loadAddresses(), loadSecurity()]).catch((error) => flash(error.message, 'error'));
  }, []);

  async function updateProfile(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api('/profile', { method: 'PATCH', body: jsonBody(data) });
      await onSessionChanged();
      flash('Hồ sơ đã được cập nhật.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function changePassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api('/auth/change-password', { method: 'POST', body: jsonBody(data) });
      setToken(null);
      form.reset();
      flash('Mật khẩu đã đổi. Vui lòng đăng nhập lại.');
      onSignedOut();
    } catch (error) { flash(error.message, 'error'); }
  }

  async function addAddress(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api('/addresses', {
        method: 'POST',
        body: jsonBody({ ...data, isDefault: data.isDefault === 'on' }),
      });
      form.reset();
      await loadAddresses();
      onAddressesChanged();
      flash('Địa chỉ đã được thêm.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function makeDefault(addressId) {
    try {
      await api(`/addresses/${addressId}`, { method: 'PATCH', body: jsonBody({ isDefault: true }) });
      await loadAddresses();
      onAddressesChanged();
      flash('Đã đổi địa chỉ mặc định.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function removeAddress(addressId) {
    try {
      await api(`/addresses/${addressId}`, { method: 'DELETE' });
      await loadAddresses();
      onAddressesChanged();
      flash('Địa chỉ đã được xóa.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function requestVerification(type) {
    try {
      const result = await api('/auth/verification/request', {
        method: 'POST',
        body: jsonBody({ type }),
      });
      flash(result.message);
    } catch (error) { flash(error.message, 'error'); }
  }

  async function verify(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api('/auth/verify', { method: 'POST', body: jsonBody(data) });
      form.reset();
      await onSessionChanged();
      flash('Xác minh thành công.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function revokeFamily(familyId) {
    try {
      await api('/auth/sessions/' + familyId, { method: 'DELETE' });
      await loadSecurity();
      flash('Phiên đã được thu hồi.');
    } catch (error) { flash(error.message, 'error'); }
  }

  async function updateConsent(type, granted) {
    try {
      await api('/profile/consents/' + type, {
        method: 'PUT',
        body: jsonBody({ granted, version: '0.3' }),
      });
      await loadSecurity();
      flash('Lựa chọn riêng tư đã được cập nhật.');
    } catch (error) { flash(error.message, 'error'); }
  }

  function consentValue(type) {
    return consents.find((item) => item.type === type)?.granted || false;
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="account-card" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button className="icon-button close" onClick={onClose} aria-label="Đóng">×</button>
        <span className="eyebrow">Tài khoản FixMate</span>
        <h2 id="account-title">Hồ sơ của bạn</h2>
        <nav className="tabs account-tabs">
          <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>Thông tin</button>
          <button className={tab === 'addresses' ? 'active' : ''} onClick={() => setTab('addresses')}>Địa chỉ</button>
          <button className={tab === 'security' ? 'active' : ''} onClick={() => setTab('security')}>Bảo mật</button>
        </nav>

        {tab === 'profile' && <form className="stack-form" onSubmit={updateProfile}>
          <label>Họ và tên<input name="name" defaultValue={session.user.name} minLength="2" maxLength="100" required /></label>
          <label>Email<input value={session.user.email} disabled /></label>
          <label>Số điện thoại<input name="phone" defaultValue={session.user.phone || ''} minLength="8" maxLength="20" /></label>
          <button className="button primary">Lưu thay đổi</button>
        </form>}

        {tab === 'security' && <div className="security-layout">
          <section className="address-form">
            <h3>Xác minh liên hệ</h3>
            <p>Email: <b>{session.user.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}</b></p>
            <p>Điện thoại: <b>{session.user.phoneVerified ? 'Đã xác minh' : 'Chưa xác minh'}</b></p>
            <div className="card-actions">
              {!session.user.emailVerified && <button className="button small" onClick={() => requestVerification('EMAIL')}>Gửi mã email</button>}
              {!session.user.phoneVerified && session.user.phone && <button className="button small" onClick={() => requestVerification('PHONE')}>Gửi mã điện thoại</button>}
            </div>
            <form className="stack-form" onSubmit={verify}>
              <label>Loại xác minh<select name="type"><option value="EMAIL">Email</option><option value="PHONE">Điện thoại</option></select></label>
              <label>Mã xác minh<input name="token" minLength="32" maxLength="256" required /></label>
              <button className="button primary">Xác minh</button>
            </form>
          </section>
          <form className="stack-form address-form" onSubmit={changePassword}>
            <h3>Đổi mật khẩu</h3>
            <label>Mật khẩu hiện tại<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
            <label>Mật khẩu mới<input name="newPassword" type="password" minLength="8" maxLength="128" autoComplete="new-password" required /></label>
            <small>Mật khẩu mới phải có chữ hoa, chữ thường và số. Sau khi đổi, mọi phiên cũ sẽ bị thu hồi.</small>
            <button className="button primary">Đổi mật khẩu</button>
          </form>
          <section className="address-form">
            <h3>Quyền riêng tư tùy chọn</h3>
            {['LOCATION', 'MEDIA', 'MARKETING'].map((type) => <label className="check" key={type}>
              <input type="checkbox" checked={consentValue(type)} onChange={(event) => updateConsent(type, event.target.checked)} />
              {type === 'LOCATION' ? 'Dùng vị trí để matching' : type === 'MEDIA' ? 'Xử lý ảnh yêu cầu' : 'Nhận nội dung marketing'}
            </label>)}
          </section>
          <section className="address-form">
            <h3>Phiên đang hoạt động</h3>
            {activeSessions.map((item) => <article className="address-card" key={item.familyId}>
              <b>{item.userAgent || 'Thiết bị không xác định'}</b>
              <p>Hết hạn: {new Date(item.expiresAt).toLocaleString('vi-VN')}</p>
              <button className="text-button danger" onClick={() => revokeFamily(item.familyId)}>Thu hồi</button>
            </article>)}
          </section>
        </div>}

        {tab === 'addresses' && <div className="address-layout">
          <div className="address-list">
            {addresses.length === 0 && <p className="muted">Bạn chưa lưu địa chỉ nào.</p>}
            {addresses.map((address) => <article className="address-card" key={idOf(address)}>
              <div><b>{address.label}</b>{address.isDefault && <span>Mặc định</span>}</div>
              <strong>{address.recipientName} · {address.phone}</strong>
              <p>{address.line1}, {address.ward}, {address.district}, {address.city}</p>
              <footer>{!address.isDefault && <button className="text-button" onClick={() => makeDefault(idOf(address))}>Đặt mặc định</button>}<button className="text-button danger" onClick={() => removeAddress(idOf(address))}>Xóa</button></footer>
            </article>)}
          </div>
          <form className="stack-form address-form" onSubmit={addAddress}>
            <h3>Thêm địa chỉ</h3>
            <label>Nhãn<input name="label" minLength="2" maxLength="50" required placeholder="Nhà, Công ty…" /></label>
            <div className="form-row"><label>Người nhận<input name="recipientName" minLength="2" maxLength="100" required /></label><label>Điện thoại<input name="phone" minLength="8" maxLength="20" required /></label></div>
            <label>Số nhà, đường<input name="line1" minLength="3" maxLength="150" required /></label>
            <div className="form-row"><label>Phường/Xã<input name="ward" minLength="2" maxLength="100" required /></label><label>Quận/Huyện<input name="district" minLength="2" maxLength="100" required /></label></div>
            <label>Tỉnh/Thành phố<input name="city" minLength="2" maxLength="100" required /></label>
            <label className="check"><input name="isDefault" type="checkbox" />Đặt làm địa chỉ mặc định</label>
            <button className="button primary">Thêm địa chỉ</button>
          </form>
        </div>}
      </section>
    </div>
  );
}
