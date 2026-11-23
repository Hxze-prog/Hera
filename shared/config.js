let cached = null;

export async function getConfig(force = false) {
  if (cached && !force) return cached;
  const response = await fetch('/api/config', { cache: 'no-store' });
  if (!response.ok) throw new Error('config_unavailable');
  const data = await response.json();
  if (!data.supabaseUrl || !data.anonKey) throw new Error('config_incomplete');
  cached = data;
  return cached;
}
