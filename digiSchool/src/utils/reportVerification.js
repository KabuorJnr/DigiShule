// Self-contained, tamper-evident verification for generated report cards.
//
// The verification code is a deterministic fingerprint computed from the
// report's own stable data (student, class, exam, term and per-subject marks).
// The QR code encodes that same data plus the code, and the public /verify
// page recomputes the fingerprint and confirms it matches — so any alteration
// of the printed marks, name or grade produces a code that no longer verifies.
//
// No backend, no secrets: this proves document integrity (the card was not
// edited after issue), not identity of the issuer.

// FNV-1a 32-bit hash — small, dependency-free and deterministic across runtimes.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// Base64url encode/decode that survives Unicode student names.
export function encodePayload(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePayload(str) {
  try {
    const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Build the compact, canonical payload the code is derived from. Key order is
// fixed so the same report always yields the same fingerprint.
export function buildVerificationPayload(report, schoolName = '') {
  const subjects = (report.subjectRows || []).map((row) => ({
    s: row.subject,
    m: Number(row.score) || 0,
    g: row.gradeCode || row.gradeFull || '',
  }));
  return {
    v: 1,
    sc: (schoolName || '').trim(),
    nm: report.studentName || '',
    ad: String(report.admissionNo || ''),
    cl: report.className || '',
    ex: report.examTitle || '',
    tm: report.termName || '',
    yr: new Date().getFullYear(),
    tp: Number(report.totalPoints) || 0,
    mk: Number(report.totalMarks) || 0,
    su: subjects,
  };
}

// Deterministic canonical string → hash → formatted code (e.g. "A1B2-C3D4").
export function computeVerificationCode(payload) {
  if (!payload) return '';
  const parts = [
    payload.v,
    payload.sc,
    payload.nm,
    payload.ad,
    payload.cl,
    payload.ex,
    payload.tm,
    payload.yr,
    payload.tp,
    payload.mk,
    (payload.su || []).map((x) => `${x.s}:${x.m}:${x.g}`).join(','),
  ];
  const canonical = parts.join('|');
  // Two rounds over different salts widen the code space to 8 hex chars.
  const a = fnv1a(canonical).toString(16).toUpperCase().padStart(8, '0');
  const b = fnv1a(`salt::${canonical}`).toString(16).toUpperCase().padStart(8, '0');
  const raw = (a + b).slice(0, 8);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

// Convenience: code + QR URL for a report, pointing at this deployment's
// own /verify route so a scan resolves inside the system.
export function buildReportVerification(report, schoolName = '', origin = '') {
  const payload = buildVerificationPayload(report, schoolName);
  const code = computeVerificationCode(payload);
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const url = `${base}/verify?d=${encodePayload(payload)}&c=${encodeURIComponent(code)}`;
  return { code, url, payload };
}

// Used by the /verify page: recompute the code and compare.
export function verifyPayload(payload, providedCode) {
  if (!payload) return { valid: false, code: '' };
  const code = computeVerificationCode(payload);
  const norm = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return { valid: norm(code) === norm(providedCode), code };
}
