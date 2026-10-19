import type { StateStorage } from "zustand/middleware";

/**
 * Almacenamiento en IndexedDB para zustand/persist: más capacidad que localStorage
 * (años de movimientos) y no bloquea el hilo principal.
 */
const DB = "plata";
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

const memory = new Map<string, string>();

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    if (typeof indexedDB === "undefined") return memory.get(name) ?? null;
    try {
      return ((await tx("readonly", (s) => s.get(name))) as string | undefined) ?? null;
    } catch {
      return localStorage.getItem(name);
    }
  },
  setItem: async (name, value) => {
    if (typeof indexedDB === "undefined") return void memory.set(name, value);
    try {
      await tx("readwrite", (s) => s.put(value, name));
    } catch {
      localStorage.setItem(name, value);
    }
  },
  removeItem: async (name) => {
    if (typeof indexedDB === "undefined") return void memory.delete(name);
    await tx("readwrite", (s) => s.delete(name));
  },
};
