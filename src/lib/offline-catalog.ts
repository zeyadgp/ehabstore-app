/**
 * نظام المزامنة الصامتة في الخلفية والتخزين عبر IndexedDB (IndexedDB & Silent Delta Sync Service)
 * لمتجر إيهاب ستور.
 *
 * المبادئ الأساسية:
 * 1. خدمة IndexedDB كاملة لتخزين كتالوج المنتجات بلا قيود حجم وتوفير تجربة Offline-First حقيقية.
 * 2. نمط Stale-While-Revalidate: ترطيب الواجهة فوراً (0ms) من IndexedDB ثم تحديث التغييرات في الخلفية دون أي وميض أو حالات تحميل (no loading states).
 * 3. جلب التغييرات التراكمية (Delta Changes) فقط بناءً على حقل 'updated_at' و 'created_at'.
 * 4. تحديث 'lastSyncTimestamp' في localStorage حصرياً بعد نجاح الجلب والحفظ في IndexedDB بنجاح تام.
 * 5. صامتة 100% بدون أي إشعارات أو مؤشرات تحميل مزعجة.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Product } from "@/lib/store";
import type { Brand } from "@/lib/brands";
import {
  getAllProductsFromIDB,
  getProductByIdFromIDB,
  getProductBySlugFromIDB,
  getProductBySkuFromIDB,
  saveProductsToIDB,
  deleteProductsFromIDB,
  countProductsInIDB,
  hydrateProductsMemoryFromIDB,
  getMemoryProducts,
} from "@/lib/products-db";

export const PRODUCTS_PAGE_SIZE = 24;

export const LIST_COLUMNS =
  "id,name,slug,sku,price,discount_price,images,category_id,brand_id,stock,status,is_featured,is_bestseller,created_at,updated_at";

export const STORAGE_KEYS = {
  PRODUCTS: "ehab_cached_products",
  LEGACY_PRODUCTS: "ehab_offline_products_v3",
  LAST_SYNC: "lastSyncTimestamp",
  CATEGORIES: "ehab_offline_categories_v3",
  BRANDS: "ehab_offline_brands_v3",
  LINKS: "ehab_offline_links_v3",
  SETTINGS: "ehab_offline_settings_v3",
  STATS: "ehab_offline_stats_v3",
} as const;

let sharedQueryClient: any = null;
let isSyncingProducts = false;
let lastSyncAttempt = 0;

export function setSharedQueryClient(qc: any) {
  sharedQueryClient = qc;
}

export function getSharedQueryClient() {
  return sharedQueryClient;
}

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore storage quota errors */
  }
}

/* ================== قراءة وكتابة المنتجات (IndexedDB + Synchronous Memory) ================== */

/**
 * جلب المنتجات المخزنة فوراً للاستخدام المتزامن (0ms Synchronous Hydration)
 */
export function getCachedProducts(): Product[] {
  return getMemoryProducts();
}

/**
 * جلب جميع المنتجات مباشرة من IndexedDB
 */
export async function getProductsFromIndexedDB(): Promise<Product[]> {
  return await getAllProductsFromIDB();
}

export function getLastSyncTimestamp(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  } catch {
    return null;
  }
}

export function setLastSyncTimestamp(isoTimestamp: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, isoTimestamp);
  } catch {
    /* ignore */
  }
}

/**
 * تحديث حالة React Query في الذاكرة دون أي وميض أو إعادة تحميل للواجهة
 */
export function updateReactQueryState(products: Product[], clientOverride?: any): void {
  const qc = clientOverride || sharedQueryClient;
  if (!qc) return;

  try {
    // 1. تحديث كاش ["products"]
    qc.setQueryData(["products"], products);

    // 2. تحديث صفحات القائمة اللانهائية ["products", "pages"] لصفحة /products
    const pages: Product[][] = [];
    for (let i = 0; i < products.length; i += PRODUCTS_PAGE_SIZE) {
      pages.push(products.slice(i, i + PRODUCTS_PAGE_SIZE));
    }
    qc.setQueryData(["products", "pages"], {
      pages: pages.length > 0 ? pages : [products],
      pageParams: pages.map((_, idx) => idx),
    });
  } catch {
    /* ignore */
  }
}

/* ================== المزامنة الصامتة في الخلفية (Silent Delta Sync) ================== */

/**
 * المزامنة التزايدية الصامتة:
 * 1. لا تظهر أي إشعارات أو مؤشرات تحميل للمستخدم (100% Silent).
 * 2. تفحص `lastSyncTimestamp` وتجلب فقط المنتجات المعدلة أو المضافة حديثاً بناءً على 'updated_at' أو 'created_at'.
 * 3. تخزن المنتجات وتحدثها داخل قاعدة بيانات IndexedDB.
 * 4. تحديث 'lastSyncTimestamp' في localStorage يتم حصرياً بعد نجاح استرجاع البيانات وحفظها في IndexedDB بنجاح.
 */
export async function syncProductsSilently(clientOverride?: any): Promise<Product[]> {
  if (typeof window === "undefined") return [];

  // منع تشغيل عمليات متزامنة مزدوجة
  if (isSyncingProducts) {
    return getCachedProducts();
  }

  // تخطي محاولة الاتصال بالشبكة إذا كان الجهاز غير متصل
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return getCachedProducts();
  }

  isSyncingProducts = true;
  lastSyncAttempt = Date.now();

  try {
    const lastSync = getLastSyncTimestamp();
    const currentMemory = getCachedProducts();
    const idbCount = await countProductsInIDB();

    // -------------------------------------------------------------
    // الحالة الأولى: أول فتحة للمتجر أو قاعدة بيانات IndexedDB فارغة (جلب كامل الكتالوج تدريجياً)
    // -------------------------------------------------------------
    if (!lastSync || idbCount === 0 || currentMemory.length === 0) {
      // 1. جلب أول دفعة سريعة (60 منتج) لعرضها فوراً وبلا أي تأخير
      const { data: firstBatch, error: err1 } = await supabase
        .from("products")
        .select(LIST_COLUMNS)
        .eq("status", true)
        .order("created_at", { ascending: false })
        .range(0, 59);

      if (err1) throw err1;

      let allProducts = (firstBatch as unknown as Product[]) ?? [];
      if (allProducts.length > 0) {
        await saveProductsToIDB(allProducts);
        updateReactQueryState(allProducts, clientOverride);
      }

      // 2. استكمال جلب باقي الكتالوج بالكامل في دفعات بالخلفية
      let offset = 60;
      const CHUNK_SIZE = 100;
      const MAX_TOTAL = 3000;

      while (offset < MAX_TOTAL) {
        const { data: chunk, error: chunkErr } = await supabase
          .from("products")
          .select(LIST_COLUMNS)
          .eq("status", true)
          .order("created_at", { ascending: false })
          .range(offset, offset + CHUNK_SIZE - 1);

        if (chunkErr || !chunk || chunk.length === 0) break;

        const newItems = chunk as unknown as Product[];
        allProducts = allProducts.concat(newItems);
        await saveProductsToIDB(newItems);
        updateReactQueryState(allProducts, clientOverride);

        if (chunk.length < CHUNK_SIZE) break;
        offset += CHUNK_SIZE;
      }

      // تحديث توقيت المزامنة فقط بعد اكتمال الحفظ بنجاح
      const syncTimeIso = new Date().toISOString();
      setLastSyncTimestamp(syncTimeIso);
      return allProducts;
    }

    // -------------------------------------------------------------
    // الحالة الثانية: المزامنة التزايدية (Delta Sync based on 'updated_at')
    // جلب التغييرات فقط التي حدثت بعد lastSyncTimestamp
    // -------------------------------------------------------------
    const { data: modifiedRows, error: syncError } = await supabase
      .from("products")
      .select(LIST_COLUMNS)
      .or(`updated_at.gt.${lastSync},created_at.gt.${lastSync}`)
      .order("updated_at", { ascending: false });

    if (syncError) {
      console.warn("[DeltaSync] Incremental check failed (keeping local IndexedDB):", syncError);
      // عدم تحديث lastSyncTimestamp لضمان إعادة المحاولة لاحقاً
      return currentMemory;
    }

    const changed = (modifiedRows as unknown as Product[]) ?? [];

    if (changed.length === 0) {
      // لا توجد أي منتجات جديدة أو معدلة على الخادم — الكتالوج محدث تماماً
      // تحديث توقيت المزامنة بنجاح
      setLastSyncTimestamp(new Date().toISOString());
      return currentMemory;
    }

    // فرز المنتجات المعدلة إلى مفعّلة ومعطّلة
    const activeProducts: Product[] = [];
    const deactivatedIds: string[] = [];

    for (const p of changed) {
      if (p.status === false) {
        deactivatedIds.push(p.id);
      } else {
        activeProducts.push(p);
      }
    }

    // 1. تحديث/إضافة المنتجات النشطة في IndexedDB
    if (activeProducts.length > 0) {
      await saveProductsToIDB(activeProducts);
    }

    // 2. حذف المنتجات المعطلة من IndexedDB
    if (deactivatedIds.length > 0) {
      await deleteProductsFromIDB(deactivatedIds);
    }

    // 3. قراءة القائمة المحدثة بالكامل من الذاكرة/IndexedDB
    const updatedCatalog = await getAllProductsFromIDB();

    // 4. تحديث كاش React Query بسلاسة تامة دون وميض
    updateReactQueryState(updatedCatalog, clientOverride);

    // 5. تحديث lastSyncTimestamp في localStorage فقط بعد نجاح الحفظ في IndexedDB
    const successIso = new Date().toISOString();
    setLastSyncTimestamp(successIso);

    return updatedCatalog;
  } catch (err) {
    console.warn("[DeltaSync] Silent background sync encountered an issue:", err);
    // عدم تحديث lastSyncTimestamp في حال حدوث خطأ، والاعتماد على المخزن المحلي
    return getCachedProducts();
  } finally {
    isSyncingProducts = false;
  }
}

/**
 * خطاف مخصص لمزامنة كتالوج المنتجات في الخلفية (useProductSync hook)
 * يراقب حالة الاتصال، ويوفر آلية استرجاع التغييرات التراكمية (Delta Sync)
 * مع الحفاظ التام على نمط Stale-While-Revalidate.
 */
export function useProductSync(options?: { enabled?: boolean; intervalMs?: number }) {
  const { enabled = true, intervalMs = 5 * 60_000 } = options ?? {};
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLocalLastSyncTime] = useState<string | null>(() =>
    getLastSyncTimestamp(),
  );
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performSync = useCallback(async () => {
    if (!enabled || typeof navigator === "undefined" || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      await syncProductsSilently();
      setLocalLastSyncTime(getLastSyncTimestamp());
    } finally {
      setIsSyncing(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // 1. مزامنة فورية صامتة بعد التحميل الأولي (Stale-While-Revalidate)
    syncTimeoutRef.current = setTimeout(() => {
      void performSync();
    }, 800);

    // 2. مزامنة عند عودة الاتصال
    const handleOnline = () => {
      void performSync();
    };

    // 3. مزامنة عند عودة التركيز للتطبيق (Visibility Change)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        if (now - lastSyncAttempt > 90_000) {
          void performSync();
        }
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. مؤقت دوري في الخلفية
    const interval = setInterval(() => {
      void performSync();
    }, intervalMs);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [enabled, intervalMs, performSync]);

  return {
    isSyncing,
    lastSyncTime,
    syncNow: performSync,
  };
}

/**
 * تهيئة مستمعات المزامنة الصامتة وترطيب IndexedDB
 */
let syncInitialized = false;
export function initSilentBackgroundSync(queryClient?: any): void {
  if (typeof window === "undefined" || syncInitialized) return;
  syncInitialized = true;

  if (queryClient) {
    setSharedQueryClient(queryClient);
  }

  // ترطيب فوري من IndexedDB إلى الذاكرة
  hydrateProductsMemoryFromIDB((hydratedProducts) => {
    if (queryClient && hydratedProducts && hydratedProducts.length > 0) {
      updateReactQueryState(hydratedProducts, queryClient);
    }
  });

  // مزامنة صامتة بعد انطلاق التطبيق
  setTimeout(() => {
    void syncProductsSilently(queryClient);
  }, 600);

  // مزامنة تلقائية فور عودة الإنترنت
  window.addEventListener("online", () => {
    void syncProductsSilently(queryClient);
  });

  // مزامنة عند رجوع المستخدم للتطبيق
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const now = Date.now();
      if (now - lastSyncAttempt > 120_000) {
        void syncProductsSilently(queryClient);
      }
    }
  });

  // فحص دوري كل 5 دقائق
  setInterval(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void syncProductsSilently(queryClient);
    }
  }, 5 * 60_000);
}

/* ================== دوال التوافق والمساعدات ================== */

export function saveOfflineProducts(products: Product[]): void {
  if (!products || products.length === 0) return;
  void saveProductsToIDB(products);
}

export function getOfflineProducts(): Product[] {
  return getCachedProducts();
}

export async function getProductByRefFromStore(ref: string): Promise<Product | null> {
  const clean = decodeURIComponent(ref).toLowerCase().trim();
  // فحص IndexedDB
  const byId = await getProductByIdFromIDB(ref);
  if (byId) return byId;

  const bySlug = await getProductBySlugFromIDB(clean);
  if (bySlug) return bySlug;

  const bySku = await getProductBySkuFromIDB(clean);
  if (bySku) return bySku;

  return getOfflineProductByRef(ref);
}

export function getOfflineProductByRef(ref: string): Product | null {
  const products = getCachedProducts();
  if (products.length === 0) return null;
  const clean = decodeURIComponent(ref).toLowerCase().trim();
  return (
    products.find(
      (p) =>
        p.id === clean ||
        p.id === ref ||
        p.slug?.toLowerCase() === clean ||
        p.sku?.toLowerCase() === clean,
    ) ?? null
  );
}

export function saveOfflineCategories(categories: Category[]): void {
  if (categories && categories.length > 0) {
    safeSet(STORAGE_KEYS.CATEGORIES, categories);
  }
}

export function getOfflineCategories(): Category[] {
  return safeGet<Category[]>(STORAGE_KEYS.CATEGORIES, []);
}

export function saveOfflineBrands(brands: Brand[]): void {
  if (brands && brands.length > 0) {
    safeSet(STORAGE_KEYS.BRANDS, brands);
  }
}

export function getOfflineBrands(): Brand[] {
  return safeGet<Brand[]>(STORAGE_KEYS.BRANDS, []);
}

export function saveOfflineLinks(links: Array<{ product_id: string; category_id: string }>): void {
  if (links && links.length > 0) {
    safeSet(STORAGE_KEYS.LINKS, links);
  }
}

export function getOfflineLinks(): Array<{ product_id: string; category_id: string }> {
  return safeGet<Array<{ product_id: string; category_id: string }>>(STORAGE_KEYS.LINKS, []);
}

export function saveOfflineSettings(settings: any): void {
  if (settings) {
    safeSet(STORAGE_KEYS.SETTINGS, settings);
  }
}

export function getOfflineSettings(): any {
  return safeGet<any>(STORAGE_KEYS.SETTINGS, null);
}

export function saveOfflineStats(stats: Record<string, { count: number; avg: number }>): void {
  if (stats && Object.keys(stats).length > 0) {
    safeSet(STORAGE_KEYS.STATS, stats);
  }
}

export function getOfflineStats(): Record<string, { count: number; avg: number }> {
  return safeGet<Record<string, { count: number; avg: number }>>(STORAGE_KEYS.STATS, {});
}

export function getLastCatalogSyncTime(): number | null {
  const ts = getLastSyncTimestamp();
  return ts ? new Date(ts).getTime() : null;
}

/**
 * Hook لحالة الاتصال بدون أي واجهات أو إشعارات مزعجة
 */
export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof navigator === "undefined") return false;
    return !navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onOnline = () => {
      setIsOffline(false);
      void syncProductsSilently();
    };
    const onOffline = () => setIsOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return { isOffline };
}
