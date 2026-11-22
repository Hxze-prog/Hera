import { state } from '../state.js';
import { el, emptyState, onModalClose, openModal, toast } from '../ui.js';
import { createAudioPlayer, createVideoPlayer } from '../media.js';
import { getOpenedIds, markOpened } from '../session.js';

const EMBED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'm.youtube.com',
  'spotify.com',
  'www.spotify.com',
  'open.spotify.com',
  'soundcloud.com',
  'www.soundcloud.com',
];

function embedUrl(raw) {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || !EMBED_HOSTS.includes(parsed.hostname)) return null;
    if (parsed.hostname.includes('youtube') && parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v');
      if (!id || !/^[\w-]+$/.test(id)) return null;
      return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (parsed.hostname.includes('youtu.be')) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function signedMedia(path) {
  if (!path) return null;
  try {
    return await state.client.signedUrl(path, 3600);
  } catch {
    return null;
  }
}

const pendingHearts = new Set();

function syncHeartButtons(item) {
  for (const button of document.querySelectorAll('.heart-button')) {
    if (button.dataset.heartId !== item.id) continue;
    button.classList.toggle('loved', Boolean(item.is_loved));
    button.textContent = item.is_loved ? '♥' : '♡';
    button.setAttribute('aria-label', item.is_loved ? 'Remove heart' : 'Heart this letter');
    button.setAttribute('aria-pressed', item.is_loved ? 'true' : 'false');
    button.disabled = pendingHearts.has(item.id);
  }
}

function createHeartButton(item) {
  const button = el('button', {
    type: 'button',
    class: `heart-button${item.is_loved ? ' loved' : ''}`,
    dataset: { heartId: item.id },
    'aria-label': item.is_loved ? 'Remove heart' : 'Heart this letter',
    'aria-pressed': item.is_loved ? 'true' : 'false',
    text: item.is_loved ? '♥' : '♡',
    on: {
      click: (event) => {
        event.stopPropagation();
        toggleHeart(item);
      },
    },
  });
  button.disabled = pendingHearts.has(item.id);
  return button;
}

async function toggleHeart(item) {
  if (pendingHearts.has(item.id)) return;
  const next = !item.is_loved;
  pendingHearts.add(item.id);
  item.is_loved = next;
  renderEnvelopes();
  syncHeartButtons(item);
  try {
    await state.client.update('envelopes', item.id, { is_loved: next });
    toast(next ? 'Hearted' : 'Heart removed');
  } catch {
    item.is_loved = !next;
    toast('Could not update heart');
  } finally {
    pendingHearts.delete(item.id);
    renderEnvelopes();
    syncHeartButtons(item);
  }
}

export function renderEnvelopes() {
  const root = document.getElementById('envelopes-list');
  if (!root) return;
  const items = state.data.envelopes;
  if (!items.length) {
    root.replaceChildren(emptyState('No letters yet. Check back soon.'));
    return;
  }
  const opened = getOpenedIds();
  const cards = items.map((item) => {
    const preview = (item.message || '').replace(/\s+/g, ' ').trim().slice(0, 88);
    const category = item.category || item.title || 'Letter';
    const header = el('div', { class: 'letter-card-header' }, [
      el('span', { class: 'card-icon', text: item.icon || 'L' }),
      el('span', { class: 'badge', text: category }),
    ]);
    const footer = el('div', { class: 'letter-footer' }, [
      opened.has(item.id) ? el('span', { class: 'muted small', text: 'Opened' }) : null,
    ]);
    if (state.role === 'viewer') footer.append(createHeartButton(item));
    const card = el('div', { class: 'card clickable', tabIndex: 0, role: 'button' }, [
      header,
      el('p', { class: 'letter-title', text: item.title || category }),
      el('p', { text: preview ? `${preview}${preview.length === 88 ? '...' : ''}` : 'Open to read.' }),
      opened.has(item.id) || state.role === 'viewer' ? footer : null,
    ]);
    card.addEventListener('click', () => openEnvelope(item));
    card.addEventListener('keydown', (event) => {
      if (event.target !== card) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openEnvelope(item);
      }
    });
    return card;
  });
  root.replaceChildren(...cards);
}

function openEnvelope(item) {
  markOpened(item.id);
  renderEnvelopes();
  const title = item.title || item.category || 'Letter';
  const category = item.category || '';

  const body = el('div', {});
  let closed = false;
  onModalClose(() => {
    closed = true;
  });

  if (item.photo_path) {
    const image = el('img', { alt: title, loading: 'lazy' });
    body.append(el('div', { class: 'polaroid' }, [image]));
    signedMedia(item.photo_path).then((url) => {
      if (url && !closed) image.src = url;
      else image.remove();
    });
  }

  const paragraphs = String(item.message || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => el('p', { text: part }));
  body.append(el('div', { class: 'letter-text' }, paragraphs.length ? paragraphs : [el('p', { text: '' })]));

  if (item.voice_path) {
    const holder = el('div', {});
    body.append(holder);
    signedMedia(item.voice_path).then((url) => {
      if (!url || closed) return;
      const player = createAudioPlayer(url, 'Voice note');
      onModalClose(player.stop);
      holder.replaceChildren(player.element);
    });
  }

  if (item.video_path) {
    const holder = el('div', {});
    body.append(holder);
    signedMedia(item.video_path).then((url) => {
      if (!url || closed) return;
      const player = createVideoPlayer(url);
      onModalClose(player.stop);
      holder.replaceChildren(player.element);
    });
  }

  const allowedEmbed = embedUrl(item.song_embed_url);
  if (allowedEmbed) {
    body.append(el('iframe', {
      class: 'embed-frame',
      src: allowedEmbed,
      title: 'Song',
      allow: 'encrypted-media; picture-in-picture',
      sandbox: 'allow-scripts allow-same-origin allow-presentation',
      referrerPolicy: 'no-referrer',
      loading: 'lazy',
      allowFullScreen: true,
    }));
  }

  openModal(body, {
    title: item.icon ? `${item.icon} ${title}` : title,
    subtitle: category,
    action: state.role === 'viewer' ? createHeartButton(item) : null,
  });
}
