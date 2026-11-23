const SOURCES = ['/audio/song-1.mp3', '/audio/song-2.mp3'];
const VOLUME = 0.35;

let tracks = [];
let playing = false;
let currentIndex = 0;
let primed = false;

function playTrack(index) {
  if (!playing) return;
  currentIndex = index;
  const audio = tracks[index];
  tracks[1 - index].pause();
  audio.muted = false;
  audio.currentTime = 0;
  const promise = audio.play();
  if (promise) {
    promise.catch((error) => {
      if (error?.name !== 'AbortError') playing = false;
    });
  }
}

function ensureTracks() {
  if (tracks.length) return tracks;
  tracks = SOURCES.map((src) => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.loop = false;
    audio.volume = VOLUME;
    return audio;
  });
  tracks[0].addEventListener('ended', () => {
    if (playing) playTrack(1);
  });
  tracks[1].addEventListener('ended', () => {
    if (playing) playTrack(0);
  });
  return tracks;
}

export function primeUnlockMusic() {
  const audio = ensureTracks()[0];
  if (primed) return;
  primed = true;
  audio.muted = true;
  const promise = audio.play();
  if (promise) {
    promise.catch(() => {
      primed = false;
    });
  }
}

export function startUnlockMusic() {
  ensureTracks();
  if (playing) return;
  playing = true;
  const first = tracks[0];
  if (!first.paused) {
    first.muted = false;
    return;
  }
  playTrack(0);
}

export function stopUnlockMusic() {
  playing = false;
  primed = false;
  for (const audio of tracks) {
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
  }
}

window.addEventListener('pagehide', stopUnlockMusic);
