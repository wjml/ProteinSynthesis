/**
 * assets/js/beta/store.js
 * Persistência local-first: localStorage (preferências) + IndexedDB (snapshots e caderno).
 */

const DB_NAME = 'proteinSynthesisBetaDB';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('notebook')) {
        db.createObjectStore('notebook', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addRecord(storeName, record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).add({ ...record, createdAt: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listRecords(storeName) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve((req.result || []).reverse());
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export function getPref(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function setPref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sem persistência disponível
  }
}
