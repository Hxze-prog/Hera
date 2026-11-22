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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  const body = (await readJson(req)) || {};

  try {
    const profile = await supabaseFetch('/auth/v1/user', { token });
    if (!profile.ok || !profile.data?.id) {
      return json(res, 401, { error: 'Unauthorized' });
    }

    const mood = typeof body.mood === 'string' ? body.mood.slice(0, 120) : '';
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : '';
    const webhook = process.env.HUG_WEBHOOK_URL;
    const rawUserId = String(process.env.HUG_DISCORD_USER_ID || '').trim();
    const userId = /^\d{17,20}$/.test(rawUserId) ? rawUserId : '';

    if (webhook) {
      try {
        const bodyText = `${note ? 'Message received' : 'Hug ping received'}${mood ? ` — ${mood}` : ''}${note ? `\n${note}` : ''}`;
        const message = userId ? `<@${userId}> ${bodyText}` : bodyText;
        const response = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: message,
            text: bodyText,
            at: new Date().toISOString(),
            allowed_mentions: { parse: [], users: userId ? [userId] : [] },
          }),
        });
        if (!response.ok) {
          console.warn('Hug webhook rejected', response.status);
          return json(res, 200, { ok: true, webhook: false });
        }
      } catch {
        return json(res, 200, { ok: true, webhook: false });
      }
    }

    return json(res, 200, { ok: true, webhook: Boolean(webhook) });
  } catch {
    return json(res, 503, { error: 'Service unavailable' });
  }
}
