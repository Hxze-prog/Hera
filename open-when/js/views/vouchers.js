import { state } from '../state.js';
import { reloadVouchers } from '../data.js';
import { confirm, el, emptyState, formatDate, toast } from '/shared/ui.js';

export function renderVouchers() {
  const root = document.getElementById('vouchers-list');
  if (!root) return;
  const items = state.data.vouchers;
  if (!items.length) {
    root.replaceChildren(emptyState('No vouchers yet. Something sweet is coming.'));
    return;
  }
  const cards = items.map((item) => {
    const actions = el('div', { class: 'card-actions' });
    if (item.is_redeemed) {
      actions.append(el('span', { class: 'muted small', text: `Redeemed ${formatDate(item.redeemed_at)}` }));
    } else {
      actions.append(el('button', {
        type: 'button',
        class: 'soft small',
        text: 'Redeem',
        on: { click: () => redeem(item) },
      }));
    }
    return el('div', {}, [
      el('div', { class: 'card' }, [
        el('div', { class: 'card-icon', text: item.icon || 'V' }),
        el('span', {
          class: `badge${item.is_redeemed ? ' redeemed' : ''}`,
          text: item.is_redeemed ? 'Redeemed' : 'Available',
        }),
        el('h3', { text: item.title }),
        el('p', { text: item.description || '' }),
        actions,
      ]),
    ]);
  });
  root.replaceChildren(...cards);
}

async function redeem(item) {
  const accepted = await confirm(`Redeem "${item.title}"?`, {
    title: 'Use this voucher',
    confirmLabel: 'Redeem it',
  });
  if (!accepted) return;
  try {
    await state.client.rpc('redeem_voucher', { p_id: item.id });
    await reloadVouchers();
    renderVouchers();
    toast('Voucher redeemed');
  } catch {
    toast('Could not redeem right now');
  }
}
