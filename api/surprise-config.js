function json(res, status, data, headers = {}) {
  res.status(status);
  const all = { 'Cache-Control': 'no-store, max-age=0', ...headers };
  for (const [key, value] of Object.entries(all)) res.setHeader(key, value);
  return res.json(data);
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }
  return json(res, 200, {
    username: process.env.SURPRISE_USERNAME || '',
    password: process.env.SURPRISE_PASSWORD || '',
  });
}
