import { getSurpriseConfig, refresh, unlock } from '/shared/api.js';
import { primeUnlockMusic, startUnlockMusic, stopUnlockMusic } from '/shared/audio.js';
import { clearSession, getRefreshToken, loadSession, saveSession } from '/shared/session.js';

const els = {
  lockScreen: document.getElementById('lock-screen'),
  appShell: document.getElementById('app-shell'),
  unlockForm: document.getElementById('unlock-form'),
  pin: document.getElementById('pin'),
  lockError: document.getElementById('lock-error'),
  unlockButton: document.querySelector('#unlock-form button[type="submit"]'),
  lockButton: document.getElementById('lock-button'),
  envelope: document.getElementById('envelope'),
  card: document.getElementById('surprise-card'),
  username: document.getElementById('surprise-username'),
  password: document.getElementById('surprise-password'),
};

let revealed = false;

function showLock(message = '') {
  stopUnlockMusic();
  els.appShell.hidden = true;
  els.lockScreen.hidden = false;
  els.lockError.textContent = message;
  els.pin.value = '';
  setTimeout(() => els.pin.focus(), 50);
}

function resetSurprise() {
  revealed = false;
  els.envelope.hidden = false;
  els.envelope.classList.remove('is-open');
  els.envelope.setAttribute('aria-expanded', 'false');
  els.card.hidden = true;
  els.card.classList.remove('is-visible');
}

function enterApp() {
  els.lockScreen.hidden = true;
  els.appShell.hidden = false;
  resetSurprise();
}

async function loadSurpriseConfig() {
  try {
    const config = await getSurpriseConfig();
    if (typeof config?.username === 'string' && config.username) {
      els.username.textContent = config.username;
    }
    if (typeof config?.password === 'string' && config.password) {
      els.password.textContent = config.password;
    }
  } catch {
    return;
  }
}

function revealSurprise() {
  if (revealed) return;
  revealed = true;
  els.envelope.classList.add('is-open');
  els.envelope.setAttribute('aria-expanded', 'true');
  els.card.hidden = false;
  els.card.classList.add('is-visible');
  setTimeout(() => {
    if (revealed) els.envelope.hidden = true;
  }, 440);
}

els.unlockForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.lockError.textContent = '';
  primeUnlockMusic();
  els.unlockButton.disabled = true;
  try {
    const result = await unlock(els.pin.value.trim());
    saveSession(result);
    await loadSurpriseConfig();
    startUnlockMusic();
    enterApp();
    els.pin.value = '';
  } catch {
    stopUnlockMusic();
    els.lockError.textContent = 'Invalid PIN. Try again.';
  } finally {
    els.unlockButton.disabled = false;
  }
});

els.lockButton.addEventListener('click', () => {
  clearSession();
  showLock();
});

els.envelope.addEventListener('click', revealSurprise);

async function restoreSession() {
  const saved = loadSession();
  if (!saved?.refresh_token) {
    showLock();
    return;
  }
  try {
    const result = await refresh(saved.refresh_token);
    saveSession(result);
    await loadSurpriseConfig();
    enterApp();
  } catch {
    clearSession();
    showLock();
  }
}

setInterval(async () => {
  const token = getRefreshToken();
  if (!token || els.appShell.hidden) return;
  try {
    const result = await refresh(token);
    saveSession(result);
  } catch {
    clearSession();
    showLock('Session expired. Unlock again.');
  }
}, 45 * 60 * 1000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

restoreSession().catch(() => showLock('Service unavailable. Try again soon.'));
