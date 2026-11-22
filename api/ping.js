function json(res, status, data, headers = {}) {
  res.status(status);

  const all = {
    'Cache-Control': 'no-store, max-age=0',
    ...headers,
  };

  for (const [key, value] of Object.entries(all)) {
    res.setHeader(key, value);
  }

  return res.json(data);
}

async function readJson(req) {
  try {
    let raw = '';

    for await (const chunk of req) {
      raw += chunk;

      if (raw.length > 8192) {
        throw new Error('Request too large');
      }
    }

    return raw ? JSON.parse(raw) : {};
  } catch {
    return null;
  }
}

async function supabaseFetch(path, options = {}) {
  const base = String(process.env.SUPABASE_URL || '')
    .replace(/\/+$/, '');

  const apikey = process.env.SUPABASE_ANON_KEY || '';

  if (!base || !apikey) {
    throw new Error('supabase_not_configured');
  }

  const headers = {
    apikey,
    ...(options.headers || {}),
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${base}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined
      ? undefined
      : JSON.stringify(options.body),
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function createHugEmbed() {
  return {
    title: '🤗 Hera sent you a hug!',
    description:
      'A warm hug has arrived! Hera is sending you love and positive energy. 💗',

    color: 0xEC4899,

    fields: [
      {
        name: '💗 Hug received',
        value: 'You deserve all the happiness and hugs in the world!',
        inline: false,
      },
    ],

    footer: {
      text: 'Hug System • Sending love always 💗',
    },

    timestamp: new Date().toISOString(),
  };
}

function createMessageEmbed(mood, note) {
  return {
    title: '💌 You received a new message!',
    description:
      'Hera has something special to tell you. 💜',

    color: 0xA855F7,

    fields: [
      {
        name: '💜 Mood',
        value: mood || 'Not specified',
        inline: true,
      },
      {
        name: '💬 Personal Message',
        value: note || '*No message provided.*',
        inline: false,
      },
    ],

    footer: {
      text: 'Hug System • Made with love 💜',
    },

    timestamp: new Date().toISOString(),
  };
}

async function sendDiscordWebhook(embed, userId) {
  const webhook = process.env.HUG_WEBHOOK_URL;

  if (!webhook) return false;

  const response = await fetch(webhook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: userId ? `<@${userId}>` : '',
      embeds: [embed],

      allowed_mentions: {
        parse: [],
        users: userId ? [userId] : [],
      },
    }),
  });

  return response.ok;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, {
      ok: false,
      error: 'Method not allowed',
    });
  }

  const authorization = req.headers.authorization || '';

  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  if (!token) {
    return json(res, 401, {
      ok: false,
      error: 'Unauthorized',
    });
  }

  const body = await readJson(req);

  if (!body) {
    return json(res, 400, {
      ok: false,
      error: 'Invalid request body',
    });
  }

  try {
    const profile = await supabaseFetch('/auth/v1/user', {
      token,
    });

    if (!profile.ok || !profile.data?.id) {
      return json(res, 401, {
        ok: false,
        error: 'Unauthorized',
      });
    }

    const type = typeof body.type === 'string'
      ? body.type.toLowerCase()
      : '';

    const mood = typeof body.mood === 'string'
      ? body.mood.slice(0, 120)
      : '';

    const note = typeof body.note === 'string'
      ? body.note.slice(0, 500)
      : '';

    if (!['hug', 'message'].includes(type)) {
      return json(res, 400, {
        ok: false,
        error: 'Invalid notification type',
      });
    }

    if (type === 'message' && !note.trim()) {
      return json(res, 400, {
        ok: false,
        error: 'Message cannot be empty',
      });
    }

    const rawUserId = String(
      process.env.HUG_DISCORD_USER_ID || ''
    ).trim();

    const userId = /^\d{17,20}$/.test(rawUserId)
      ? rawUserId
      : '';

    const embed = type === 'hug'
      ? createHugEmbed()
      : createMessageEmbed(mood, note);

    let webhookSent = false;

    if (process.env.HUG_WEBHOOK_URL) {
      try {
        webhookSent = await sendDiscordWebhook(
          embed,
          userId
        );
      } catch (error) {
        console.warn('Discord webhook failed:', error);
      }
    }

    return json(res, 200, {
      ok: true,
      type,
      webhook: webhookSent,
    });

  } catch (error) {
    console.error('Hug API error:', error);

    return json(res, 503, {
      ok: false,
      error: 'Service unavailable',
    });
  }
}
