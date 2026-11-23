import { getConfig } from '/shared/config.js';
import { refresh, unlock } from '/shared/api.js';
import { createClient } from '/shared/client.js';
import { clearSession, getAccessToken, getRefreshToken, isAdmin, loadSession, saveSession } from '/shared/session.js';
import { primeUnlockMusic, startUnlockMusic, stopUnlockMusic } from '/shared/audio.js';
import { el, toast } from '/shared/ui.js';
import { INTRO, QUESTIONS, TIP } from './questions.js';

const els = {
  lockScreen: document.getElementById('lock-screen'),
  appShell: document.getElementById('app-shell'),
  unlockForm: document.getElementById('unlock-form'),
  pin: document.getElementById('pin'),
  lockError: document.getElementById('lock-error'),
  unlockButton: document.querySelector('#unlock-form button[type="submit"]'),
  lockButton: document.getElementById('lock-button'),
  intro: document.getElementById('intro-text'),
  tip: document.getElementById('tip-text'),
  viewerStage: document.getElementById('viewer-stage'),
  card: document.getElementById('question-card'),
  adminStage: document.getElementById('admin-stage'),
  adminAnswers: document.getElementById('admin-answers'),
  counter: document.getElementById('question-counter'),
  answerState: document.getElementById('answer-state'),
  question: document.getElementById('question-text'),
  answerField: document.getElementById('answer-field'),
  input: document.getElementById('answer-input'),
  back: document.getElementById('back-button'),
  save: document.getElementById('save-button'),
  hint: document.getElementById('hint'),
  finalNote: document.getElementById('final-note'),
  toast: document.getElementById('toast'),
};

let client = null;
let answers = new Map();
let index = 0;
let saving = false;
let animating = false;

function answerText(number) {
  const row = answers.get(number);
  return typeof row?.answer === 'string' ? row.answer.trim() : '';
}

function firstUnanswered(start) {
  for (let i = start; i < QUESTIONS.length; i += 1) {
    if (!answerText(i + 1)) return i;
  }
  return QUESTIONS.length;
}

function nextUnanswered(start) {
  return firstUnanswered(start + 1);
}

function setBusy(value) {
  saving = value;
  els.save.disabled = value;
  els.input.readOnly = value;
  els.back.disabled = value || index === 0 || index >= QUESTIONS.length;
}

const TRANSITION_FALLBACK_MS = 520;

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function waitForAnimation(node) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      node.removeEventListener('animationend', onEnd);
      resolve();
    };
    const onEnd = (event) => {
      if (event.target === node) finish();
    };
    node.addEventListener('animationend', onEnd);
    setTimeout(finish, TRANSITION_FALLBACK_MS);
  });
}

function cardSide(number) {
  return number % 2 === 1 ? 'left' : 'right';
}

async function transitionTo(nextIndex, { direction, exitingNumber }) {
  if (reducedMotion()) {
    index = nextIndex;
    renderViewer();
    setBusy(false);
    return;
  }

  animating = true;
  setBusy(true);
  els.viewerStage.setAttribute('aria-busy', 'true');

  const ghost = els.card.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  ghost.querySelectorAll('button, textarea, input').forEach((control) => {
    control.tabIndex = -1;
  });
  const ghostInput = ghost.querySelector('textarea');
  if (ghostInput) ghostInput.value = els.input.value;
  ghost.classList.add('question-card-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  els.viewerStage.appendChild(ghost);

  const ghostDone = waitForAnimation(ghost);
  const cardDone = waitForAnimation(els.card);

  if (direction === 'forward') {
    const side = cardSide(exitingNumber);
    ghost.classList.add(side === 'left' ? 'question-card--exit-left' : 'question-card--exit-right');
  } else {
    ghost.classList.add('question-card--sink');
  }

  index = nextIndex;
  renderViewer();
  els.save.disabled = true;
  els.back.disabled = true;
  els.input.readOnly = true;

  if (direction === 'forward') {
    els.card.classList.add('question-card--enter-stack');
  } else {
    const previousNumber = QUESTIONS[nextIndex]?.number ?? nextIndex + 1;
    const side = cardSide(previousNumber);
    els.card.classList.add(side === 'left' ? 'question-card--enter-left' : 'question-card--enter-right');
  }

  await Promise.all([ghostDone, cardDone]);

  ghost.remove();
  els.card.classList.remove(
    'question-card--enter-stack',
    'question-card--enter-left',
    'question-card--enter-right'
  );
  els.viewerStage.removeAttribute('aria-busy');
  animating = false;
  setBusy(false);
}

function renderAdmin() {
  const rows = QUESTIONS.map((question) => {
    const saved = answerText(question.number);
    return el('div', { class: 'answer-row' }, [
      el('strong', { text: `${question.number}. ${question.text}` }),
      el('p', { text: saved || 'No answer yet.' }),
    ]);
  });
  els.adminAnswers.replaceChildren(...rows);
}

function renderViewer() {
  if (index >= QUESTIONS.length) {
    els.counter.textContent = 'All done';
    els.answerState.textContent = `${QUESTIONS.length} / ${QUESTIONS.length} saved`;
    els.question.textContent = `You answered all ${QUESTIONS.length} little things. ♥`;
    els.answerField.hidden = true;
    els.save.hidden = true;
    els.back.hidden = false;
    els.back.disabled = false;
    els.input.readOnly = false;
    els.hint.textContent = 'Tap Back to revisit or edit an answer.';
    els.finalNote.hidden = false;
    els.finalNote.replaceChildren(
      document.createTextNode('Hi baby can you click '),
      el('a', {
        href: 'https://mail.google.com/mail/u/0/',
        target: '_blank',
        rel: 'noopener noreferrer',
        text: 'this',
      }),
      document.createTextNode(' and verify your roblox acc??')
    );
    return;
  }

  const question = QUESTIONS[index];
  const saved = answerText(question.number);

  els.counter.textContent = `Question ${index + 1} of ${QUESTIONS.length}`;
  els.answerState.textContent = saved ? 'Saved' : 'Not answered yet';
  els.question.textContent = question.text;
  els.answerField.hidden = false;
  els.input.value = saved;
  els.input.readOnly = false;
  els.save.hidden = false;
  els.save.disabled = false;
  els.back.hidden = false;
  els.back.disabled = index === 0;
  els.hint.textContent = saved
    ? 'Saved. You can edit it before moving on.'
    : 'Your answer saves to our private place.';
  els.finalNote.hidden = true;
  els.finalNote.replaceChildren();
}

function render() {
  if (isAdmin()) {
    els.viewerStage.hidden = true;
    els.adminStage.hidden = false;
    renderAdmin();
    return;
  }
  els.viewerStage.hidden = false;
  els.adminStage.hidden = true;
  renderViewer();
}

async function saveAnswer() {
  if (animating || saving || isAdmin() || index >= QUESTIONS.length) return;
  const question = QUESTIONS[index];
  const answer = els.input.value.trim();
  if (!answer) {
    toast('Write an answer first');
    els.input.focus();
    return;
  }

  setBusy(true);
  try {
    let row = answers.get(question.number);
    if (row?.id) {
      const rows = await client.update('question_answers', row.id, { answer });
      row = rows?.[0] || { ...row, answer };
    } else {
      const rows = await client.insert('question_answers', {
        question_number: question.number,
        question_text: question.text,
        answer,
      });
      row = rows?.[0] || { question_number: question.number, question_text: question.text, answer };
    }
    answers.set(question.number, row);
    await transitionTo(nextUnanswered(index), { direction: 'forward', exitingNumber: question.number });
    toast('Saved');
  } catch {
    setBusy(false);
    toast('Could not save right now');
  }
}

async function goBack() {
  if (animating || saving || index === 0) return;
  const previousIndex = index >= QUESTIONS.length ? QUESTIONS.length - 1 : index - 1;
  await transitionTo(previousIndex, { direction: 'back' });
}

function showLock(message = '') {
  stopUnlockMusic();
  els.appShell.hidden = true;
  els.lockScreen.hidden = false;
  els.lockError.textContent = message;
  els.pin.value = '';
  setTimeout(() => els.pin.focus(), 50);
}

async function establishClient() {
  if (!client) {
    const config = await getConfig();
    client = createClient(config, getAccessToken);
  }
}

async function loadAnswers() {
  const rows = await client.list('question_answers', { order: 'question_number' });
  answers = new Map();
  for (const row of rows || []) {
    const number = Number(row.question_number);
    if (number >= 1 && number <= QUESTIONS.length) answers.set(number, row);
  }
}

async function enterApp() {
  await establishClient();
  await loadAnswers();
  index = firstUnanswered(0);
  els.lockScreen.hidden = true;
  els.appShell.hidden = false;
  els.intro.textContent = INTRO;
  els.tip.textContent = TIP;
  render();
}

els.unlockForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.lockError.textContent = '';
  primeUnlockMusic();
  els.unlockButton.disabled = true;
  try {
    const result = await unlock(els.pin.value.trim());
    saveSession(result);
    startUnlockMusic();
    await enterApp();
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

els.back.addEventListener('click', goBack);
els.save.addEventListener('click', saveAnswer);
els.input.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    saveAnswer();
  }
});

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
    navigator.serviceWorker.register('/sw.js').catch(() => toast('Offline mode unavailable'));
  });
}

restoreSession().catch(() => showLock('Service unavailable. Try again soon.'));
