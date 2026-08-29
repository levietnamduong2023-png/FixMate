import { useCallback, useEffect, useState } from 'react';
import { api, getToken, idOf, setToken } from './api.js';
import AccountPanel from './components/AccountPanel.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import AuthPanel from './components/AuthPanel.jsx';
import CustomerDashboard from './components/CustomerDashboard.jsx';
import PublicHome from './components/PublicHome.jsx';
import TechnicianDashboard from './components/TechnicianDashboard.jsx';

export default function App() {
  const [services, setServices] = useState([]);
  const [session, setSession] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifications, setNotifications] = useState(null);
  const [toast, setToast] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  const flash = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!getToken()) return setSession(null);
    const data = await api('/auth/me');
    setSession(data);
    return data;
  }, []);

  useEffect(() => {
    Promise.all([
      api('/services').then((data) => setServices(data.items)),
      getToken() ? refreshSession().catch(() => setToken(null)) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [refreshSession]);

  async function loadNotifications() {
    if (notifications) return setNotifications(null);
    try { setNotifications(await api('/notifications')); }
    catch (error) { flash(error.message, 'error'); }
  }

  function clearSession() {
    setToken(null);
    setSession(null);
    setNotifications(null);
    setAccountOpen(false);
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); }
    catch { /* Always clear the local session, even if it is already revoked. */ }
    clearSession();
  }

  if (loading) return <div className="app-loader"><div className="loader-mark">FM</div><p>Đang chuẩn bị FixMate…</p></div>;

  const user = session?.user;
  return (
    <div className="app">
      <header className="site-header">
        <div className="shell nav-inner">
          <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span>F</span>FixMate</button>
          {!user ? <nav className="public-nav"><a href="#services">Dịch vụ</a><a href="#how">Cách hoạt động</a><a href="#support">Hỗ trợ</a></nav> : <span className="role-label">{user.role === 'ADMIN' ? 'Quản trị' : user.role === 'TECHNICIAN' ? 'Đối tác thợ' : 'Khách hàng'}</span>}
          <div className="nav-actions">
            {!user ? <><button className="text-button" onClick={() => setAuthOpen(true)}>Đăng nhập</button><button className="button dark" onClick={() => setAuthOpen(true)}>Bắt đầu</button></> : <>
              <div className="notification-wrap"><button className="icon-button bell" onClick={loadNotifications} aria-label="Thông báo">♢{notifications?.unread > 0 && <i>{notifications.unread}</i>}</button>{notifications && <div className="notification-popover"><div className="panel-heading-row"><h3>Thông báo</h3><button className="icon-button" onClick={() => setNotifications(null)}>×</button></div>{notifications.items.length === 0 ? <p className="muted">Chưa có thông báo.</p> : notifications.items.map((item) => <article key={idOf(item)} className={!item.isRead ? 'unread' : ''}><b>{item.title}</b><p>{item.message}</p></article>)}</div>}</div>
              <div className="user-chip"><button className="avatar-button" onClick={() => setAccountOpen(true)} aria-label="Mở tài khoản">{user.name.slice(0, 1).toUpperCase()}</button><div><button className="account-name" onClick={() => setAccountOpen(true)}>{user.name}</button><button onClick={logout}>Đăng xuất</button></div></div>
            </>}
          </div>
        </div>
      </header>

      {!user && <PublicHome services={services} onStart={() => setAuthOpen(true)} />}
      {user?.role === 'CUSTOMER' && <CustomerDashboard services={services} profile={session.technicianProfile} dataVersion={dataVersion} flash={flash} />}
      {user?.role === 'TECHNICIAN' && <TechnicianDashboard profile={session.technicianProfile} flash={flash} refreshSession={refreshSession} />}
      {user?.role === 'ADMIN' && <AdminDashboard flash={flash} />}

      {!user && <footer className="site-footer" id="support"><div className="shell"><div className="brand inverse"><span>F</span>FixMate</div><p>Nền tảng kết nối sửa chữa tại nhà minh bạch và đáng tin cậy.</p><small>© 2026 FixMate. MVP theo SRS V0.1.</small></div></footer>}
      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} onAuthenticated={() => { setAuthOpen(false); refreshSession(); }} />}
      {accountOpen && session && <AccountPanel session={session} onClose={() => setAccountOpen(false)} onSessionChanged={refreshSession} onAddressesChanged={() => setDataVersion((value) => value + 1)} onSignedOut={clearSession} flash={flash} />}
      {toast && <div className={`toast ${toast.type}`} role="status">{toast.message}</div>}
    </div>
  );
}
