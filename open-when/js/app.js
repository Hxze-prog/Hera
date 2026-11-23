import { getConfig } from '/shared/config.js';
import { refresh, unlock } from '/shared/api.js';
import { createClient } from '/shared/client.js';
import { state } from './state.js';
import { clearSession, getAccessToken, getRefreshToken, getRole, isAdmin, loadSession, saveSession } from '/shared/session.js';
import { primeUnlockMusic, startUnlockMusic, stopUnlockMusic } from '/shared/audio.js';
import { closeModal, toast } from '/shared/ui.js';
import { loadData } from './data.js';
import { renderAdmin } from './admin.js';
import { renderEnvelopes } from './views/envelopes.js';
import { renderMemories } from './views/memories.js';
import { renderVouchers } from './views/vouchers.js';
import { renderDistance, stopCountdown } from './views/distance.js';

const lockScreen = document.getElementById('lock-screen');
const appShell = document.getElementById('app-shell');
const unlockForm = document.getElementById('unlock-form');
const pinInput = document.getElementById('pin');
const lockError = document.getElementById('lock-error');
const unlockButton = unlockForm.querySelector('button[type="submit"]');

const renderers = {
  envelopes: renderEnvelopes,
  memories: renderMemories,
  vouchers: renderVouchers,
  distance: renderDistance,
  admin: renderAdmin,
};

function showLock(message = '') {
  stopCountdown();
  stopUnlockMusic();
  appShell.hidden = true;
  lockScreen.hidden = false;
  lockError.textContent = message;
  pinInput.value = '';
  setTimeout(() => pinInput.focus(), 50);
}

function showApp() {
  lockScreen.hidden = true;
  appShell.hidden = false;
  state.role = getRole();
  document.getElementById('nav-admin').hidden = !isAdmin();
  document.getElementById('header-date').textContent = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
  switchView(isAdmin() ? 'admin' : 'envelopes');
}

function switchView(name) {
  if (name === 'admin' && !isAdmin()) name = 'envelopes';
  if (state.view && state.view !== name) stopCountdown();
  state.view = name;
  for (const section of document.querySelectorAll('.view')) {
    section.hidden = section.id !== `view-${name}`;
  }
  for (const button of document.querySelectorAll('.nav-item')) {
    button.classList.toggle('active', button.dataset.view === name);
  }
  renderers[name]?.();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

async function establishClient() {
  if (!state.config) state.config = await getConfig();
  state.client = createClient(state.config, getAccessToken);
  state.role = getRole();
}

async function enterApp() {
  await establishClient();
  await loadData();
  showApp();
}

unlockForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  lockError.textContent = '';
  primeUnlockMusic();
  unlockButton.disabled = true;
  try {
    const result = await unlock(pinInput.value.trim());
    saveSession(result);
    startUnlockMusic();
    await enterApp();
    pinInput.value = '';
  } catch (error) {
    if (error.status === 429) lockError.textContent = 'Too many attempts. Try again later.';
    else lockError.textContent = 'Invalid PIN. Try again.';
  } finally {
    unlockButton.disabled = false;
  }
});

document.getElementById('lock-button').addEventListener('click', () => {
  closeModal();
  clearSession();
  showLock();
});

for (const button of document.querySelectorAll('.nav-item')) {
  button.addEventListener('click', () => switchView(button.dataset.view));
}

async function restoreSession() {
  const saved = loadSession();
  if (!saved?.refresh_token) {
    showLock();
    return;
  }
  try {
    const result = await refresh(saved.refresh_token);
    saveSession(result);
    await enterApp();
  } catch {
    clearSession();
    showLock();
  }
}

setInterval(async () => {
  const token = getRefreshToken();
  if (!token || appShell.hidden) return;
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
    navigator.serviceWorker.register('/sw.js').catch(() => toast('Offline mode unavailable'));
  });
}

restoreSession().catch(() => showLock('Service unavailable. Try again soon.'));
