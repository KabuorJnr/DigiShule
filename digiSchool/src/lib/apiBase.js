// Resolve the origin for the app's server API (`/api/*`).
//
// On the web the API is same-origin, so relative paths just work. Inside the
// native (Capacitor) shell the page is served from Capacitor's local server
// (https://localhost), so `/api/*` must be redirected to the deployed backend.
// Set VITE_API_BASE_URL (e.g. https://app.eduone.co.ke) for release builds and
// every `/api/*` call is prefixed automatically. When the var is unset the
// behaviour is unchanged (relative, same-origin) — so the web build is identical.
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return BASE ? BASE + p : p;
}
