/**
 * Guarda en IndexedDB los audios cargados o grabados, para que sigan ahí al
 * recargar la página. Todo queda en el navegador de quien los grabó.
 * Si IndexedDB no está disponible (modo privado, permisos), no pasa nada:
 * simplemente no se guardan.
 */
const DB = 'tinkersignals';
const STORE = 'assets';

export interface StoredAsset {
  id: string;
  name: string;
  sampleRate: number;
  samples: Float32Array;
  trimmedS?: number;
  savedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAsset(a: StoredAsset): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(a));
  } catch {
    /* sin IndexedDB */
  }
}

export async function loadAsset(id: string): Promise<StoredAsset | undefined> {
  try {
    return await tx<StoredAsset | undefined>('readonly', (s) => s.get(id));
  } catch {
    return undefined;
  }
}

/** Borra los audios que ya no usa ningún bloque del circuito. */
export async function pruneAssets(keep: Set<string>): Promise<void> {
  try {
    const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
    for (const k of keys) if (!keep.has(String(k))) await tx('readwrite', (s) => s.delete(k));
  } catch {
    /* sin IndexedDB */
  }
}
