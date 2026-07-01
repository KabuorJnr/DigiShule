import { openDB } from 'idb';

const DB_NAME = 'digishule-offline-db';
const DB_VERSION = 1;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('cache')) {
      db.createObjectStore('cache');
    }
    if (!db.objectStoreNames.contains('mutationQueue')) {
      const queueStore = db.createObjectStore('mutationQueue', { keyPath: 'id', autoIncrement: true });
      queueStore.createIndex('status', 'status');
    }
  },
});

/**
 * Cache GET responses for offline use
 */
export async function saveToCache(key, data) {
  try {
    const db = await dbPromise;
    await db.put('cache', data, key);
  } catch (e) {
    console.warn('Failed to save to cache:', e);
  }
}

export async function getFromCache(key) {
  try {
    const db = await dbPromise;
    return await db.get('cache', key);
  } catch (e) {
    console.warn('Failed to get from cache:', e);
    return null;
  }
}

/**
 * Queue mutations (POST/PUT/DELETE) for when online
 */
export async function queueMutation(action, payload) {
  try {
    const db = await dbPromise;
    await db.add('mutationQueue', {
      action,
      payload,
      timestamp: Date.now(),
      status: 'pending'
    });
    console.log(`[OfflineSync] Queued action: ${action}`);
  } catch (e) {
    console.error('Failed to queue mutation:', e);
  }
}

/**
 * Sync queued mutations when back online
 */
export async function flushSyncQueue(apiSyncCallback) {
  if (!navigator.onLine) return;
  
  try {
    const db = await dbPromise;
    const tx = db.transaction('mutationQueue', 'readwrite');
    const index = tx.store.index('status');
    const pendingMutations = await index.getAll('pending');
    
    if (pendingMutations.length === 0) return;
    
    console.log(`[OfflineSync] Flushing ${pendingMutations.length} queued mutations...`);
    
    for (const mutation of pendingMutations) {
      try {
        await apiSyncCallback(mutation.action, mutation.payload);
        
        // Mark as synced or delete
        const deleteTx = db.transaction('mutationQueue', 'readwrite');
        await deleteTx.store.delete(mutation.id);
        await deleteTx.done;
      } catch (e) {
        console.error(`[OfflineSync] Failed to sync mutation ${mutation.id}:`, e);
      }
    }
  } catch (e) {
    console.error('Failed to flush sync queue:', e);
  }
}
