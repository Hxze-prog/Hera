const SESSION_KEY = 'for-you-session-v1';
const OPENED_KEY = 'for-you-opened-v1';

let accessToken = null;
let role = null;
let expiresAt = 0;

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved.refresh_token || !saved.role) return null;
    accessToken = saved.access_token || null;
    role = saved.role;
    expiresAt = saved.expires_at || 0;
    return saved;
  } catch {
    return null;
  }
}

export function saveSession(tokens) {
  const saved = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    role: tokens.role,
    expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(saved));
  accessToken = saved.access_token;
  role = saved.role;
  expiresAt = saved.expires_at;
  return saved;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  accessToken = null;
  role = null;
  expiresAt = 0;
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')?.refresh_token || null;
  } catch {
    return null;
  }
}

export function getRole() {
  return role;
}

export function isAdmin() {
  return role === 'admin';
}

export function isExpiringSoon() {
  return !accessToken || expiresAt - Date.now() < 5 * 60 * 1000;
}

export function getOpenedIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(OPENED_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

export function markOpened(id) {
  const ids = getOpenedIds();
  ids.add(id);
  localStorage.setItem(OPENED_KEY, JSON.stringify([...ids]));
}
