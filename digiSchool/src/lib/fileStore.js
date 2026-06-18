// fileStore.js — localStorage-based file storage for PDFs (assignments & study materials)
// In production this would use Supabase Storage buckets instead.

const KEY = 'eduone_files';

function _load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function _save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function saveFile({ id, name, base64, type, subject, targetClass, description, dueDate, uploadedBy, uploadedAt }) {
  const store = _load();
  store[id] = { id, name, base64, type, subject, targetClass, description, dueDate, uploadedBy, uploadedAt: uploadedAt || new Date().toISOString() };
  _save(store);
}

export function listFiles(type, subject) {
  const store = _load();
  return Object.values(store).filter(f =>
    (!type || f.type === type) &&
    (!subject || subject === 'All' || f.subject === subject)
  ).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function getFile(id) {
  return _load()[id] || null;
}

export function deleteFile(id) {
  const store = _load();
  delete store[id];
  _save(store);
}

export function openFilePDF(id) {
  const f = getFile(id);
  if (!f) return;
  const byteString = atob(f.base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const blob = new Blob([ab], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export function downloadFilePDF(id) {
  const f = getFile(id);
  if (!f) return;
  const a = document.createElement('a');
  a.href = f.base64;
  a.download = f.name;
  a.click();
}
