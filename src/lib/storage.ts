// Tiny IndexedDB wrapper for persisting the in-progress session.
//
// We deliberately avoid pulling in idb / dexie — there's a single key/value
// pair to persist, and the native API is small enough that the dependency
// isn't worth it.

import type { SessionState } from '../types';
import { encodeStoredSession } from './session';

const DB_NAME = 'pwa-quest';
const DB_VERSION = 1;
const STORE = 'kv';
const SESSION_KEY = 'session';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    let blocked = false;
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => {
      if (blocked) req.result.close();
      else resolve(req.result);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      blocked = true;
      reject(new Error('Session storage is blocked by another open app tab. Close that tab and retry.'));
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    let req: IDBRequest<T>;
    try {
      tx = db.transaction(STORE, mode);
      req = fn(tx.objectStore(STORE));
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    // Request success precedes commit. A later transaction abort must still
    // reject the operation rather than report a successful save or deletion.
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? req.error ?? new DOMException('Session storage transaction was aborted.', 'AbortError'));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? req.error ?? new Error('Session storage transaction failed.'));
    };
  });
}

export async function loadSession(): Promise<unknown> {
  return withStore('readonly', (s) => s.get(SESSION_KEY));
}

export async function saveSession(session: SessionState): Promise<void> {
  await withStore('readwrite', (s) => s.put(encodeStoredSession(session), SESSION_KEY));
}

export async function clearSession(): Promise<void> {
  await withStore('readwrite', (s) => s.delete(SESSION_KEY));
}

export class StorageQuotaError extends Error {
  constructor() {
    super('Storage quota exceeded — please free up space and try again.');
    this.name = 'StorageQuotaError';
  }
}

// Small helper used by the store to surface friendlier error messages when
// the browser refuses a write because the quota is full.
export async function safeSave(session: SessionState): Promise<void> {
  try {
    await saveSession(session);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new StorageQuotaError();
    }
    throw err;
  }
}
