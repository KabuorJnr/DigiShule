// Central error reporting for EduOne.
//
// One import (`reportError`) that:
//   - In dev: prints a clear, tagged message to the console.
//   - In prod (Sentry configured): sends the exception to Sentry with context.
//
// Also exposes:
//   - `withReport(fn, tag?)`   — wrap an async fn so any thrown error is reported.
//   - `swallow(promise, tag?)` — replaces `.catch(() => {})` with a reported no-op.
//
// The whole point is that we stop pretending errors don't happen. The
// previous pattern (`.catch(() => {})`) silently ate 29+ failure paths.

import * as Sentry from '@sentry/react';

const DSN = import.meta.env?.VITE_SENTRY_DSN;
const ENV = import.meta.env?.MODE || 'development';
const RELEASE = import.meta.env?.VITE_APP_VERSION || undefined;
let inited = false;

/** Idempotent Sentry init. Called once from main.jsx; safe to call again. */
export function initErrorReporter() {
  if (inited) return;
  inited = true;
  if (!DSN) {
    // No DSN — running without Sentry (local, staging without secret, etc).
    // Everything still routes through this module so we can turn it on later
    // just by setting VITE_SENTRY_DSN, without touching call sites.
    return;
  }
  try {
    Sentry.init({
      dsn: DSN,
      environment: ENV,
      release: RELEASE,
      // Conservative defaults: session replay off, tracing sampled low.
      // Turn these up as we get comfortable with volume.
      tracesSampleRate: 0.1,
      // Don't send noisy errors:
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
      ],
      beforeSend(event) {
        // Drop obvious dev noise if it slips through.
        if (event.message && /HMR|vite/i.test(event.message)) return null;
        return event;
      },
    });
  } catch (e) {
    // Never let Sentry init crash the app.
    console.warn('[errorReporter] Sentry init failed:', e);
  }
}

/** Attach a stable identifier once we know who is logged in. */
export function identifyUser(user) {
  if (!inited || !DSN || !user) return;
  try {
    Sentry.setUser({
      id: user.id,
      username: user.username || user.name,
      role: user.role,
      school_id: user.school_id || user.schoolId,
    });
  } catch { /* keep quiet — reporting the reporter would loop */ }
}

/** Clear identity on logout. */
export function clearUser() {
  if (!inited || !DSN) return;
  try { Sentry.setUser(null); } catch { /* ignore */ }
}

/**
 * The primary API. Call this anywhere you would otherwise silently swallow
 * an error. `tag` is a short label — the module/action — that shows up in
 * Sentry's title and in the dev console.
 */
export function reportError(err, tag = 'unhandled', extra = {}) {
  const message = err?.message || String(err);
  // Always surface in dev so we notice during development.
  if (ENV !== 'production') {
    // Grouped console output makes it easy to spot vs. normal logs.
    console.error(`[EduOne:${tag}]`, message, extra || '', err?.stack || '');
  }
  if (!inited || !DSN) return;
  try {
    Sentry.withScope((scope) => {
      scope.setTag('area', tag);
      Object.entries(extra || {}).forEach(([k, v]) => scope.setExtra(k, v));
      Sentry.captureException(err instanceof Error ? err : new Error(message));
    });
  } catch { /* never crash on report */ }
}

/**
 * Wrap an async function so any thrown error is reported and then re-thrown.
 * Useful for event handlers that already have their own error UI.
 *
 *   const save = withReport(async (row) => { ... }, 'timetable.save');
 */
export function withReport(fn, tag = 'async') {
  return async (...args) => {
    try { return await fn(...args); }
    catch (e) { reportError(e, tag, { args: args?.map((a) => String(a)?.slice(0, 120)) }); throw e; }
  };
}

/**
 * Report a rejection and swallow it (returns undefined). Use this only in
 * fire-and-forget paths (background sync, telemetry) where the caller truly
 * has nothing meaningful to do with the error. This is what should replace
 * `.catch(() => {})`.
 */
export function swallow(promise, tag = 'swallow') {
  return Promise.resolve(promise).catch((e) => reportError(e, tag));
}
