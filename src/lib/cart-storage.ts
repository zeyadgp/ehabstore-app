/**
 * طبقة تخزين احتياطية للسلة عبر IndexedDB لضمان عدم فقدان المنتجات
 * في حال قيام المتصفح بحذف كاش الجلسة أو عند استخدام التصفح المقيد.
 */

import type { CartItem } from "./cart";

const CART_DB_NAME = "ehab_cart_db";
const CART_DB_VERSION = 1;
const CART_STORE = "cart_state";
const CART_RECORD_KEY = "current_cart";

function isIDBAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openCartDB(): Promise<IDBDatabase | null> {
  if (!isIDBAvailable()) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(CART_DB_NAME, CART_DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CART_STORE)) {
          db.createObjectStore(CART_STORE);
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveCartToIDB(items: CartItem[]): Promise<void> {
  const db = await openCartDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CART_STORE, "readwrite");
      const store = tx.objectStore(CART_STORE);
      store.put(items, CART_RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getCartFromIDB(): Promise<CartItem[] | null> {
  const db = await openCartDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CART_STORE, "readonly");
      const store = tx.objectStore(CART_STORE);
      const req = store.get(CART_RECORD_KEY);
      req.onsuccess = () => {
        const res = req.result as CartItem[] | undefined;
        resolve(Array.isArray(res) && res.length > 0 ? res : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function clearCartFromIDB(): Promise<void> {
  const db = await openCartDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CART_STORE, "readwrite");
      const store = tx.objectStore(CART_STORE);
      store.delete(CART_RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
