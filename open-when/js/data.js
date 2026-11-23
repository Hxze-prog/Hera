import { state } from './state.js';

export async function loadData() {
  const client = state.client;
  const [envelopes, memories, vouchers, settingsRows, pings] = await Promise.all([
    client.list('envelopes', { order: 'sort_order' }),
    client.list('memories', { order: 'sort_order' }),
    client.list('vouchers', { order: 'sort_order' }),
    client.list('app_settings', { limit: 1 }),
    client.list('pings', { order: 'pinged_at', asc: false, limit: 10 }),
  ]);
  state.data = {
    envelopes: envelopes || [],
    memories: memories || [],
    vouchers: vouchers || [],
    pings: pings || [],
    settings: settingsRows?.[0] || null,
  };
}

export async function reloadVouchers() {
  state.data.vouchers = (await state.client.list('vouchers', { order: 'sort_order' })) || [];
}

export async function reloadPings() {
  state.data.pings = (await state.client.list('pings', { order: 'pinged_at', asc: false, limit: 10 })) || [];
}

export async function reloadSettings() {
  const rows = await state.client.list('app_settings', { limit: 1 });
  state.data.settings = rows?.[0] || null;
}
