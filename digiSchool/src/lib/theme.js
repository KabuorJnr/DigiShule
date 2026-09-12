/**
 * theme.js — light / dark / system preference.
 *
 * The choice is written to `document.documentElement[data-theme]` and mirrored
 * to localStorage. CSS reacts to the attribute, so switching is a single
 * attribute write with no re-render of the tree.
 *
 * Three states, not two: "system" follows the device, which is what most
 * people actually want, and is the default. An explicit light/dark choice
 * overrides it.
 */

const KEY = 'eduone_theme';
export const THEMES = ['light', 'dark', 'system'];

/** The stored preference, defaulting to system. */
export function getStoredTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return THEMES.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

/** What the preference resolves to right now. */
export function resolveTheme(pref = getStoredTheme()) {
  if (pref === 'light' || pref === 'dark') return pref;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Apply a preference to the document.
 * "system" removes the attribute so the prefers-color-scheme media queries
 * take over, rather than hard-coding whatever the device happens to be now.
 */
export function applyTheme(pref) {
  const root = document.documentElement;
  if (pref === 'light' || pref === 'dark') {
    root.setAttribute('data-theme', pref);
  } else {
    root.removeAttribute('data-theme');
  }
  root.style.colorScheme = resolveTheme(pref);
}

export function setTheme(pref) {
  const next = THEMES.includes(pref) ? pref : 'system';
  try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
  applyTheme(next);
  // Let any listening UI re-render without prop-drilling.
  window.dispatchEvent(new CustomEvent('eduone:themechange', { detail: next }));
  return next;
}

/** Call once at boot, before first paint, to avoid a flash of the wrong theme. */
export function initTheme() {
  applyTheme(getStoredTheme());
}
