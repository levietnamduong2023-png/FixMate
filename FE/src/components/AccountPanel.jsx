import { useEffect, useState } from 'react';
import { api, idOf, jsonBody, setToken } from '../api.js';

export default function AccountPanel({ session, onClose, onSessionChanged, onAddressesChanged, onSignedOut, flash }) {
  const [addresses, setAddresses] = useState([]);
  const [tab, setTab] = useState('profile');

  async function loadAddresses() {
    const result = await api('/addresses');
    setAddresses(result.items);
  }

  useEffect(() => { loadAddresses().catch((error) => flash(error.message, 'error')); }, []);

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

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="account-card" role="dialog" aria-modal="true" aria-labelledby="account-title">
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

        {tab === 'security' && <form className="stack-form" onSubmit={changePassword}>
          <label>Mật khẩu hiện tại<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label>Mật khẩu mới<input name="newPassword" type="password" minLength="8" maxLength="128" autoComplete="new-password" required /></label>
          <small>Mật khẩu mới phải có chữ hoa, chữ thường và số. Sau khi đổi, mọi phiên cũ sẽ bị thu hồi.</small>
          <button className="button primary">Đổi mật khẩu</button>
        </form>}

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
