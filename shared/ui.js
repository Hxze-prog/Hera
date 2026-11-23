export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'on') {
      for (const [event, handler] of Object.entries(value)) node.addEventListener(event, handler);
    } else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key in node && key !== 'list') {
      try {
        node[key] = value;
      } catch {
        node.setAttribute(key, value);
      }
    } else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

export function formatDate(value, options) {
  if (!value) return '';
  const raw = String(value);
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(
    undefined,
    options || { year: 'numeric', month: 'short', day: 'numeric' }
  ).format(date);
}

let toastTimer = null;

export function toast(message) {
  const box = document.getElementById('toast');
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    box.hidden = true;
  }, 2800);
}

let cleanup = [];

export function onModalClose(handler) {
  cleanup.push(handler);
}

export function closeModal() {
  const handlers = cleanup;
  cleanup = [];
  for (const handler of handlers) handler();
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.hidden = true;
  root.replaceChildren();
  document.body.style.overflow = '';
}

export function openModal(content, options = {}) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  const closeButton = el('button', {
    type: 'button',
    class: 'close-button',
    'aria-label': 'Close',
    text: 'x',
    on: { click: closeModal },
  });
  const head = el('div', { class: 'modal-head' }, [
    el('div', {}, [
      el('h2', { text: options.title || '' }),
      options.subtitle ? el('p', { class: 'muted small', text: options.subtitle }) : null,
    ]),
    el('div', { class: 'modal-actions' }, [options.action || null, closeButton]),
  ]);
  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, [head, content]);
  root.replaceChildren(modal);
  root.hidden = false;
  document.body.style.overflow = 'hidden';
  root.onclick = (event) => {
    if (event.target === root) closeModal();
  };
}

export function confirm(message, options = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(value);
    };
    const body = el('div', {}, [
      el('p', { class: 'muted', text: message }),
      el('div', { class: 'form-actions' }, [
        el('button', { type: 'button', class: 'ghost', text: 'Cancel', on: { click: () => finish(false) } }),
        el('button', {
          type: 'button',
          class: options.danger ? 'danger' : 'primary',
          text: options.confirmLabel || 'Confirm',
          on: { click: () => finish(true) },
        }),
      ]),
    ]);
    openModal(body, { title: options.title || 'Are you sure?' });
    onModalClose(() => finish(false));
  });
}

export function emptyState(message) {
  return el('div', { class: 'empty', text: `🐾 ${message}` });
}
