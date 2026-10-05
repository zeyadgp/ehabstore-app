import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signPublicStoreImages } from "@/lib/public-images.functions";
import {
  saveOfflineCategories,
  getOfflineCategories,
  saveOfflineProducts,
  getOfflineProducts,
  getOfflineProductByRef,
  getProductByRefFromStore,
  saveOfflineLinks,
  getOfflineLinks,
  saveOfflineSettings,
  getOfflineSettings,
  getCachedProducts,
  getLastSyncTimestamp,
  syncProductsSilently,
  useProductSync,
  LIST_COLUMNS,
  PRODUCTS_PAGE_SIZE,
} from "@/lib/offline-catalog";

export { useProductSync };

export type CategoryKind = "standard" | "group" | "smart" | "brand";

export type SmartRule = {
  type?: "bestseller" | "featured" | "new" | "deals" | "price" | "top-rated";
  min?: number | null;
  max?: number | null;
  limit?: number | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  sort_order: number;
  parent_id: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  cover_image: string | null;
  is_active: boolean;
  kind: CategoryKind;
  smart_rule: SmartRule | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  /** غير موجود في قوائم المنتجات (يُجلب في صفحة المنتج فقط لتخفيف التحميل) */
  description?: string | null;
  /** المكوّنات التفصيلية، تُجلب في صفحة المنتج ولوحة الإدارة فقط. */
  ingredients?: string | null;
  /** إرشادات استخدام المنتج، تُجلب في صفحة المنتج ولوحة الإدارة فقط. */
  usage_instructions?: string | null;
  price: number;
  discount_price: number | null;
  images: string[];
  category_id: string | null;
  brand_id?: string | null;
  stock: number;
  status: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  created_at: string;
  updated_at?: string;
};

export type StoreSettings = {
  id: string;
  store_name: string;
  logo: string | null;
  whatsapp_number: string;
  currency: string;
  currency_label: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  about: string | null;
  instagram: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export type StoreSettingsFull = StoreSettings & {
  seo_keywords: string | null;
  og_image: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image: string | null;
  about_content: string | null;
  contact_content: string | null;
  facebook: string | null;
  tiktok: string | null;
  snapchat: string | null;
  working_hours: string | null;
  store_image: string | null;
  description: string | null;
  twitter: string | null;
  youtube: string | null;
  hide_lovable_badge: boolean | null;
  app_download_url: string | null;
  ios_app_url: string | null;
  ios_badge_image: string | null;
  android_badge_image: string | null;
  footer_text: string | null;
  copyright_name: string | null;
  copyright_url: string | null;
  meta_shop_url: string | null;
  instagram_shop_url: string | null;

  grid_columns: number | null;
  card_style: string | null;
  brand_text_color: string | null;
  swatch_enabled: boolean | null;
  swatch_shape: string | null;
  swatch_size: string | null;
  color_families: string[] | null;
};

export type Testimonial = {
  id: string;
  customer_name: string;
  content: string;
  rating: number;
};

export const BUCKET = "store-images";

/** الأعمدة العامة المصرح بها لزوار المتجر دون التسبب في خطأ الصلاحيات */
const PUBLIC_SETTINGS_COLUMNS =
  "id,store_name,logo,whatsapp_number,currency,currency_label,email,phone,address,about,instagram,seo_title,seo_description,seo_keywords,og_image,hero_title,hero_subtitle,hero_image,about_content,contact_content,facebook,tiktok,snapchat,working_hours,store_image,description,twitter,youtube,hide_lovable_badge,app_download_url,ios_app_url,footer_text,copyright_name,copyright_url,meta_shop_url,instagram_shop_url,grid_columns,card_style,brand_text_color,swatch_enabled,swatch_shape,swatch_size,color_families,require_email_confirm";

export async function fetchSettings(): Promise<StoreSettingsFull | null> {
  try {
    const { data, error } = await supabase
      .from("store_settings")
      .select(PUBLIC_SETTINGS_COLUMNS)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(
        "[Store] Primary settings query error, falling back to core columns:",
        error.message,
      );
      const { data: fallbackData } = await supabase
        .from("store_settings")
        .select(
          "id,store_name,logo,whatsapp_number,currency,currency_label,email,phone,address,about,hero_title,hero_subtitle,hero_image",
        )
        .limit(1)
        .maybeSingle();
      const res = (fallbackData as unknown as StoreSettingsFull | null) ?? null;
      if (res) saveOfflineSettings(res);
      return res ?? getOfflineSettings();
    }

    const res = (data as unknown as StoreSettingsFull | null) ?? null;
    if (res) saveOfflineSettings(res);
    return res ?? getOfflineSettings();
  } catch (err) {
    console.error("[Store] Exception fetching store settings, using offline cache:", err);
    return getOfflineSettings();
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    const list = (data as Category[] | null) ?? [];
    if (list.length > 0) saveOfflineCategories(list);
    return list;
  } catch (err) {
    console.warn("[Store] fetchCategories failed, using offline cache:", err);
    const cached = getOfflineCategories();
    return cached.length > 0 ? cached : [];
  }
}

export async function fetchProducts(): Promise<Product[]> {
  return await syncProductsSilently();
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      saveOfflineProducts([data as unknown as Product]);
      return data as Product;
    }
  } catch (err) {
    console.warn("[Store] fetchProductBySlug failed, trying offline cache:", err);
  }
  return getOfflineProductByRef(slug);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts a product id (stable, preferred) or a legacy slug so old links keep working. */
export async function fetchProductByRef(ref: string): Promise<Product | null> {
  let clean = ref;
  try {
    clean = decodeURIComponent(ref);
  } catch {
    /* ignore malformed URI */
  }

  try {
    if (UUID_RE.test(clean)) {
      const { data } = await supabase.from("products").select("*").eq("id", clean).maybeSingle();
      if (data) {
        saveOfflineProducts([data as unknown as Product]);
        return data as Product;
      }
    }
    if (clean !== ref && UUID_RE.test(ref)) {
      const { data } = await supabase.from("products").select("*").eq("id", ref).maybeSingle();
      if (data) {
        saveOfflineProducts([data as unknown as Product]);
        return data as Product;
      }
    }

    // رمز المنتج القصير (PR-1042) — الشكل المعتمد في روابط المشاركة.
    const { data: bySku } = await supabase
      .from("products")
      .select("*")
      .eq("sku", clean)
      .maybeSingle();
    if (bySku) {
      saveOfflineProducts([bySku as unknown as Product]);
      return bySku as Product;
    }

    const found = await fetchProductBySlug(clean);
    if (found) return found;

    if (clean !== ref) {
      return fetchProductBySlug(ref);
    }
  } catch (err) {
    console.warn("[Store] fetchProductByRef failed, checking offline storage:", err);
  }

  // محاولة الجلب من IndexedDB والتخزين المحلي المحفوظ أوفلاين
  const fromIDB = (await getProductByRefFromStore(clean)) ?? (await getProductByRefFromStore(ref));
  if (fromIDB) return fromIDB;

  return getOfflineProductByRef(clean) ?? getOfflineProductByRef(ref);
}

export async function fetchTestimonials(): Promise<Testimonial[]> {
  const { data } = await supabase
    .from("testimonials")
    .select("*")
    .eq("is_visible", true)
    .order("created_at", { ascending: false });
  return (data as Testimonial[] | null) ?? [];
}

export const settingsQuery = { queryKey: ["settings"], queryFn: fetchSettings, staleTime: 60_000 };
export const categoriesQuery = {
  queryKey: ["categories"],
  queryFn: fetchCategories,
  initialData: () => {
    const cached = getOfflineCategories();
    return cached.length > 0 ? cached : undefined;
  },
  staleTime: 60_000,
  refetchOnWindowFocus: false,
};

export const productsQuery = {
  queryKey: ["products"],
  queryFn: fetchProducts,
  initialData: () => {
    const cached = getCachedProducts();
    return cached.length > 0 ? cached : undefined;
  },
  initialDataUpdatedAt: () => {
    const ts = getLastSyncTimestamp();
    return ts ? new Date(ts).getTime() : 0;
  },
  staleTime: 60_000,
  refetchOnWindowFocus: false,
};

export const testimonialsQuery = {
  queryKey: ["testimonials"],
  queryFn: fetchTestimonials,
  staleTime: 60_000,
};

export function useSettings() {
  return useQuery(settingsQuery);
}

export function useCategories() {
  return useQuery(categoriesQuery);
}

/**
 * نمط Stale-While-Revalidate:
 * يرجع البيانات فوراً من IndexedDB / الذاكرة مع تعيين isLoading=false عند توفر البيانات المحفوظة،
 * ويجري إعادة التحقق والتحديث في الخلفية دون التسبب في أي قفزة أو وميض بالواجهة.
 */
export function useProducts() {
  const query = useQuery(productsQuery);
  const cached = getCachedProducts();
  const data = query.data ?? cached;
  const isLoading = query.isLoading && data.length === 0;

  return {
    ...query,
    data,
    isLoading,
  };
}

export async function fetchProductsPage(page: number): Promise<Product[]> {
  const from = page * PRODUCTS_PAGE_SIZE;
  const cached = getCachedProducts();

  // إذا كان الجهاز غير متصل بالإنترنت، نقتطع مباشرة من الكاش المحلي
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return cached.slice(from, from + PRODUCTS_PAGE_SIZE);
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select(LIST_COLUMNS)
      .eq("status", true)
      .order("created_at", { ascending: false })
      .range(from, from + PRODUCTS_PAGE_SIZE - 1);
    if (error) throw error;
    const list = (data as unknown as Product[] | null) ?? [];
    if (list.length > 0) saveOfflineProducts(list);
    return list;
  } catch (err) {
    console.warn("[Store] fetchProductsPage failed, falling back to offline slice:", err);
    return cached.slice(from, from + PRODUCTS_PAGE_SIZE);
  }
}

export function useInfiniteProducts() {
  const cached = getCachedProducts();

  const query = useInfiniteQuery({
    queryKey: ["products", "pages"],
    queryFn: ({ pageParam }) => fetchProductsPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === PRODUCTS_PAGE_SIZE ? pages.length : undefined,
    initialData: () => {
      const items = getCachedProducts();
      if (!items || items.length === 0) return undefined;
      const pages: Product[][] = [];
      for (let i = 0; i < items.length; i += PRODUCTS_PAGE_SIZE) {
        pages.push(items.slice(i, i + PRODUCTS_PAGE_SIZE));
      }
      return {
        pages: pages.length > 0 ? pages : [items],
        pageParams: pages.map((_, idx) => idx),
      };
    },
    initialDataUpdatedAt: () => {
      const ts = getLastSyncTimestamp();
      return ts ? new Date(ts).getTime() : 0;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const flatProducts = query.data?.pages.flat() ?? cached;
  // منع وميض هياكل التحميل (Skeletons) تماماً عند توفر أي منتجات محلية
  const isActuallyLoading = query.isLoading && flatProducts.length === 0;

  return {
    ...query,
    isLoading: isActuallyLoading,
    products: flatProducts,
  };
}

/**
 * Storage objects live in a private bucket, so display needs signed URLs.
 * Requests from every card on screen are batched into ONE `createSignedUrls`
 * call per tick, and URLs are kept stable for a week so the browser/CDN cache
 * can reuse the exact same URL instead of re-downloading the image.
 */
const SIGN_TTL = 60 * 60 * 24 * 7; // روابط مؤقتة تتجدد قبل انتهاء أسبوع
const SIGN_STORE_KEY = "ehab-signed-images-v1";
const signedCache = new Map<string, { url: string; exp: number }>();
let signQueue: string[] = [];
let signWaiters: (() => void)[] = [];
let signTimer: ReturnType<typeof setTimeout> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

// URLs survive reloads, so the browser re-requests the *same* URL and hits its own cache.
if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(SIGN_STORE_KEY);
    if (raw) {
      const now = Date.now();
      for (const [path, v] of Object.entries(
        JSON.parse(raw) as Record<string, { url: string; exp: number }>,
      )) {
        if (v?.url && v.exp > now) signedCache.set(path, v);
      }
    }
  } catch {
    /* تخزين محلي غير متاح */
  }
}

function persistSigned() {
  if (typeof window === "undefined" || persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      window.localStorage.setItem(SIGN_STORE_KEY, JSON.stringify(Object.fromEntries(signedCache)));
    } catch {
      /* تجاوز حد التخزين */
    }
  }, 500);
}

function flushSignQueue() {
  const batch = signQueue;
  const waiters = signWaiters;
  signQueue = [];
  signWaiters = [];
  signTimer = null;
  const run = async () => {
    for (let i = 0; i < batch.length; i += 100) {
      const chunk = batch.slice(i, i + 100);
      const signed = await signPublicStoreImages({ data: { paths: chunk } });
      Object.entries(signed).forEach(([path, url]) => {
        if (path && url)
          signedCache.set(path, {
            url,
            exp: Date.now() + (SIGN_TTL - 3600) * 1000,
          });
      });
    }
    persistSigned();
  };
  run().finally(() => waiters.forEach((w) => w()));
}

async function signPaths(paths: string[]) {
  const now = Date.now();
  const missing = paths.filter((p) => {
    const hit = signedCache.get(p);
    return !hit || hit.exp < now;
  });
  if (missing.length > 0) {
    missing.forEach((p) => {
      if (!signQueue.includes(p)) signQueue.push(p);
    });
    await new Promise<void>((resolve) => {
      signWaiters.push(resolve);
      if (!signTimer) signTimer = setTimeout(flushSignQueue, 20);
    });
  }
}

export function useSignedImages(paths: string[] | undefined) {
  const list = (paths ?? []).filter(Boolean);
  return useQuery({
    queryKey: ["signed-images", list.join("|")],
    enabled: list.length > 0,
    staleTime: 1000 * 60 * 60 * 24 * 6,
    gcTime: 1000 * 60 * 60 * 24 * 7,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const remote = list.filter((p) => !p.startsWith("http"));
      if (remote.length > 0) await signPaths(remote);
      return list
        .map((p) => (p.startsWith("http") ? p : signedCache.get(p)?.url))
        .filter((u): u is string => Boolean(u));
    },
  });
}

export function priceOf(product: Pick<Product, "price" | "discount_price">) {
  return product.discount_price != null && product.discount_price > 0
    ? Number(product.discount_price)
    : Number(product.price);
}

export function formatMoney(value: number, label = "ر.ي") {
  const n = Number(value || 0);
  return `${n.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${label}`;
}

export function slugify(input: string) {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || `item-${Date.now()}`
  );
}

/** Returns the category id plus every descendant id (sub-categories). */
export function categoryTreeIds(categories: Category[], rootId: string): string[] {
  const ids = [rootId];
  const walk = (parent: string) => {
    categories
      .filter((c) => c.parent_id === parent)
      .forEach((c) => {
        ids.push(c.id);
        walk(c.id);
      });
  };
  walk(rootId);
  return ids;
}

export function rootCategories(categories: Category[]) {
  return categories.filter((c) => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
}

export function childrenOf(categories: Category[], parentId: string) {
  return categories
    .filter((c) => c.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Depth of a category inside the tree (0 = root). Supports unlimited nesting. */
export function depthOf(categories: Category[], c: Category) {
  let depth = 0;
  let parent = c.parent_id;
  while (parent && depth < 20) {
    depth += 1;
    parent = categories.find((x) => x.id === parent)?.parent_id ?? null;
  }
  return depth;
}

/** Prevents moving a category under one of its own descendants. */
export function descendantIds(categories: Category[], rootId: string) {
  return categoryTreeIds(categories, rootId);
}

export type ProductCategoryLink = { product_id: string; category_id: string };

export async function fetchProductLinks(): Promise<ProductCategoryLink[]> {
  try {
    const { data, error } = await supabase
      .from("product_categories")
      .select("product_id,category_id")
      .limit(10000);
    if (error) throw error;
    const list = (data as ProductCategoryLink[] | null) ?? [];
    if (list.length > 0) saveOfflineLinks(list);
    return list;
  } catch (err) {
    console.warn("[Store] fetchProductLinks failed, using offline fallback:", err);
    const cached = getOfflineLinks();
    return cached.length > 0 ? cached : [];
  }
}

export const productLinksQuery = {
  queryKey: ["product-categories"],
  queryFn: fetchProductLinks,
  staleTime: 60_000,
};

export function useProductLinks() {
  return useQuery(productLinksQuery);
}

/** Flattens the category tree in display order, keeping the depth of each node. */
export function flattenCategories(
  categories: Category[],
  parentId: string | null = null,
  depth = 0,
): { category: Category; depth: number }[] {
  return categories
    .filter((c) => (c.parent_id ?? null) === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((c) => [{ category: c, depth }, ...flattenCategories(categories, c.id, depth + 1)]);
}

/** Climbs parent_id until the real root of the tree (supports unlimited depth). */
export function rootOf(categories: Category[], category: Category): Category {
  let current = category;
  for (let i = 0; i < 20 && current.parent_id; i += 1) {
    const parent = categories.find((c) => c.id === current.parent_id);
    if (!parent) break;
    current = parent;
  }
  return current;
}

export type RatingMap = Record<string, { avg: number } | undefined>;

/** Products of a smart category, evaluated from its automatic rule. */
export function smartProducts(
  products: Product[],
  rule: SmartRule | null | undefined,
  ratings?: RatingMap,
) {
  const type = rule?.type ?? "new";
  let list = [...products];
  if (type === "bestseller") list = list.filter((p) => p.is_bestseller);
  else if (type === "featured") list = list.filter((p) => p.is_featured);
  else if (type === "top-rated")
    // Real ratings when available; never confuse "featured" with "top rated".
    list = list
      .filter((p) => (ratings?.[p.id]?.avg ?? 0) > 0)
      .sort((a, b) => (ratings?.[b.id]?.avg ?? 0) - (ratings?.[a.id]?.avg ?? 0));
  else if (type === "deals")
    list = list.filter((p) => p.discount_price != null && Number(p.discount_price) > 0);
  else if (type === "price")
    list = list.filter((p) => {
      const v = priceOf(p);
      return (rule?.min == null || v >= rule.min) && (rule?.max == null || v <= rule.max);
    });
  else list = list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return rule?.limit ? list.slice(0, rule.limit) : list;
}

/** True when the product belongs to the category (direct, extra link, brand association, or smart rule). */
export function productMatchesCategory(
  product: Product,
  category: Category,
  categories: Category[],
  links: ProductCategoryLink[],
  ratings?: RatingMap,
  brands?: { id: string; slug: string; name?: string }[],
) {
  if (category.kind === "smart")
    return smartProducts([product], category.smart_rule, ratings).length > 0;

  const ids = categoryTreeIds(categories, category.id);

  // 1. تطابق القسم الأساسي أو شجرة الأقسام الفرعية التابعة
  if (product.category_id && ids.includes(product.category_id)) return true;

  // 2. تطابق الأقسام الإضافية من جدول product_categories
  if (links.some((l) => l.product_id === product.id && ids.includes(l.category_id))) return true;

  // 3. تطابق خاص بالماركات التجارية (kind === "brand")
  if (category.kind === "brand") {
    if (product.brand_id) {
      // تطابق مباشر لمعرف الماركة مع معرّف قسم الماركة
      if (ids.includes(product.brand_id)) return true;

      // تطابق مع جدول الماركات brands بالمعرّف والـ slug أو الاسم
      if (
        brands &&
        brands.some(
          (b) =>
            b.id === product.brand_id &&
            (b.slug === category.slug ||
              (b.name && b.name.trim().toLowerCase() === category.name.trim().toLowerCase())),
        )
      ) {
        return true;
      }

      // تطابق مع أي قسم ماركة آخر يحمل نفس المعرّف والرابط
      const matchCat = categories.find((c) => c.kind === "brand" && c.id === product.brand_id);
      if (matchCat && (matchCat.slug === category.slug || matchCat.name === category.name)) {
        return true;
      }
    }
  }

  return false;
}
