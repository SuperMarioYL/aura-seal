// v0.4 — local persistence for recorded clips ("我的作品"). IndexedDB stores the
// webm Blob + a JPEG thumbnail so the gallery survives a refresh. Nothing leaves
// the device (consistent with the privacy story).

export interface StoredClip {
  id: string;
  createdAt: number;
  durationMs: number;
  width: number;
  height: number;
  mimeType: string;
  thumbnail: string;
  blob: Blob;
}

const DB_NAME = 'auraseal';
const STORE = 'clips';
const VERSION = 1;

export function storageSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function makeId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `clip-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

export async function saveClip(clip: StoredClip): Promise<void> {
  await tx('readwrite', (store) => store.put(clip));
}

export async function listClips(): Promise<StoredClip[]> {
  const all = await tx<StoredClip[]>('readonly', (store) => store.getAll());
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteClip(id: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(id));
}
