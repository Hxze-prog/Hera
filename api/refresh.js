const EXPIRED = { error: 'Session expired' };

function json(res, status, data, headers = {}) {
  res.status(status);
  const all = { 'Cache-Control': 'no-store, max-age=0', ...headers };
  for (const [key, value] of Object.entries(all)) res.setHeader(key, value);
  return res.json(data);
}

async function readJson(req) {
  try {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 8192) throw new Error('too large');
    }
    return raw ? JSON.parse(raw) : {};
  } catch {
    return null;
  }
}

async function supabaseFetch(path, options = {}) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const apikey = process.env.SUPABASE_ANON_KEY || '';
  if (!base || !apikey) throw new Error('supabase_not_configured');
  const headers = { apikey, ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}

function roleForEmail(email) {
  if (email && email.toLowerCase() === String(process.env.ADMIN_EMAIL || '').toLowerCase()) return 'admin';
  if (email && email.toLowerCase() === String(process.env.HER_EMAIL || '').toLowerCase()) return 'viewer';
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const body = await readJson(req);
  const refreshToken = typeof body?.refresh_token === 'string' ? body.refresh_token : '';
  if (!refreshToken) {
    return json(res, 401, EXPIRED);
  }

  try {
    const result = await supabaseFetch('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: refreshToken },
    });
    if (!result.ok || !result.data?.access_token || !result.data?.refresh_token) {
      return json(res, 401, EXPIRED);
    }

    let email = result.data.user?.email;
    if (!email) {
      const profile = await supabaseFetch('/auth/v1/user', { token: result.data.access_token });
      email = profile.ok ? profile.data?.email : null;
    }
    const role = roleForEmail(email);
    if (!role) {
      return json(res, 401, EXPIRED);
    }

    return json(res, 200, {
      access_token: result.data.access_token,
      refresh_token: result.data.refresh_token,
      expires_in: result.data.expires_in || 3600,
      role,
    });
  } catch {
    return json(res, 503, { error: 'Service unavailable' });
  }
}
