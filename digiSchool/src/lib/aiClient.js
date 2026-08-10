// EduOne — single client for every AI feature.
//
// All portals talk to the `ai-brief` Supabase Edge Function through this
// module. This keeps the API key server-side, gives us one place to add
// caching / rate-limiting / provider swaps, and stops each portal
// reinventing the wheel.
//
// Usage:
//   import { requestAI } from '../lib/aiClient';
//   const { parsed } = await requestAI('principal_weekly', payload, { schoolName });

import { supabase } from './supabaseClient';
import { reportError } from './errorReporter';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — briefs are weekly, not hourly
const cacheKey = (kind, payloadHash) => `eduone_ai_${kind}_${payloadHash}`;

function hashPayload(obj) {
  // Deterministic, cheap. Good enough to key a per-user daily cache.
  try {
    const s = JSON.stringify(obj);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return String(h);
  } catch { return 'x'; }
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { at, value } = JSON.parse(raw);
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return value;
  } catch { return null; }
}

function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), value })); }
  catch { /* quota — ignore */ }
}

/**
 * Ask the AI service for a structured brief.
 *
 * @param {string} kind         Feature key the edge function knows about
 *                              (e.g. 'principal_weekly').
 * @param {object} payload      Aggregated numbers/text the AI needs.
 * @param {object} [opts]
 * @param {string} [opts.schoolName]  For nicer prompt context.
 * @param {boolean} [opts.force]      Skip cache.
 * @returns {Promise<{parsed:any, raw?:string, model?:string, cached?:boolean}>}
 */
export async function requestAI(kind, payload, opts = {}) {
  const key = cacheKey(kind, hashPayload({ kind, payload }));
  if (!opts.force) {
    const hit = readCache(key);
    if (hit) return { ...hit, cached: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai-brief', {
      body: { kind, payload, school_name: opts.schoolName || '' },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error + (data.detail ? `: ${data.detail}` : ''));

    const result = { parsed: data?.parsed || null, raw: data?.raw, model: data?.model };
    writeCache(key, result);
    return { ...result, cached: false };
  } catch (e) {
    reportError(e, `ai.${kind}`);
    // Fail-soft: return a clear shape so UI can show a "not available" state
    // without crashing.
    return { parsed: null, error: e?.message || String(e) };
  }
}

/** Clear cached AI results — useful after data refresh. */
export function clearAICache() {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('eduone_ai_')) localStorage.removeItem(k);
    });
  } catch { /* ignore */ }
}
