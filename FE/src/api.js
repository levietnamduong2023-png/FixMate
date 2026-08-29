let accessToken = null;

export function getToken() {
  return accessToken;
}

export function setToken(token) {
  accessToken = token || null;
}

export async function api(path, options = {}, allowRefresh = true) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch('/api' + path, { ...options, headers, credentials: 'include' });
  if (response.status === 401 && allowRefresh && !path.startsWith('/auth/')) {
    const refreshed = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (refreshed.ok) {
      const session = await refreshed.json();
      setToken(session.token);
      return api(path, options, false);
    }
  }
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Không thể kết nối đến hệ thống.');
    error.code = payload?.error?.code;
    error.details = payload?.error?.details;
    if (response.status === 401) setToken(null);
    throw error;
  }
  return payload;
}

export function jsonBody(value) {
  return JSON.stringify(value);
}

export function idOf(value) {
  return value?.id || value?._id;
}

export function money(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

export function dateTime(value) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
}
