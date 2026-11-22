import { state } from '../state.js';
import { el, emptyState, formatDate, onModalClose, openModal } from '../ui.js';
import { createAudioPlayer, createVideoPlayer } from '../media.js';

export function renderMemories() {
  const root = document.getElementById('memories-list');
  if (!root) return;
  const items = state.data.memories;
  if (!items.length) {
    root.replaceChildren(emptyState('No memories yet. This wall is waiting.'));
    return;
  }
  const cards = items.map((item) => {
    const card = el('div', { class: 'card clickable', tabIndex: 0, role: 'button' }, [
      item.memory_date ? el('span', { class: 'badge', text: formatDate(item.memory_date) }) : null,
      el('h3', { text: item.title }),
      el('p', { text: item.caption || '' }),
    ]);
    card.addEventListener('click', () => openMemory(item));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMemory(item);
      }
    });
    return card;
  });
  root.replaceChildren(...cards);
}

function openMemory(item) {
  const body = el('div', {});
  let closed = false;
  onModalClose(() => {
    closed = true;
  });

  if (item.photo_path) {
    const image = el('img', { alt: item.title, loading: 'lazy' });
    body.append(el('div', { class: 'polaroid' }, [image]));
    state.client.signedUrl(item.photo_path, 3600).then((url) => {
      if (url && !closed) image.src = url;
      else image.remove();
    }).catch(() => image.remove());
  }

  body.append(el('p', { class: 'letter-text', text: item.caption || '' }));

  if (item.voice_path) {
    const holder = el('div', {});
    body.append(holder);
    state.client.signedUrl(item.voice_path, 3600).then((url) => {
      if (!url || closed) return;
      const player = createAudioPlayer(url, 'Voice note');
      onModalClose(player.stop);
      holder.replaceChildren(player.element);
    }).catch(() => {});
  }

  if (item.video_path) {
    const holder = el('div', {});
    body.append(holder);
    state.client.signedUrl(item.video_path, 3600).then((url) => {
      if (!url || closed) return;
      const player = createVideoPlayer(url);
      onModalClose(player.stop);
      holder.replaceChildren(player.element);
    }).catch(() => {});
  }

  openModal(body, {
    title: item.title,
    subtitle: item.memory_date ? formatDate(item.memory_date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '',
  });
}
