import { state } from './state.js';
import { loadData, reloadSettings } from './data.js';
import { closeModal, confirm, el, formatDate, openModal, toast } from '/shared/ui.js';
import { renderDistance } from './views/distance.js';

const LETTER_MOODS = [
  { label: 'You miss me', emoji: '🥺', title: 'Always Here' },
  { label: 'You have a bad day', emoji: '🩹', title: 'Deep Breath' },
  { label: "You can't sleep", emoji: '😴', title: 'Rest Easy' },
  { label: 'You need a smile', emoji: '😄', title: 'Smile Now' },
  { label: 'You feel stressed or overwhelmed', emoji: '😰', title: 'Slow Down' },
  { label: 'You need motivation', emoji: '✨', title: "You've Got This" },
  { label: 'You feel lonely', emoji: '😔', title: 'Never Alone' },
  { label: 'You are mad at me or we had a misunderstanding', emoji: '🤷', title: "I'm Listening" },
];

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function nextEnvelopeIndex(category) {
  return state.data.envelopes.reduce(
    (max, item) => (item.category === category ? Math.max(max, Number(item.index_per_category) || 0) : max),
    0
  ) + 1;
}

function field(label, input) {
  return el('label', { class: 'field' }, [el('span', { text: label }), input]);
}

function selectInput(options, value = '') {
  const select = el('select');
  for (const option of options) select.append(el('option', { value: option.value, text: option.label }));
  select.value = value || '';
  return select;
}

function textInput(value = '', options = {}) {
  return el('input', {
    type: options.type || 'text',
    value: value || '',
    placeholder: options.placeholder || '',
    ...(options.attrs || {}),
  });
}

function numberInput(value) {
  return el('input', { type: 'number', value: String(value ?? 0), min: '0' });
}

async function uploadFile(file, folder) {
  const extension = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${folder}/${unique}.${extension}`;
  await state.client.upload(path, file, file.type || 'application/octet-stream');
  return path;
}

async function removeFiles(paths) {
  for (const path of paths.filter(Boolean)) {
    try {
      await state.client.removeFile(path);
    } catch {
      toast('Could not remove an old attachment');
    }
  }
}

function actions(buttons) {
  return el('div', { class: 'form-actions' }, buttons);
}

function row(title, subtitle, onEdit, onDelete) {
  return el('div', { class: 'admin-row' }, [
    el('div', {}, [
      el('div', { text: title }),
      subtitle ? el('div', { class: 'muted small', text: subtitle }) : null,
    ]),
    el('div', { class: 'admin-row-actions' }, [
      el('button', { type: 'button', class: 'soft small', text: 'Edit', on: { click: onEdit } }),
      el('button', { type: 'button', class: 'danger small', text: 'Delete', on: { click: onDelete } }),
    ]),
  ]);
}

function section(title, subtitle, addLabel, onAdd, rows) {
  return el('section', { class: 'admin-section' }, [
    el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' } }, [
      el('h3', { text: title }),
      el('button', { type: 'button', class: 'soft small', text: addLabel, on: { click: onAdd } }),
    ]),
    el('p', { class: 'muted small', text: subtitle }),
    el('div', { class: 'admin-list' }, rows.length ? rows : [el('p', { class: 'muted small', text: 'Nothing here yet.' })]),
  ]);
}

async function deleteItem(table, item, label, fileFields) {
  const accepted = await confirm(`Delete "${label}"? This cannot be undone.`, {
    title: 'Delete item',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!accepted) return;
  try {
    await removeFiles(fileFields.map((key) => item[key]));
    await state.client.remove(table, item.id);
    await loadData();
    renderAdmin();
    toast('Deleted');
  } catch {
    toast('Delete failed');
  }
}

function envelopeForm(existing) {
  const moodOptions = [{ value: '', label: 'Choose a mood...' }];
  if (existing?.category && !LETTER_MOODS.some((mood) => mood.label === existing.category)) {
    moodOptions.push({ value: existing.category, label: `Custom: ${existing.category}` });
  }
  for (const mood of LETTER_MOODS) {
    moodOptions.push({ value: mood.label, label: mood.label });
  }
  const category = selectInput(moodOptions, existing?.category || '');
  const selectedMood = () => LETTER_MOODS.find((mood) => mood.label === category.value);
  const iconPreview = el('div', { class: 'muted small', text: `Icon: ${selectedMood()?.emoji || existing?.icon || '—'}` });
  category.addEventListener('change', () => {
    iconPreview.textContent = `Icon: ${selectedMood()?.emoji || existing?.icon || '—'}`;
  });
  const message = el('textarea', { value: existing?.message || '', placeholder: 'Write the letter...' });
  const song = textInput(existing?.song_embed_url || '', { placeholder: 'https://...' });
  const order = numberInput(existing?.sort_order ?? 0);
  const photo = el('input', { type: 'file', accept: 'image/*' });
  const voice = el('input', { type: 'file', accept: 'audio/*' });
  const video = el('input', { type: 'file', accept: 'video/*' });
  const hints = [];
  if (existing?.photo_path) hints.push('Photo attached');
  if (existing?.voice_path) hints.push('Voice note attached');
  if (existing?.video_path) hints.push('Video attached');

  const save = el('button', { type: 'button', class: 'primary', text: existing ? 'Save changes' : 'Create letter' });
  save.addEventListener('click', async () => {
    if (!category.value) {
      toast('Choose a mood first');
      return;
    }
    const preservedIndex = Number(existing?.index_per_category) || 0;
    const index = category.value === existing?.category && preservedIndex > 0
      ? preservedIndex
      : nextEnvelopeIndex(category.value);
    const title = `${selectedMood()?.title || category.value} #${index}`;
    const files = [photo.files?.[0], voice.files?.[0], video.files?.[0]].filter(Boolean);
    if (files.some((file) => file.size > MAX_UPLOAD_BYTES)) {
      toast('Files must be under 50 MB');
      return;
    }
    save.disabled = true;
    try {
      let photoPath = existing?.photo_path || null;
      let voicePath = existing?.voice_path || null;
      let videoPath = existing?.video_path || null;
      if (photo.files?.[0]) photoPath = await uploadFile(photo.files[0], 'envelopes');
      if (voice.files?.[0]) voicePath = await uploadFile(voice.files[0], 'envelopes');
      if (video.files?.[0]) videoPath = await uploadFile(video.files[0], 'envelopes');
      const payload = {
        title,
        index_per_category: index,
        icon: selectedMood()?.emoji || existing?.icon || 'L',
        category: category.value,
        message: message.value,
        photo_path: photoPath,
        voice_path: voicePath,
        video_path: videoPath,
        song_embed_url: song.value.trim() || null,
        sort_order: Number(order.value) || 0,
      };
      if (existing) await state.client.update('envelopes', existing.id, payload);
      else await state.client.insert('envelopes', payload);
      if (photo.files?.[0] && existing?.photo_path) await removeFiles([existing.photo_path]);
      if (voice.files?.[0] && existing?.voice_path) await removeFiles([existing.voice_path]);
      if (video.files?.[0] && existing?.video_path) await removeFiles([existing.video_path]);
      await loadData();
      closeModal();
      renderAdmin();
      toast('Letter saved');
    } catch {
      toast('Could not save the letter');
    } finally {
      save.disabled = false;
    }
  });

  openModal(el('div', { class: 'form-grid' }, [
    field('Category', el('div', {}, [category, iconPreview])),
    field('Letter', message),
    field('Song embed URL (optional)', song),
    el('div', { class: 'form-row' }, [field('Photo', photo), field('Voice note', voice), field('Video', video)]),
    hints.length ? el('p', { class: 'muted small', text: hints.join(' / ') }) : null,
    field('Sort order', order),
    actions([el('button', { type: 'button', class: 'ghost', text: 'Cancel', on: { click: closeModal } }), save]),
  ]), { title: existing ? 'Edit letter' : 'New letter' });
}

function memoryForm(existing) {
  const title = textInput(existing?.title || '', { placeholder: 'That one evening' });
  const caption = el('textarea', { value: existing?.caption || '', placeholder: 'What happened?' });
  const date = textInput(existing?.memory_date || '', { type: 'date' });
  const order = numberInput(existing?.sort_order ?? 0);
  const photo = el('input', { type: 'file', accept: 'image/*' });
  const voice = el('input', { type: 'file', accept: 'audio/*' });
  const video = el('input', { type: 'file', accept: 'video/*' });
  const hints = [];
  if (existing?.photo_path) hints.push('Photo attached');
  if (existing?.voice_path) hints.push('Voice note attached');
  if (existing?.video_path) hints.push('Video attached');

  const save = el('button', { type: 'button', class: 'primary', text: existing ? 'Save changes' : 'Add memory' });
  save.addEventListener('click', async () => {
    if (!title.value.trim()) {
      toast('Add a title first');
      return;
    }
    const files = [photo.files?.[0], voice.files?.[0], video.files?.[0]].filter(Boolean);
    if (files.some((file) => file.size > MAX_UPLOAD_BYTES)) {
      toast('Files must be under 50 MB');
      return;
    }
    save.disabled = true;
    try {
      let photoPath = existing?.photo_path || null;
      let voicePath = existing?.voice_path || null;
      let videoPath = existing?.video_path || null;
      if (photo.files?.[0]) photoPath = await uploadFile(photo.files[0], 'memories');
      if (voice.files?.[0]) voicePath = await uploadFile(voice.files[0], 'memories');
      if (video.files?.[0]) videoPath = await uploadFile(video.files[0], 'memories');
      const payload = {
        title: title.value.trim(),
        caption: caption.value,
        memory_date: date.value || null,
        photo_path: photoPath,
        voice_path: voicePath,
        video_path: videoPath,
        sort_order: Number(order.value) || 0,
      };
      if (existing) await state.client.update('memories', existing.id, payload);
      else await state.client.insert('memories', payload);
      if (photo.files?.[0] && existing?.photo_path) await removeFiles([existing.photo_path]);
      if (voice.files?.[0] && existing?.voice_path) await removeFiles([existing.voice_path]);
      if (video.files?.[0] && existing?.video_path) await removeFiles([existing.video_path]);
      await loadData();
      closeModal();
      renderAdmin();
      toast('Memory saved');
    } catch {
      toast('Could not save the memory');
    } finally {
      save.disabled = false;
    }
  });

  openModal(el('div', { class: 'form-grid' }, [
    field('Title', title),
    field('Caption', caption),
    el('div', { class: 'form-row' }, [field('Date', date), field('Sort order', order)]),
    el('div', { class: 'form-row' }, [field('Photo', photo), field('Voice note', voice), field('Video', video)]),
    hints.length ? el('p', { class: 'muted small', text: hints.join(' / ') }) : null,
    actions([el('button', { type: 'button', class: 'ghost', text: 'Cancel', on: { click: closeModal } }), save]),
  ]), { title: existing ? 'Edit memory' : 'New memory' });
}

function voucherForm(existing) {
  const title = textInput(existing?.title || '', { placeholder: 'Movie night' });
  const description = el('textarea', { value: existing?.description || '', placeholder: 'What is included?' });
  const order = numberInput(existing?.sort_order ?? 0);
  const redeemed = el('input', { type: 'checkbox', checked: Boolean(existing?.is_redeemed) });

  const save = el('button', { type: 'button', class: 'primary', text: existing ? 'Save changes' : 'Add voucher' });
  save.addEventListener('click', async () => {
    if (!title.value.trim()) {
      toast('Add a title first');
      return;
    }
    save.disabled = true;
    try {
      const payload = {
        title: title.value.trim(),
        description: description.value,
        icon: '🤍',
        sort_order: Number(order.value) || 0,
        is_redeemed: redeemed.checked,
        redeemed_at: redeemed.checked ? existing?.redeemed_at || new Date().toISOString() : null,
      };
      if (existing) await state.client.update('vouchers', existing.id, payload);
      else await state.client.insert('vouchers', payload);
      await loadData();
      closeModal();
      renderAdmin();
      toast('Voucher saved');
    } catch {
      toast('Could not save the voucher');
    } finally {
      save.disabled = false;
    }
  });

  openModal(el('div', { class: 'form-grid' }, [
    field('Title', title),
    field('Description', description),
    field('Sort order', order),
    el('label', { class: 'field' }, [el('span', { text: 'Redeemed' }), redeemed]),
    actions([el('button', { type: 'button', class: 'ghost', text: 'Cancel', on: { click: closeModal } }), save]),
  ]), { title: existing ? 'Edit voucher' : 'New voucher' });
}

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function settingsForm() {
  const current = state.data.settings || {};
  const target = textInput(toLocalInput(current.next_meetup_at), { type: 'datetime-local' });
  const note = textInput(current.status_note || '', { placeholder: 'Counting down...' });
  const save = el('button', { type: 'button', class: 'primary', text: 'Save settings' });

  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      const patch = {
        next_meetup_at: target.value ? new Date(target.value).toISOString() : null,
        status_note: note.value.trim(),
        updated_at: new Date().toISOString(),
      };
      if (current.id) await state.client.update('app_settings', current.id, patch);
      else await state.client.insert('app_settings', { id: 1, ...patch });
      await reloadSettings();
      renderDistance();
      closeModal();
      renderAdmin();
      toast('Settings saved');
    } catch {
      toast('Could not save settings');
    } finally {
      save.disabled = false;
    }
  });

  openModal(el('div', { class: 'form-grid' }, [
    field('Next meetup or call', target),
    field('Status note', note),
    actions([el('button', { type: 'button', class: 'ghost', text: 'Cancel', on: { click: closeModal } }), save]),
  ]), { title: 'Distance settings' });
}

export function renderAdmin() {
  const root = document.getElementById('admin-content');
  if (!root) return;

  const envelopeRows = state.data.envelopes.map((item) => {
    const label = item.title || item.category || 'Letter';
    return row(label, item.is_loved ? '♥' : '', () => envelopeForm(item), () => deleteItem('envelopes', item, label, ['photo_path', 'voice_path', 'video_path']));
  });
  const memoryRows = state.data.memories.map((item) =>
    row(item.title, item.memory_date ? formatDate(item.memory_date) : '', () => memoryForm(item), () => deleteItem('memories', item, item.title, ['photo_path', 'voice_path', 'video_path']))
  );
  const voucherRows = state.data.vouchers.map((item) =>
    row(item.title, item.is_redeemed ? 'Redeemed' : 'Available', () => voucherForm(item), () => deleteItem('vouchers', item, item.title, []))
  );

  root.replaceChildren(
    section('Letters', 'Create and edit the Open When letters.', 'New letter', () => envelopeForm(null), envelopeRows),
    section('Memories', 'Add photos, notes, and voice recordings.', 'New memory', () => memoryForm(null), memoryRows),
    section('Vouchers', 'Manage redeemable date and care passes.', 'New voucher', () => voucherForm(null), voucherRows),
    section('Distance', 'Set the next meetup and a status note.', 'Edit settings', settingsForm, [])
  );
}
