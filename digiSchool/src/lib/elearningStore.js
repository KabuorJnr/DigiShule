/**
 * elearningStore.js — cost-effective, offline-first storage for the E-Learning portal.
 *
 * Design goals (per product decision):
 *  - Zero required backend: lesson metadata lives in localStorage (per school),
 *    video bytes live in the browser's IndexedDB. Nothing is billed until you
 *    opt into a remote backend.
 *  - Offline-first: a downloaded video plays with no network (served from IndexedDB
 *    via an object URL), which fits EduOne's "download once, watch offline" model.
 *  - Supabase-ready: if a private 'eduone-videos' bucket + signed URLs are wired
 *    later, lessons can carry a `storagePath`/`url` and still be cached locally.
 */

import { openDB } from 'idb';

const DB_NAME = 'eduone-elearning';
const DB_VERSION = 1;
const VIDEO_STORE = 'videos'; // key: lessonId -> Blob

let dbPromise = null;
try {
  if (typeof window !== 'undefined' && 'indexedDB' in window) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(VIDEO_STORE)) db.createObjectStore(VIDEO_STORE);
      },
    });
  }
} catch {
  // IndexedDB unavailable (private mode / old browser) — offline caching disabled.
}

export const offlineAvailable = !!dbPromise;

// ---- Catalog (lesson metadata) -------------------------------------------
const catalogKey = (schoolId) => `eduone_elearning_catalog_${schoolId || 'default'}`;
const progressKey = 'eduone_elearning_progress';

export function getCatalog(schoolId) {
  try {
    const raw = localStorage.getItem(catalogKey(schoolId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export function saveCatalog(schoolId, list) {
  try { localStorage.setItem(catalogKey(schoolId), JSON.stringify(list)); } catch { /* quota */ }
}

// A couple of ready-to-play demo lessons (public sample clips, streamed on demand).
// They exist in every browser so students always have something to watch and to
// test the "Download for offline" flow. Teachers add real lessons on top.
export function seedDemoLessons() {
  const now = new Date().toISOString();
  return [
    {
      id: 'demo-eng-1', subject: 'English', title: 'Introduction to Essay Writing',
      description: 'A short walkthrough of essay structure: introduction, body and conclusion.',
      teacher: 'Sample Teacher', klass: 'All', durationSec: 15, createdAt: now, demo: true,
      source: 'url', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    },
    {
      id: 'demo-bio-1', subject: 'Biology', title: 'The Cell — A Quick Tour',
      description: 'Overview of the plant and animal cell and their key organelles.',
      teacher: 'Sample Teacher', klass: 'All', durationSec: 15, createdAt: now, demo: true,
      source: 'url', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    },
  ];
}

/** Load the catalog, seeding demos on first use. */
export function loadCatalog(schoolId) {
  const existing = getCatalog(schoolId);
  if (existing) return existing;
  const seeded = seedDemoLessons();
  saveCatalog(schoolId, seeded);
  return seeded;
}

// ---- Video bytes (IndexedDB) ---------------------------------------------
export async function putVideo(id, blob) {
  if (!dbPromise) throw new Error('Offline storage is unavailable in this browser.');
  const db = await dbPromise;
  await db.put(VIDEO_STORE, blob, id);
}

export async function getVideo(id) {
  if (!dbPromise) return null;
  const db = await dbPromise;
  return (await db.get(VIDEO_STORE, id)) || null;
}

export async function deleteVideo(id) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.delete(VIDEO_STORE, id);
}

export async function cachedIds() {
  if (!dbPromise) return [];
  const db = await dbPromise;
  return (await db.getAllKeys(VIDEO_STORE)).map(String);
}

/**
 * Resolve a playable source for a lesson.
 * Returns { url, revoke } — call revoke() when done to free any object URL.
 * Prefers the offline copy in IndexedDB, then a remote/attached URL.
 */
export async function resolvePlayable(lesson) {
  const blob = await getVideo(lesson.id);
  if (blob) {
    const url = URL.createObjectURL(blob);
    return { url, offline: true, revoke: () => URL.revokeObjectURL(url) };
  }
  if (lesson.url) return { url: lesson.url, offline: false, revoke: () => {} };
  return { url: null, offline: false, revoke: () => {} };
}

/** Fetch a remote lesson video and store it in IndexedDB for offline playback. */
export async function downloadForOffline(lesson) {
  if (!lesson.url) throw new Error('This lesson has no downloadable video source.');
  const res = await fetch(lesson.url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  await putVideo(lesson.id, blob);
  return blob.size;
}

// ---- Resume progress ------------------------------------------------------
export function getProgress() {
  try { return JSON.parse(localStorage.getItem(progressKey) || '{}'); } catch { return {}; }
}
export function setProgress(id, seconds) {
  try {
    const p = getProgress();
    p[id] = Math.floor(seconds);
    localStorage.setItem(progressKey, JSON.stringify(p));
  } catch { /* ignore */ }
}

// ---- Storage estimate -----------------------------------------------------
export async function storageEstimate() {
  try {
    if (navigator.storage?.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      return { usage, quota };
    }
  } catch { /* ignore */ }
  return null;
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let i = -1, n = bytes;
  do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}
