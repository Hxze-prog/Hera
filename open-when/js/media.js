import { el } from '/shared/ui.js';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = String(total % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function createAudioPlayer(url, label = 'Voice note') {
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.src = url;

  const toggle = el('button', { type: 'button', text: 'Play', 'aria-label': 'Play' });
  const seek = el('input', { type: 'range', min: '0', max: '100', value: '0', 'aria-label': 'Seek' });
  const time = el('span', { class: 'time', text: '0:00' });

  toggle.addEventListener('click', async () => {
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch {
      time.textContent = 'Unavailable';
    }
  });

  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = (Number(seek.value) / 100) * audio.duration;
    }
  });

  audio.addEventListener('play', () => {
    toggle.textContent = 'Pause';
  });
  audio.addEventListener('pause', () => {
    toggle.textContent = 'Play';
  });
  audio.addEventListener('ended', () => {
    toggle.textContent = 'Play';
  });
  audio.addEventListener('timeupdate', () => {
    const duration = audio.duration;
    seek.value = String(duration ? (audio.currentTime / duration) * 100 : 0);
    time.textContent = `${formatTime(audio.currentTime)} / ${formatTime(duration || 0)}`;
  });

  return {
    element: el('div', { class: 'audio-player' }, [
      toggle,
      el('span', { class: 'muted small', text: label }),
      seek,
      time,
    ]),
    stop() {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    },
  };
}

export function createVideoPlayer(url) {
  const video = el('video', { src: url, controls: true, playsInline: true, preload: 'metadata' });
  return {
    element: el('div', { class: 'video-player' }, [video]),
    stop() {
      video.pause();
      video.removeAttribute('src');
      video.load();
    },
  };
}
