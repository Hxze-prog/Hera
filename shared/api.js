async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error(data?.error || 'request_failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

async function get(path) {
  const response = await fetch(path, {
    cache: 'no-store',
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error(data?.error || 'request_failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function unlock(pin) {
  return post('/api/unlock', { pin });
}

export function getSurpriseConfig() {
  return get('/api/surprise-config');
}

export function refresh(refreshToken) {
  return post('/api/refresh', { refresh_token: refreshToken });
}

export function sendPing(token, payload = {}) {
  return post('/api/ping', payload, token);
}
