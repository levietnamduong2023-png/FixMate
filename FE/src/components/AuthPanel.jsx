import { useState } from 'react';
import { api, jsonBody, setToken } from '../api.js';
import useDialogFocus from '../hooks/useDialogFocus.js';

const titles = {
  login: 'Đăng nhập',
  register: 'Tạo tài khoản',
  forgot: 'Quên mật khẩu',
  reset: 'Đặt mật khẩu mới',
};

export default function AuthPanel({ onAuthenticated, onClose }) {
  const dialogRef = useDialogFocus(onClose);
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [developmentToken, setDevelopmentToken] = useState('');

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === 'forgot') {
        const result = await api('/auth/forgot-password', { method: 'POST', body: jsonBody({ email: data.email }) });
        setMessage(result.message);
        setDevelopmentToken('');
        setMode('reset');
      } else if (mode === 'reset') {
        const result = await api('/auth/reset-password', {
          method: 'POST',
          body: jsonBody({ token: data.token, newPassword: data.newPassword }),
        });
        setMode('login');
        setMessage(result.message);
      } else {
        const payload = mode === 'register'
          ? { ...data, acceptTerms: data.acceptTerms === 'on' }
          : data;
        const result = await api('/auth/' + (mode === 'login' ? 'login' : 'register'), {
          method: 'POST',
          body: jsonBody(payload),
        });
        setToken(result.token);
        onAuthenticated(result.user);
      }
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button close" onClick={onClose} aria-label="Đóng">×</button>
        <span className="eyebrow">Chào mừng đến FixMate</span>
        <h2 id="auth-title">{titles[mode]}</h2>
        <p className="muted">
          {mode === 'forgot' ? 'Nhập email để nhận mã đặt lại mật khẩu.' : mode === 'reset' ? 'Mã chỉ sử dụng một lần và hết hạn sau 15 phút.' : 'Quản lý mọi yêu cầu sửa chữa tại một nơi.'}
        </p>
        <form onSubmit={submit} className="stack-form">
          {mode === 'register' && <label>Họ và tên<input name="name" minLength="2" maxLength="100" required autoFocus /></label>}
          {['login', 'register', 'forgot'].includes(mode) && <label>Email<input name="email" type="email" autoComplete="email" required autoFocus={mode !== 'register'} /></label>}
          {mode === 'register' && <label>Số điện thoại<input name="phone" minLength="8" maxLength="20" /></label>}
          {['login', 'register'].includes(mode) && <label>Mật khẩu<input name="password" type="password" minLength="8" maxLength="128" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>}
          {mode === 'reset' && <>
            <label>Mã đặt lại<input name="token" minLength="32" maxLength="256" defaultValue={developmentToken} required autoFocus /></label>
            <label>Mật khẩu mới<input name="newPassword" type="password" minLength="8" maxLength="128" autoComplete="new-password" required /></label>
          </>}
          {['register', 'reset'].includes(mode) && <small>Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.</small>}
          {mode === 'register' && <label className="check"><input name="acceptTerms" type="checkbox" required />Tôi đồng ý Điều khoản và Chính sách riêng tư V0.3.</label>}
          {message && <div className="alert info" role="status">{message}</div>}
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="button primary full" disabled={busy}>{busy ? 'Đang xử lý…' : titles[mode]}</button>
        </form>
        <div className="auth-links">
          {mode === 'login' && <><button className="text-button" onClick={() => switchMode('forgot')}>Quên mật khẩu?</button><button className="text-button" onClick={() => switchMode('register')}>Đăng ký tài khoản</button></>}
          {mode === 'register' && <button className="text-button" onClick={() => switchMode('login')}>Đã có tài khoản? Đăng nhập</button>}
          {['forgot', 'reset'].includes(mode) && <button className="text-button" onClick={() => switchMode('login')}>Quay lại đăng nhập</button>}
        </div>
      </section>
    </div>
  );
}
