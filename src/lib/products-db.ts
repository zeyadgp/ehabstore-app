/**
 * طبقة خدمة IndexedDB لكتالوج منتجات إيهاب ستور (IndexedDB Service Layer)
 *
 * الميزات:
 * 1. تخزين الكتالوج الكامل للمنتجات محلياً في متصفح العميل (بدون قيود سعة localStorage).
 * 2. فهرسة الحقول الرئيسية (id, slug, sku, category_id, updated_at, created_at).
 * 3. دعم العمليات المجمعة السريعة (Bulk Upsert / Bulk Delete / GetAll).
 * 4. توافق تام مع SSR ومناطق التصفح المقيدة (الوضع الخاص).
 * 5. ذاكرة وسيطة متزامنة (In-Memory Cache) للترطيب اللحظي (0ms Instant UI Hydration).
 */

import type { Product } from "@/lib/store";

const DB_NAME = "ehab_store_db";
const DB_VERSION = 1;
const STORE_NAME = "products";

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase | null> | null = null;

// كاش في الذاكرة لتوفير ترطيب متزامن (Synchronous Initial Data) في React Query
let inMemoryProducts: Product[] | null = null;
const IDB_BACKUP_STORAGE_KEY = "ehab_cached_products";

function isIDBSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

/**
 * فتح أو إنشاء قاعدة بيانات IndexedDB
 */
export function openCatalogDB(): Promise<IDBDatabase | null> {
  if (!isIDBSupported()) return Promise.resolve(null);
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("by_updated_at", "updated_at", { unique: false });
          store.createIndex("by_created_at", "created_at", { unique: false });
          store.createIndex("by_slug", "slug", { unique: false });
          store.createIndex("by_sku", "sku", { unique: false });
          store.createIndex("by_category_id", "category_id", { unique: false });
        }
      };

      req.onsuccess = () => {
        dbInstance = req.result;
        resolve(dbInstance);
      };

      req.onerror = (e) => {
        console.warn("[IndexedDB] Failed to open catalog database:", e);
        resolve(null);
      };

      req.onblocked = () => {
        console.warn("[IndexedDB] Database upgrade blocked");
        resolve(null);
      };
    } catch (err) {
      console.warn("[IndexedDB] Exception opening database:", err);
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * قراءة جميع المنتجات المخزنة في IndexedDB
 */
export async function getAllProductsFromIDB(): Promise<Product[]> {
  const db = await openCatalogDB();
  if (!db) {
    return getMemoryProducts();
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result as Product[]) ?? [];
        // فرز حسب تاريخ الإنشاء تنازلياً للحفاظ على ترتيب العرض
        list.sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA;
        });
        inMemoryProducts = list;
        resolve(list);
      };

      req.onerror = () => {
        resolve(getMemoryProducts());
      };
    } catch {
      resolve(getMemoryProducts());
    }
  });
}

/**
 * جلب منتج بالمعرف (ID) من IndexedDB
 */
export async function getProductByIdFromIDB(id: string): Promise<Product | null> {
  const db = await openCatalogDB();
  if (!db) {
    return getMemoryProducts().find((p) => p.id === id) ?? null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve((req.result as Product) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * جلب منتج بالرابط اللطيف (Slug) من IndexedDB
 */
export async function getProductBySlugFromIDB(slug: string): Promise<Product | null> {
  const db = await openCatalogDB();
  const clean = slug.toLowerCase().trim();

  if (!db) {
    return getMemoryProducts().find((p) => p.slug?.toLowerCase() === clean) ?? null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("by_slug");
      const req = index.get(clean);

      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result as Product);
        } else {
          // فحص بالمسح اليدوي في حال لم يطابق الفهرس الدقيق
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            const all = (allReq.result as Product[]) ?? [];
            const found = all.find((p) => p.slug?.toLowerCase() === clean) ?? null;
            resolve(found);
          };
          allReq.onerror = () => resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * جلب منتج برمز SKU من IndexedDB
 */
export async function getProductBySkuFromIDB(sku: string): Promise<Product | null> {
  const db = await openCatalogDB();
  const clean = sku.toLowerCase().trim();

  if (!db) {
    return getMemoryProducts().find((p) => p.sku?.toLowerCase() === clean) ?? null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("by_sku");
      const req = index.get(clean);

      req.onsuccess = () => resolve((req.result as Product) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * حفظ أو تحديث مجموعة منتجات داخل IndexedDB بشكل مجمع (Bulk Upsert)
 */
export async function saveProductsToIDB(products: Product[]): Promise<void> {
  if (!products || products.length === 0) return;

  // تحديث كاش الذاكرة فوراً
  updateMemoryProducts(products);

  const db = await openCatalogDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      for (const p of products) {
        if (p && p.id) {
          store.put(p);
        }
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[IndexedDB] Transaction error saving products:", tx.error);
        reject(tx.error);
      };
    } catch (err) {
      console.warn("[IndexedDB] Error during saveProductsToIDB:", err);
      reject(err);
    }
  });
}

/**
 * حذف مجموعة منتجات من IndexedDB بالمعرفات (Bulk Delete)
 */
export async function deleteProductsFromIDB(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;

  // حذف من الذاكرة
  if (inMemoryProducts) {
    const idSet = new Set(ids);
    inMemoryProducts = inMemoryProducts.filter((p) => !idSet.has(p.id));
  }

  const db = await openCatalogDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      for (const id of ids) {
        store.delete(id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * عد المنتجات المخزنة في IndexedDB
 */
export async function countProductsInIDB(): Promise<number> {
  const db = await openCatalogDB();
  if (!db) return getMemoryProducts().length;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();

      req.onsuccess = () => resolve(req.result ?? 0);
      req.onerror = () => resolve(getMemoryProducts().length);
    } catch {
      resolve(getMemoryProducts().length);
    }
  });
}

/**
 * مسح جميع المنتجات من IndexedDB
 */
export async function clearProductsIDB(): Promise<void> {
  inMemoryProducts = [];
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(IDB_BACKUP_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const db = await openCatalogDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/* ================== إدارة الذاكرة المحلية المتزامنة (Sync In-Memory Cache) ================== */

function getMemoryProducts(): Product[] {
  if (inMemoryProducts && Array.isArray(inMemoryProducts)) {
    return inMemoryProducts;
  }

  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(IDB_BACKUP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Product[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryProducts = parsed;
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }

  return [];
}

function updateMemoryProducts(newOrUpdated: Product[]): void {
  const current = getMemoryProducts();
  const map = new Map<string, Product>();
  for (const p of current) {
    map.set(p.id, p);
  }
  for (const p of newOrUpdated) {
    map.set(p.id, p);
  }

  const merged = Array.from(map.values()).sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  });

  inMemoryProducts = merged;

  // حفظ نسخة احتياطية خفيفة في localStorage (أول 1500 منتج) لتغذية الإطار الأول قبل فتح IDB
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(IDB_BACKUP_STORAGE_KEY, JSON.stringify(merged.slice(0, 1500)));
    } catch {
      /* ignore storage quota limits */
    }
  }
}

/**
 * ترطيب كاش الذاكرة فوراً عند إقلاع التطبيق من IndexedDB في الخلفية
 */
export function hydrateProductsMemoryFromIDB(onHydrated?: (products: Product[]) => void): void {
  if (!isIDBSupported()) return;

  void getAllProductsFromIDB().then((products) => {
    if (products && products.length > 0) {
      inMemoryProducts = products;
      if (onHydrated) {
        onHydrated(products);
      }
    }
  });
}

export { getMemoryProducts };
