import { state } from '../state.js';
import { reloadPings } from '../data.js';
import { sendPing } from '../api.js';
import { getAccessToken } from '../session.js';
import { el, formatDate, toast } from '../ui.js';

function timeBox(value, label) {
  return el('div', { class: 'time-box' }, [
    el('strong', { text: String(value).padStart(2, '0') }),
    el('small', { text: label }),
  ]);
}

export function stopCountdown() {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
}

export function renderDistance() {
  stopCountdown();
  const root = document.getElementById('distance-content');
  if (!root) return;

  const settings = state.data.settings || {};
  const boxes = el('div', { class: 'countdown' });
  const note = el('p', { class: 'status-note', text: settings.status_note || '' });
  const card = el('div', { class: 'countdown-card' }, [
    el('p', { class: 'eyebrow', text: 'Next time together' }),
    boxes,
    note,
  ]);

  const children = [card];

  if (state.role === 'viewer') {
    const hug = el('button', { type: 'button', class: 'hug-button', text: 'Send a Hug' });
    hug.addEventListener('click', async () => {
      if (hug.disabled) return;
      hug.disabled = true;
      try {
        await sendPing(getAccessToken(), {});
        await state.client.insert('pings', { mood: null, note: null });
        await reloadPings();
        toast('Hug sent. Love is on its way.');
        updateLastPing(root);
      } catch {
        toast('Could not send right now');
      } finally {
        setTimeout(() => {
          hug.disabled = false;
        }, 3000);
      }
    });
    children.push(el('div', { style: { textAlign: 'center', marginTop: '1.2rem' } }, [hug]));
  }

  children.push(el('div', { id: 'last-ping' }));
  root.replaceChildren(...children);
  updateLastPing(root);

  const target = settings.next_meetup_at ? new Date(settings.next_meetup_at).getTime() : null;
  const tick = () => {
    if (!target || Number.isNaN(target)) {
      boxes.replaceChildren(el('p', { class: 'muted', text: 'Add a date in Admin Studio.' }));
      return;
    }
    const diff = target - Date.now();
    if (diff <= 0) {
      boxes.replaceChildren(el('p', { class: 'ok-text', text: 'The day is here.' }));
      return;
    }
    const total = Math.floor(diff / 1000);
    boxes.replaceChildren(
      timeBox(Math.floor(total / 86400), 'Days'),
      timeBox(Math.floor((total % 86400) / 3600), 'Hours'),
      timeBox(Math.floor((total % 3600) / 60), 'Mins'),
      timeBox(total % 60, 'Secs')
    );
  };
  tick();
  state.countdownTimer = setInterval(tick, 1000);
}

function updateLastPing(root) {
  const holder = root.querySelector('#last-ping');
  if (!holder) return;
  const latest = state.data.pings?.[0];
  holder.replaceChildren(
    el('p', {
      class: 'status-note',
      text: latest ? `Last hug: ${formatDate(latest.pinged_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : '',
    })
  );
}
