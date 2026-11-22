import { timingSafeEqual } from 'node:crypto';

const attempts = new Map();
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 30 * 60 * 1000;
const INVALID = { error: 'Invalid PIN' };

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

function safeEqual(a = '', b = '') {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  if (typeof req.headers['x-real-ip'] === 'string') return req.headers['x-real-ip'];
  return 'unknown';
}

function checkLimit(key) {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record) return { allowed: true, retryAfter: 0 };
  if (record.lockedUntil && record.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  if (record.lockedUntil && record.lockedUntil <= now) {
    attempts.delete(key);
    return { allowed: true, retryAfter: 0 };
  }
  if (now - record.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return { allowed: true, retryAfter: 0 };
  }
  return { allowed: true, retryAfter: 0 };
}

function recordFailure(key) {
  const now = Date.now();
  const record = attempts.get(key) || { count: 0, firstAt: now, lockedUntil: 0 };
  if (now - record.firstAt > WINDOW_MS) {
    record.count = 0;
    record.firstAt = now;
  }
  record.count += 1;
  if (record.count >= MAX_FAILURES) record.lockedUntil = now + LOCK_MS;
  attempts.set(key, record);
  if (attempts.size > 1000) {
    for (const [key, value] of attempts) {
      if ((value.lockedUntil || value.firstAt) < now - WINDOW_MS) attempts.delete(key);
    }
  }
}

function resetLimit(key) {
  attempts.delete(key);
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

function credentialsFor(pin) {
  if (safeEqual(pin, process.env.ADMIN_PIN || '')) {
    return {
      role: 'admin',
      email: process.env.ADMIN_EMAIL || '',
      password: process.env.ADMIN_PASSWORD || '',
    };
  }
  if (safeEqual(pin, process.env.HER_PIN || '')) {
    return {
      role: 'viewer',
      email: process.env.HER_EMAIL || '',
      password: process.env.HER_PASSWORD || '',
    };
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const limit = checkLimit(ip);
  if (!limit.allowed) {
    return json(res, 429, { error: 'Too many attempts. Try again later.' }, {
      'Retry-After': String(limit.retryAfter),
    });
  }

  const body = await readJson(req);
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

  if (!/^\d{4}$/.test(pin)) {
    recordFailure(ip);
    return json(res, 401, INVALID);
  }

  const credentials = credentialsFor(pin);
  if (!credentials || !credentials.email || !credentials.password) {
    recordFailure(ip);
    return json(res, 401, INVALID);
  }

  try {
    const result = await supabaseFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email: credentials.email, password: credentials.password },
    });
    if (!result.ok || !result.data?.access_token || !result.data?.refresh_token) {
      recordFailure(ip);
      return json(res, 401, INVALID);
    }
    resetLimit(ip);
    return json(res, 200, {
      access_token: result.data.access_token,
      refresh_token: result.data.refresh_token,
      expires_in: result.data.expires_in || 3600,
      role: credentials.role,
    });
  } catch {
    return json(res, 503, { error: 'Service unavailable' });
  }
}
