import { useState } from 'react';
import { api, jsonBody, setToken } from '../api.js';

export default function AuthPanel({ onAuthenticated, onClose }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: jsonBody(data),
      });
      setToken(result.token);
      onAuthenticated(result.user);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button close" onClick={onClose} aria-label="Đóng">×</button>
        <span className="eyebrow">Chào mừng đến FixMate</span>
        <h2 id="auth-title">{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2>
        <p className="muted">Quản lý mọi yêu cầu sửa chữa tại một nơi.</p>
        <form onSubmit={submit} className="stack-form">
          {mode === 'register' && <label>Họ và tên<input name="name" minLength="2" maxLength="100" required autoFocus /></label>}
          <label>Email<input name="email" type="email" autoComplete="email" required autoFocus={mode === 'login'} /></label>
          {mode === 'register' && <label>Số điện thoại<input name="phone" minLength="8" maxLength="20" /></label>}
          <label>Mật khẩu<input name="password" type="password" minLength="8" maxLength="128" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
          {mode === 'register' && <small>Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.</small>}
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="button primary full" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</button>
        </form>
        <button className="text-button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </section>
    </div>
  );
}
