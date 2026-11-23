export function createClient(config, getAccessToken) {
  const base = String(config.supabaseUrl).replace(/\/$/, '');
  const apikey = config.anonKey;
  const bucket = config.bucket || 'care-package-media';

  async function request(path, options = {}) {
    const headers = {
      apikey,
      Authorization: `Bearer ${getAccessToken() || ''}`,
      ...(options.headers || {}),
    };
    if (options.body !== undefined && !options.raw) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${base}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.raw
        ? options.body
        : options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
      cache: 'no-store',
    });
    if (!response.ok) {
      let detail = null;
      try {
        detail = await response.json();
      } catch {
        detail = null;
      }
      const error = new Error(detail?.message || detail?.error || `http_${response.status}`);
      error.status = response.status;
      throw error;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function encodeId(value) {
    return encodeURIComponent(String(value));
  }

  function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function query(options = {}) {
    const params = new URLSearchParams({ select: options.select || '*' });
    for (const [key, value] of Object.entries(options.eq || {})) {
      if (value !== undefined && value !== null) params.append(key, `eq.${value}`);
    }
    if (options.order) params.append('order', `${options.order}.${options.asc === false ? 'desc' : 'asc'}`);
    if (options.limit) params.append('limit', String(options.limit));
    return params.toString();
  }

  return {
    async list(table, options = {}) {
      return request(`/rest/v1/${table}?${query(options)}`);
    },
    async insert(table, row) {
      return request(`/rest/v1/${table}`, {
        method: 'POST',
        body: row,
        headers: { Prefer: 'return=representation' },
      });
    },
    async update(table, id, patch) {
      return request(`/rest/v1/${table}?id=eq.${encodeId(id)}`, {
        method: 'PATCH',
        body: patch,
        headers: { Prefer: 'return=representation' },
      });
    },
    async remove(table, id) {
      return request(`/rest/v1/${table}?id=eq.${encodeId(id)}`, { method: 'DELETE' });
    },
    async rpc(name, args = {}) {
      return request(`/rest/v1/rpc/${name}`, { method: 'POST', body: args });
    },
    async signedUrl(path, expiresIn = 3600) {
      const data = await request(`/storage/v1/object/sign/${bucket}/${encodePath(path)}`, {
        method: 'POST',
        body: { expiresIn },
      });
      const url = data?.signedURL || data?.signedUrl || '';
      if (url.startsWith('http')) return url;
      const normalized = url.startsWith('/') ? url : `/${url}`;
      return `${base}${normalized.startsWith('/storage/v1/') ? normalized : `/storage/v1${normalized}`}`;
    },
    async upload(path, blob, contentType) {
      return request(`/storage/v1/object/${bucket}/${encodePath(path)}`, {
        method: 'POST',
        raw: true,
        body: blob,
        headers: { 'Content-Type': contentType, 'x-upsert': 'true' },
      });
    },
    async removeFile(path) {
      return request(`/storage/v1/object/${bucket}/${encodePath(path)}`, { method: 'DELETE' });
    },
  };
}
