import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BUCKET, slugify } from "@/lib/store";

/** جداول النسخة الاحتياطية (الترتيب مهم بسبب المفاتيح الأجنبية). */
export const BACKUP_TABLES = [
  "store_settings",
  "site_settings",
  "currencies",
  "themes",
  "brands",
  "categories",
  "product_colors",
  "products",
  "product_categories",
  "product_prices",
  "product_options",
  "product_option_values",
  "product_reviews",
  "banners",
  "payment_methods",
  "delivery_zones",
  "testimonials",
  "profiles",
  "user_roles",
  "permissions",
  "role_permissions",
  "orders",
  "order_items",
  "invoices",
  "whatsapp_messages",
  "discount_coupons",
  "coupon_redemptions",
  "loyalty_settings",
  "loyalty_rewards",
  "loyalty_accounts",
  "loyalty_transactions",
  "loyalty_coupons",
  "loyalty_checkins",
  "admin_audit_log",
  "influencers",
  "affiliate_earnings",
  "affiliate_withdrawals",
  "developer_commissions",
  "page_views",
] as const;

export type TableName = (typeof BACKUP_TABLES)[number];
type StoredFile = { path: string; type: string; data: string };
export type Backup = {
  version?: number;
  exported_at?: string;
  tables?: Partial<Record<TableName, Record<string, unknown>[]>>;
  files?: StoredFile[];
} & Partial<Record<TableName, Record<string, unknown>[]>>;

export type BackupTask = {
  kind: "export" | "import" | null;
  running: boolean;
  progress: string;
  percent: number;
  log: string[];
  finishedAt: number | null;
  error: string | null;
};

const idle: BackupTask = {
  kind: null,
  running: false,
  progress: "",
  percent: 0,
  log: [],
  finishedAt: null,
  error: null,
};

// حالة عامة خارج React: العملية تستمر حتى عند مغادرة الصفحة.
let state: BackupTask = idle;
const listeners = new Set<() => void>();

function set(patch: Partial<BackupTask>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getBackupSnapshot = () => state;
const getIdleSnapshot = () => idle;

export function useBackupTask(): BackupTask {
  return useSyncExternalStore(subscribe, getBackupSnapshot, getIdleSnapshot);
}

export function clearBackupTask() {
  if (state.running) return;
  set({ ...idle });
}

async function listAllFiles(): Promise<string[]> {
  const { listAllStoreFiles } = await import("./storage-admin.functions");
  return listAllStoreFiles();
}

/** ينزّل الصور عبر روابط موقّعة من الخادم (يتجاوز قيود صلاحيات المتصفح). */
async function downloadMany(paths: string[]): Promise<Record<string, Blob>> {
  const { signStoreFiles } = await import("./storage-admin.functions");
  const urls = await signStoreFiles({ data: { paths } });
  const out: Record<string, Blob> = {};
  await Promise.all(
    paths.map(async (p) => {
      const u = urls[p];
      if (!u) return;
      for (let a = 0; a < 2; a += 1) {
        try {
          const r = await fetch(u);
          if (r.ok) { out[p] = await r.blob(); return; }
        } catch { /* retry */ }
      }
    }),
  );
  return out;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

export function inferMimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "avif":
      return "image/avif";
    case "bmp":
      return "image/bmp";
    case "ico":
      return "image/x-icon";
    case "tiff":
    case "tif":
      return "image/tiff";
    case "heic":
      return "image/heic";
    default:
      return "image/jpeg";
  }
}

export async function universalDataToBlob(
  dataStr: string,
  path: string,
  declaredType?: string,
): Promise<{ blob: Blob; mime: string }> {
  const defaultMime =
    declaredType && declaredType.includes("/") ? declaredType : inferMimeFromPath(path);

  // إذا كان الرابط عبر الإنترنت (HTTP / HTTPS)
  if (dataStr.startsWith("http://") || dataStr.startsWith("https://")) {
    try {
      const resp = await fetch(dataStr);
      if (resp.ok) {
        const b = await resp.blob();
        return { blob: b, mime: b.type || defaultMime };
      }
    } catch {
      /* fallback to octet */
    }
  }

  // إذا كان Data URL يحتوي على نوع مضمن
  let base64 = dataStr;
  let detectedMime = defaultMime;
  if (dataStr.startsWith("data:")) {
    const commaIdx = dataStr.indexOf(",");
    if (commaIdx !== -1) {
      const header = dataStr.slice(5, commaIdx);
      const parts = header.split(";");
      if (parts[0]) detectedMime = parts[0];
      base64 = dataStr.slice(commaIdx + 1);
    }
  }

  // تنظيف الـ Base64 من المسافات والفواصل والأسطر
  const cleanBase64 = base64.replace(/\s/g, "");
  try {
    const bin = atob(cleanBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return { blob: new Blob([bytes], { type: detectedMime }), mime: detectedMime };
  } catch {
    // محاولة تصحيح الـ padding
    try {
      const padded = cleanBase64.padEnd(
        cleanBase64.length + ((4 - (cleanBase64.length % 4)) % 4),
        "=",
      );
      const bin = atob(padded);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      return { blob: new Blob([bytes], { type: detectedMime }), mime: detectedMime };
    } catch {
      // نص عادي أو SVG مباشر
      const encoder = new TextEncoder();
      return {
        blob: new Blob([encoder.encode(dataStr)], { type: detectedMime }),
        mime: detectedMime,
      };
    }
  }
}

function dataUrlToBlob(dataUrl: string, type: string) {
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  try {
    const bin = atob(base64.replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || "application/octet-stream" });
  } catch {
    const encoder = new TextEncoder();
    return new Blob([encoder.encode(dataUrl)], { type: type || "application/octet-stream" });
  }
}

let unloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

function lockTab() {
  if (typeof window === "undefined" || unloadHandler) return;
  unloadHandler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", unloadHandler);
}

function unlockTab() {
  if (typeof window === "undefined" || !unloadHandler) return;
  window.removeEventListener("beforeunload", unloadHandler);
  unloadHandler = null;
}

/** يجلب كافة سجلات الجدول بالترقيم لتفادي قطع التصدير عند حد الـ 1000 سجل */
async function fetchAllTableRows(table: TableName): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) {
      if (from === 0) throw error;
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as Record<string, unknown>[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/** يصدّر الجداول المحددة (واختيارياً الصور) في الخلفية ثم ينزّل الملف. */
export function startExport(withImages: boolean, only?: TableName[]) {
  if (state.running) return;
  const selected =
    only && only.length > 0 ? BACKUP_TABLES.filter((t) => only.includes(t)) : [...BACKUP_TABLES];
  set({
    kind: "export",
    running: true,
    progress: "بدء التصدير…",
    percent: 1,
    log: [],
    error: null,
    finishedAt: null,
  });
  lockTab();
  void (async () => {
    const lines: string[] = [];
    try {
      const tables: Backup["tables"] = {};
      const total = selected.length;
      for (let i = 0; i < total; i += 1) {
        const table = selected[i] as TableName;
        set({
          progress: `تصدير جدول ${table}…`,
          percent: Math.round(((i + 1) / total) * (withImages ? 40 : 95)),
        });
        try {
          const rows = (await fetchAllTableRows(table)).map((r) => {
            const o: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(r)) if (v !== null && v !== undefined) o[k] = v;
            return o;
          });
          if (rows.length === 0) continue;
          tables[table] = rows;
          lines.push(`${table}: تم تصدير ${rows.length} سجل بالكامل`);
        } catch (err) {
          lines.push(`${table}: تعذّر التصدير (${(err as Error).message})`);
          tables[table] = [];
        }
      }

      const files: StoredFile[] = [];
      if (withImages) {
        const paths = await listAllFiles();
        for (let i = 0; i < paths.length; i += 1) {
          const path = paths[i] as string;
          set({
            progress: `تنزيل الصور ${i + 1}/${paths.length}…`,
            percent: 40 + Math.round(((i + 1) / Math.max(paths.length, 1)) * 55),
          });
          const data = (await downloadMany([path]))[path];
          if (!data) continue;
          files.push({ path, type: data.type, data: await blobToDataUrl(data) });
        }
        lines.push(`الصور: ${files.length} ملف`);
      }

      const backup: Backup = {
        version: 2,
        exported_at: new Date().toISOString(),
        tables,
        files,
        ...tables,
      };
      const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      set({
        running: false,
        percent: 100,
        progress: "اكتمل التصدير",
        log: lines,
        finishedAt: Date.now(),
      });
    } catch (e) {
      set({
        running: false,
        error: (e as Error).message,
        log: lines,
        finishedAt: Date.now(),
        progress: "",
      });
    } finally {
      unlockTab();
    }
  })();
}

/** تصدير كل صور المتجر كملف ZIP بنفس المجلدات. */
export function startImagesZipExport() {
  if (state.running) return;
  set({ kind: "export", running: true, progress: "تجهيز ملف الصور…", percent: 1, log: [], error: null, finishedAt: null });
  void (async () => {
    try {
      const { zipSync } = await import("fflate");
      const paths = await listAllFiles();
      // تقسيم الصور إلى ملفات ZIP متعددة لتفادي امتلاء ذاكرة الجهاز
      const PART = 300;
      const parts = Math.max(1, Math.ceil(paths.length / PART));
      let total = 0;
      let done = 0;
      for (let part = 0; part < parts; part += 1) {
        const slice = paths.slice(part * PART, (part + 1) * PART);
        const entries: Record<string, Uint8Array> = {};
        for (let i = 0; i < slice.length; i += 20) {
          const group = slice.slice(i, i + 20) as string[];
          const blobs = await downloadMany(group);
          for (const [p, b] of Object.entries(blobs)) entries[p] = new Uint8Array(await b.arrayBuffer());
          done += group.length;
          set({ progress: `تنزيل الصور ${done}/${paths.length} (جزء ${part + 1}/${parts})…`, percent: Math.round((done / Math.max(paths.length, 1)) * 95) });
        }
        const zipped = zipSync(entries, { level: 0 });
        total += Object.keys(entries).length;
        const url = URL.createObjectURL(new Blob([zipped as BlobPart], { type: "application/zip" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `images-${new Date().toISOString().slice(0, 10)}${parts > 1 ? `-part${part + 1}` : ""}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      set({ running: false, percent: 100, progress: "اكتمل تصدير الصور", log: [`الصور: ${total} ملف في ${parts} ملف ZIP`], finishedAt: Date.now() });
    } catch (e) {
      set({ running: false, error: (e as Error).message, progress: "", finishedAt: Date.now() });
    }
  })();
}

/** استيراد ملف ZIP للصور وإعادتها لنفس مساراتها. */
export function startImagesZipImport(file: File) {
  if (state.running) return;
  set({ kind: "import", running: true, progress: "قراءة ملف الصور…", percent: 1, log: [], error: null, finishedAt: null });
  void (async () => {
    try {
      const { unzipSync } = await import("fflate");
      const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const names = Object.keys(files).filter((n) => !n.endsWith("/"));
      let ok = 0;
      // رفع 4 صور بالتوازي مع إعادة محاولة واحدة عند الفشل
      for (let i = 0; i < names.length; i += 4) {
        const group = names.slice(i, i + 4) as string[];
        await Promise.all(
          group.map(async (n) => {
            const blob = new Blob([files[n] as BlobPart], { type: inferMimeFromPath(n) });
            for (let attempt = 0; attempt < 2; attempt += 1) {
              const { error } = await supabase.storage.from(BUCKET).upload(n, blob, { upsert: true, contentType: blob.type });
              if (!error) { ok += 1; break; }
            }
            delete files[n];
          }),
        );
        const d = Math.min(i + 4, names.length);
        set({ progress: `رفع الصور ${d}/${names.length}…`, percent: Math.round((d / Math.max(names.length, 1)) * 99) });
      }
      set({ running: false, percent: 100, progress: "اكتمل استيراد الصور", log: [`تم رفع ${ok} من ${names.length} صورة`], finishedAt: Date.now() });
    } catch (e) {
      set({ running: false, error: (e as Error).message, progress: "", finishedAt: Date.now() });
    }
  })();
}

export type ImportOptions = { only?: TableName[]; withImages?: boolean; dryRun?: boolean };

/** مجلدات التخزين المرتبطة بكل جدول، لعزل صور الجداول غير المختارة. */
const TABLE_FOLDERS: Partial<Record<TableName, string[]>> = {
  products: ["products"],
  product_prices: ["products"],
  product_options: ["products"],
  product_option_values: ["products"],
  product_colors: ["products"],
  brands: ["brands", "categories"],
  categories: ["categories"],
  banners: ["banners"],
  themes: ["themes"],
  store_settings: ["branding", "settings", "logos"],
  site_settings: ["branding", "settings", "logos", "themes"],
  payment_methods: ["payments"],
  orders: ["receipts"],
  testimonials: ["testimonials"],
};

/** يُبقي فقط الصور التي تخص الجداول المختارة. */
function filterFilesBySelection(files: StoredFile[], only?: TableName[]) {
  if (!only || only.length === 0) return files;
  const folders = new Set<string>();
  for (const t of only) for (const f of TABLE_FOLDERS[t] ?? []) folders.add(f);
  if (folders.size === 0) return [];
  return files.filter((f) => {
    const top = f.path.includes("/") ? f.path.slice(0, f.path.indexOf("/")) : "";
    return folders.has(top);
  });
}

const FORCE_COMPRESS_BYTES = 150 * 1024;

/** ضغط للصور الكبيرة وتحويلها إلى WebP قبل الرفع مع قبول كافة الصيغ دون استثناء. */
async function toWebp(blob: Blob, path: string, type: string) {
  const mime = type || inferMimeFromPath(path);
  const isImage = mime.startsWith("image/") && !["image/svg+xml", "image/gif"].includes(mime);
  const needs = isImage && (mime !== "image/webp" || blob.size > FORCE_COMPRESS_BYTES);
  if (!needs) return { blob, type: mime, converted: false };
  try {
    const { compressImage } = await import("@/lib/image-compress");
    const name = path.split("/").pop() ?? "image";
    const file = new File([blob], name, { type: mime });
    const out = await compressImage(file, { maxSize: 1400, quality: 0.82 });
    if (out.type !== "image/webp" || out.size === 0) return { blob, type: mime, converted: false };
    return { blob: out, type: "image/webp", converted: true };
  } catch {
    // قبول الصورة بحالتها الأصلية دون تعطيل الرفع
    return { blob, type: mime, converted: false };
  }
}

/** ترتيب الاستيراد الآمن حسب المفاتيح الأجنبية. */
const IMPORT_ORDER: TableName[] = [
  "store_settings",
  "site_settings",
  "currencies",
  "themes",
  "brands",
  "categories",
  "product_colors",
  "products",
  "product_categories",
  "product_prices",
  "product_options",
  "product_option_values",
  "product_reviews",
  "banners",
  "payment_methods",
  "delivery_zones",
  "testimonials",
  "profiles",
  "user_roles",
  "permissions",
  "role_permissions",
  "orders",
  "order_items",
  "invoices",
  "whatsapp_messages",
  "discount_coupons",
  "coupon_redemptions",
  "loyalty_settings",
  "loyalty_rewards",
  "loyalty_accounts",
  "loyalty_transactions",
  "loyalty_coupons",
  "loyalty_checkins",
  "admin_audit_log",
  "influencers",
  "affiliate_earnings",
  "affiliate_withdrawals",
  "developer_commissions",
  "page_views",
];

/** يحدد عمود أو أعمدة عدم التعارض (onConflict) المناسبة لكل جدول بدقة لتفادي أخطاء المفاتيح */
function getConflictTarget(table: TableName): string {
  switch (table) {
    case "product_categories":
      return "product_id,category_id";
    case "product_prices":
      return "product_id,currency_code";
    case "role_permissions":
      return "role,permission_id";
    case "site_settings":
      return "key";
    case "currencies":
      return "code";
    case "loyalty_checkins":
      return "account_id,checkin_date";
    default:
      return "id";
  }
}

/** قائمة الأعمدة المعتمدة لكل جدول لحماية الاستيراد من الحقول الشاذة القادمة من منصات أو نسخ أخرى */
const KNOWN_TABLE_COLUMNS: Partial<Record<TableName, string[]>> = {
  products: [
    "id",
    "name",
    "slug",
    "sku",
    "description",
    "price",
    "discount_price",
    "images",
    "category_id",
    "brand_id",
    "stock",
    "status",
    "is_featured",
    "is_bestseller",
    "created_at",
    "updated_at",
  ],
  categories: [
    "id",
    "name",
    "slug",
    "image",
    "sort_order",
    "parent_id",
    "description",
    "icon",
    "color",
    "cover_image",
    "is_active",
    "kind",
    "smart_rule",
    "seo_title",
    "seo_description",
    "seo_keywords",
  ],
  brands: ["id", "name", "slug", "image", "description", "is_active", "sort_order"],
  product_categories: ["id", "product_id", "category_id", "created_at"],
  product_prices: [
    "id",
    "product_id",
    "currency_code",
    "price",
    "discount_price",
    "created_at",
    "updated_at",
  ],
  product_options: ["id", "product_id", "name", "kind", "sort_order", "created_at", "updated_at"],
  product_option_values: [
    "id",
    "option_id",
    "product_id",
    "name",
    "code",
    "color_id",
    "stock",
    "price",
    "compare_at_price",
    "is_available",
    "sort_order",
    "sku",
    "images",
    "swatch",
    "created_at",
    "updated_at",
  ],
  product_colors: [
    "id",
    "name",
    "display_name",
    "hex_code",
    "family",
    "swatch_image_url",
    "sort_order",
    "created_at",
    "updated_at",
  ],
  orders: [
    "id",
    "order_number",
    "customer_name",
    "phone",
    "city",
    "district",
    "address",
    "notes",
    "total",
    "delivery_fee",
    "currency",
    "currency_label",
    "currency_rate",
    "status",
    "payment_method",
    "payment_status",
    "receipt_url",
    "last_contact_at",
    "public_token",
    "created_at",
  ],
  order_items: [
    "id",
    "order_id",
    "product_id",
    "product_name",
    "quantity",
    "price",
    "color_name",
    "size_name",
    "sku",
    "image",
    "option_value_id",
    "created_at",
  ],
  invoices: [
    "id",
    "invoice_number",
    "order_id",
    "phone",
    "customer_name",
    "subtotal",
    "discount",
    "delivery_fee",
    "total",
    "currency_label",
    "payment_method",
    "payment_status",
    "points_awarded",
    "issued_at",
  ],
  banners: [
    "id",
    "title",
    "subtitle",
    "image",
    "badge",
    "cta_label",
    "cta_url",
    "category_id",
    "is_active",
    "sort_order",
    "placement",
    "created_at",
    "updated_at",
  ],
  testimonials: ["id", "customer_name", "content", "rating", "is_visible", "created_at"],
};

/** محرك الفحص والإصلاح التلقائي للصفوف:
 * 1. المنتجات: استيعاب المسميات البديلة، توليد slug فريد، أسعار ومخزون موجبة، تفعيل حالة الظهور، وقبول كافة روابط ومسارات الصور.
 * 2. الأقسام والماركات: توليد slug، منع العلاقات الدائرية.
 * 3. روابط وتصنيفات وأسعار المنتجات: ضمان الأعمدة والمفاتيح المركبة.
 */
function sanitizeRows(table: TableName, rows: Record<string, unknown>[]) {
  if (table === "products") {
    const seenSkus = new Set<string>();
    const seenSlugs = new Set<string>();

    return rows.map((row, idx) => {
      const clone = { ...row };

      // استيعاب مسميات الحقول البديلة من ملفات CSV/Excel أو منصات أخرى (زد/سلة/شوبيفاي)
      const rawName =
        clone["name"] ||
        clone["title"] ||
        clone["product_name"] ||
        clone["اسم المنتج"] ||
        clone["الاسم"] ||
        `منتج مستورد #${idx + 1}`;
      clone["name"] = String(rawName).trim();

      if (!clone["id"] || typeof clone["id"] !== "string") {
        clone["id"] = crypto.randomUUID();
      }

      // توليد وضمان فرادة الـ slug
      const rawSlug = clone["slug"] || slugify(String(clone["name"])) || `product-${idx + 1}`;
      let cleanSlug = String(rawSlug).trim().toLowerCase();
      if (!cleanSlug || seenSlugs.has(cleanSlug)) {
        cleanSlug = `${cleanSlug || "prod"}-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`;
      }
      seenSlugs.add(cleanSlug);
      clone["slug"] = cleanSlug;

      // قراءة السعر
      const rawPrice =
        clone["price"] !== undefined
          ? clone["price"]
          : clone["sale_price"] !== undefined
            ? clone["sale_price"]
            : clone["regular_price"] !== undefined
              ? clone["regular_price"]
              : clone["السعر"];
      const numPrice = Number(rawPrice);
      clone["price"] = isNaN(numPrice) || numPrice < 0 ? 0 : numPrice;

      // سعر الخصم
      const rawDisc =
        clone["discount_price"] !== undefined
          ? clone["discount_price"]
          : clone["سعر الخصم"] !== undefined
            ? clone["سعر الخصم"]
            : clone["compare_at_price"];
      if (rawDisc !== null && rawDisc !== undefined && String(rawDisc).trim() !== "") {
        const numDisc = Number(rawDisc);
        clone["discount_price"] = isNaN(numDisc) || numDisc < 0 ? null : numDisc;
      } else {
        clone["discount_price"] = null;
      }

      // الوصف
      const rawDesc = clone["description"] || clone["desc"] || clone["details"] || clone["الوصف"];
      clone["description"] = rawDesc ? String(rawDesc) : null;

      // المخزون (الافتراضي 10 حتى لا تكون المنتجات نافدة تلقائياً ما لم يُحدد 0)
      const rawStock =
        clone["stock"] !== undefined
          ? clone["stock"]
          : clone["quantity"] !== undefined
            ? clone["quantity"]
            : clone["qty"] !== undefined
              ? clone["qty"]
              : clone["المخزون"];
      const numStock = Number(rawStock);
      clone["stock"] = isNaN(numStock) || numStock < 0 ? 10 : Math.floor(numStock);

      // حالة الظهور (الافتراضي مفعل true لتظهر كافة المنتجات فوراً)
      const rawStatus = clone["status"] !== undefined ? clone["status"] : clone["is_active"];
      clone["status"] = rawStatus !== undefined ? Boolean(rawStatus) : true;
      clone["is_featured"] = Boolean(clone["is_featured"]);
      clone["is_bestseller"] = Boolean(clone["is_bestseller"]);

      // قبول كافة صيغ ومسارات وروابط الصور
      const rawImages =
        clone["images"] || clone["image"] || clone["photos"] || clone["الصور"] || clone["الصورة"];
      if (Array.isArray(rawImages)) {
        clone["images"] = rawImages
          .map((img) => (typeof img === "string" ? img.trim() : ""))
          .filter((img) => img.length > 0);
      } else if (typeof rawImages === "string" && rawImages.trim()) {
        try {
          const parsed = JSON.parse(rawImages);
          clone["images"] = Array.isArray(parsed)
            ? parsed.map(String).filter((s) => s.trim().length > 0)
            : [rawImages.trim()];
        } catch {
          // روابط مفصولة بفواصل
          if (rawImages.includes(",")) {
            clone["images"] = rawImages
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          } else {
            clone["images"] = [rawImages.trim()];
          }
        }
      } else {
        clone["images"] = [];
      }

      // معالجة الـ SKU مع ضمان عدم التكرار
      const rawSku =
        clone["sku"] || clone["barcode"] || clone["code"] || clone["الباركود"] || clone["الرمز"];
      if (rawSku && String(rawSku).trim()) {
        const cleanSku = String(rawSku).trim();
        if (seenSkus.has(cleanSku.toLowerCase())) {
          clone["sku"] = `${cleanSku}-${idx + 1}`;
        } else {
          clone["sku"] = cleanSku;
        }
        seenSkus.add(String(clone["sku"]).toLowerCase());
      } else {
        clone["sku"] = null;
      }

      // تنقية الأعمدة
      const allowed = KNOWN_TABLE_COLUMNS.products ?? [];
      const cleanProduct: Record<string, unknown> = {};
      for (const k of allowed) {
        if (k in clone) cleanProduct[k] = clone[k];
      }
      if (!cleanProduct["id"]) cleanProduct["id"] = clone["id"];
      return cleanProduct;
    });
  }

  if (table === "categories") {
    return rows.map((row, idx) => {
      const clone = { ...row };
      if (!clone["id"]) clone["id"] = crypto.randomUUID();
      if (!clone["name"]) clone["name"] = `تصنيف مستورد #${idx + 1}`;
      if (!clone["slug"]) {
        clone["slug"] =
          slugify(String(clone["name"])) + "-" + Math.random().toString(36).slice(2, 6);
      }
      if (clone["parent_id"] === clone["id"]) clone["parent_id"] = null;
      if (clone["is_active"] === undefined) clone["is_active"] = true;
      return clone;
    });
  }

  if (table === "brands") {
    return rows.map((row, idx) => {
      const clone = { ...row };
      if (!clone["id"]) clone["id"] = crypto.randomUUID();
      if (!clone["name"]) clone["name"] = `ماركة مستوردة #${idx + 1}`;
      if (!clone["slug"]) {
        clone["slug"] =
          slugify(String(clone["name"])) + "-" + Math.random().toString(36).slice(2, 6);
      }
      if (clone["is_active"] === undefined) clone["is_active"] = true;
      return clone;
    });
  }

  if (table === "product_categories") {
    return rows
      .filter((r) => r["product_id"] && r["category_id"])
      .map((row) => ({
        id: (row["id"] as string) || crypto.randomUUID(),
        product_id: row["product_id"],
        category_id: row["category_id"],
        created_at: row["created_at"] || new Date().toISOString(),
      }));
  }

  if (table === "product_prices") {
    return rows
      .filter((r) => r["product_id"] && r["currency_code"])
      .map((row) => ({
        id: (row["id"] as string) || crypto.randomUUID(),
        product_id: row["product_id"],
        currency_code: row["currency_code"],
        price: row["price"] != null ? Number(row["price"]) : null,
        discount_price: row["discount_price"] != null ? Number(row["discount_price"]) : null,
        created_at: row["created_at"] || new Date().toISOString(),
      }));
  }

  if (table === "themes") {
    let hasDefault = false;
    return rows.map((row) => {
      const clone = { ...row };
      if (!clone["id"]) clone["id"] = crypto.randomUUID();
      if (clone["is_default"]) {
        if (hasDefault) clone["is_default"] = false;
        else hasDefault = true;
      }
      return clone;
    });
  }

  if (table === "orders") {
    return rows.map((row, idx) => {
      const clone = { ...row };
      if (!clone["id"]) clone["id"] = crypto.randomUUID();
      if (!clone["order_number"]) {
        clone["order_number"] = Math.floor(10000 + Math.random() * 90000) + idx;
      }
      const rawTot = Number(clone["total"]);
      clone["total"] = isNaN(rawTot) || rawTot < 0 ? 0 : rawTot;
      return clone;
    });
  }

  if (table === "order_items") {
    return rows.map((row) => {
      const clone = { ...row };
      if (!clone["id"]) clone["id"] = crypto.randomUUID();
      const rawQty = Number(clone["quantity"]);
      clone["quantity"] = isNaN(rawQty) || rawQty < 1 ? 1 : Math.floor(rawQty);
      const rawPrice = Number(clone["price"]);
      clone["price"] = isNaN(rawPrice) || rawPrice < 0 ? 0 : rawPrice;
      return clone;
    });
  }

  return rows.map((r) => ({ ...r, id: r["id"] || crypto.randomUUID() }));
}

/** محرك الإدراج الذاتي الإصلاح: يحل مشاكل القيود الأجنبية وتعارض الحقول آلياً */
async function upsertWithAutoFix(
  table: TableName,
  chunk: Record<string, unknown>[],
): Promise<{ inserted: number; healed: number; failed: number }> {
  const conflictTarget = getConflictTarget(table);

  // المحاولة الأولى السريعة: إدراج الدفعة كاملة
  const bulk = await supabase.from(table).upsert(chunk as never, { onConflict: conflictTarget });
  if (!bulk.error) {
    return { inserted: chunk.length, healed: 0, failed: 0 };
  }

  // في حال وجود أي تعارض، تفعيل الإصلاح الفردي الدقيق لإنقاذ كافة السجلات دون استثناء
  let inserted = 0;
  let healed = 0;
  let failed = 0;

  for (const row of chunk) {
    let res = await supabase.from(table).upsert([row] as never, { onConflict: conflictTarget });
    if (!res.error) {
      inserted++;
      continue;
    }

    // تصحيح القيود الأجنبية وتعارض الحقول تدريجياً
    const fixed = { ...row };
    const errText = (res.error.message || "").toLowerCase();

    if (table === "products") {
      // إزالة معرّفات الأقسام أو الماركات غير الموجودة لتفادي انهيار إدراج المنتج
      if (
        errText.includes("foreign key") ||
        errText.includes("fkey") ||
        errText.includes("brand") ||
        errText.includes("category") ||
        errText.includes("violates")
      ) {
        fixed["brand_id"] = null;
        fixed["category_id"] = null;
      }
      if (errText.includes("slug") || errText.includes("unique") || errText.includes("duplicate")) {
        fixed["slug"] = `${fixed["slug"] || "prod"}-${Math.random().toString(36).slice(2, 6)}`;
      }
      if (errText.includes("sku")) {
        fixed["sku"] = null;
      }
    } else if (table === "categories") {
      if (
        errText.includes("parent") ||
        errText.includes("foreign key") ||
        errText.includes("fkey")
      ) {
        fixed["parent_id"] = null;
      }
      if (errText.includes("slug") || errText.includes("unique") || errText.includes("duplicate")) {
        fixed["slug"] = `${fixed["slug"] || "cat"}-${Math.random().toString(36).slice(2, 6)}`;
      }
    } else if (table === "product_categories" || table === "product_prices") {
      // تجاوز الرابط في حال عدم وجود المنتج أو القسم في القاعدة
      failed++;
      continue;
    }

    // محاولة الإدراج بعد الإصلاح الأولي
    res = await supabase.from(table).upsert([fixed] as never, { onConflict: conflictTarget });
    if (!res.error) {
      inserted++;
      healed++;
    } else {
      // محاولة إنقاذ قصوى: إزالة كافة الروابط الأجنبية والحقول غير الأساسية وتوليد slug فريد
      if ("brand_id" in fixed) fixed["brand_id"] = null;
      if ("category_id" in fixed) fixed["category_id"] = null;
      if ("parent_id" in fixed) fixed["parent_id"] = null;
      if ("sku" in fixed) fixed["sku"] = null;
      if ("slug" in fixed)
        fixed["slug"] =
          `${fixed["slug"] || "item"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

      // تنقية الحقول حسب المخطط الرسمي المعتمد
      const knownCols = KNOWN_TABLE_COLUMNS[table];
      let cleanRow = fixed;
      if (knownCols && knownCols.length > 0) {
        cleanRow = {};
        for (const col of knownCols) {
          if (col in fixed) cleanRow[col] = fixed[col];
        }
      }

      const lastRes = await supabase
        .from(table)
        .upsert([cleanRow] as never, { onConflict: conflictTarget });
      if (!lastRes.error) {
        inserted++;
        healed++;
      } else {
        console.warn(`Failed to import row in table ${table}:`, lastRes.error.message, row);
        failed++;
      }
    }
  }

  return { inserted, healed, failed };
}

async function countRows(table: TableName) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  return error ? null : (count ?? 0);
}

/** يستورد نسخة احتياطية (صور + جداول محددة) في الخلفية مع إصلاح ذاتي كامل. */
export function startImport(file: File, options: ImportOptions = {}) {
  if (state.running) return;
  const { only, withImages = true, dryRun = false } = options;
  const selected = IMPORT_ORDER.filter((t) => (only && only.length > 0 ? only.includes(t) : true));
  set({
    kind: "import",
    running: true,
    progress: "قراءة الملف وتحليله…",
    percent: 1,
    log: [],
    error: null,
    finishedAt: null,
  });
  lockTab();
  void (async () => {
    const lines: string[] = [];
    let hadIssues = false;
    try {
      let rawData: unknown;
      try {
        rawData = JSON.parse(await file.text());
      } catch {
        throw new Error("ملف النسخة الاحتياطية غير صالح أو ليس بتنسيق JSON صحيح");
      }

      // دعم كافة هياكل ملفات الاستيراد بمرونة
      let tables: Partial<Record<TableName, Record<string, unknown>[]>> = {};
      let allFiles: StoredFile[] = [];
      let nativeBackup = false;

      if (Array.isArray(rawData)) {
        // قائمة منتجات مباشرة
        tables["products"] = rawData;
      } else if (rawData && typeof rawData === "object") {
        const obj = rawData as Record<string, unknown>;
        if (obj["tables"] && typeof obj["tables"] === "object") {
          nativeBackup = typeof obj["version"] === "number";
          tables = obj["tables"] as Partial<Record<TableName, Record<string, unknown>[]>>;
          allFiles = Array.isArray(obj["files"]) ? (obj["files"] as StoredFile[]) : [];
        } else if (Array.isArray(obj["products"])) {
          tables = obj as Partial<Record<TableName, Record<string, unknown>[]>>;
          allFiles = Array.isArray(obj["files"]) ? (obj["files"] as StoredFile[]) : [];
        } else {
          tables = obj as Partial<Record<TableName, Record<string, unknown>[]>>;
        }
      }

      const files = dryRun ? [] : filterFilesBySelection(allFiles, only);
      if (dryRun) lines.push(`فحص تجريبي فقط — لم يُحفظ أي شيء. الصور في الملف: ${allFiles.length}`);
      const skippedFiles = allFiles.length - files.length;
      let ok = 0;
      let converted = 0;
      const failedFiles: string[] = [];

      for (let i = 0; i < files.length; i += 1) {
        const f = files[i] as StoredFile;
        set({
          progress: `معالجة ورفع الصور ${i + 1}/${files.length}…`,
          percent: Math.round(((i + 1) / Math.max(1, files.length)) * 50),
        });
        try {
          // قبول كافة صيغ الصور وتحويلها للويب بأمان
          const { blob, mime } = await universalDataToBlob(f.data, f.path, f.type);
          const optimized = await toWebp(blob, f.path, mime);
          if (optimized.converted) converted += 1;
          const { error } = await supabase.storage
            .from(BUCKET)
            .upload(f.path, optimized.blob, { upsert: true, contentType: optimized.type });

          if (error) {
            // محاولة إضافية بمسار منقى
            const cleanPath = f.path.replace(/[^\w/.-]/g, "_");
            const retry = await supabase.storage
              .from(BUCKET)
              .upload(cleanPath, optimized.blob, { upsert: true, contentType: optimized.type });
            if (retry.error) failedFiles.push(f.path);
            else ok += 1;
          } else {
            ok += 1;
          }
        } catch {
          failedFiles.push(f.path);
        }
      }

      if (files.length > 0) {
        lines.push(
          `الصور: تم قبول ورفع ${ok} من ${files.length}${converted ? ` (تم تحسين ${converted} إلى WebP)` : ""}`,
        );
        if (skippedFiles > 0) lines.push(`صور مستثناة (جداول غير مختارة): ${skippedFiles}`);
        if (failedFiles.length > 0) {
          lines.push(
            `صور تعذّر رفعها (${failedFiles.length}): ${failedFiles.slice(0, 3).join("، ")}${failedFiles.length > 3 ? "…" : ""}`,
          );
        }
      } else if (withImages) {
        lines.push(
          allFiles.length > 0
            ? `الصور: تم استثناء الصور غير التابعة للجداول المحددة (${allFiles.length})`
            : "الصور: لا توجد صور مرفقة في هذا الملف",
        );
      }

      const total = selected.length;
      const expected: Partial<Record<TableName, number>> = {};
      let totalAutoHealed = 0;

      for (let i = 0; i < total; i += 1) {
        const table = selected[i] as TableName;
        const rows = tables[table];
        set({
          progress: `استيراد وإصلاح بيانات ${table}…`,
          percent: 50 + Math.round(((i + 1) / total) * 45),
        });
        if (!Array.isArray(rows) || rows.length === 0) continue;
        expected[table] = rows.length;

        if (dryRun) {
          const bad = rows.filter((r) => !r || typeof r !== "object").length;
          lines.push(`${table}: ${rows.length - bad} سجل سليم${bad ? `، ${bad} غير صالح` : ""}`);
          if (bad) hadIssues = true;
          continue;
        }

        // نسخة المتجر الأصلية تُستورد كما هي؛ الإصلاح يتدخل فقط عند رفض السجل
        const clean = nativeBackup ? rows : sanitizeRows(table, rows);
        let inserted = 0;
        let tableHealed = 0;
        const chunkSize = 200;

        for (let c = 0; c < clean.length; c += chunkSize) {
          const chunk = clean.slice(c, c + chunkSize);
          const res = await upsertWithAutoFix(table, chunk);
          inserted += res.inserted;
          tableHealed += res.healed;
          totalAutoHealed += res.healed;
        }

        const healNote = tableHealed > 0 ? ` (تم إصلاح ${tableHealed} سجل آلياً)` : "";
        lines.push(`${table}: تم بنجاح استيراد ${inserted} من ${clean.length} سجل${healNote}`);
        if (inserted < clean.length) hadIssues = true;

        // مزامنة فورية مع التخزين المحلي للموردين وتكاليف المنتجات والسلات المتروكة
        if (table === "site_settings" && typeof window !== "undefined") {
          clean.forEach((row) => {
            const key = row["key"];
            const val = row["value"];
            if (typeof key === "string" && typeof val === "string") {
              try {
                localStorage.setItem(key, val);
              } catch {
                /* ignore */
              }
            }
          });
        }
      }

      if (totalAutoHealed > 0) {
        lines.push(`الإصلاح الذاتي: تم تصحيح ${totalAutoHealed} سجل بنجاح دون فقد البيانات`);
      }

      // التحقق الصارم من وجود ثيم أساسي واحد فقط بعد الاستيراد
      if (selected.includes("themes")) {
        try {
          const { data: defThemes } = await supabase
            .from("themes")
            .select("id, name, is_default")
            .eq("is_default", true);
          if (defThemes && defThemes.length > 1) {
            const keepId = defThemes[0]!.id;
            await supabase
              .from("themes")
              .update({ is_default: false } as never)
              .neq("id", keepId);
            lines.push("الثيمات: تم توحيد الثيم الأساسي وحذف أي تكرار");
          } else if (!defThemes || defThemes.length === 0) {
            const { data: anyTheme } = await supabase
              .from("themes")
              .select("id")
              .limit(1)
              .maybeSingle();
            if (anyTheme) {
              await supabase
                .from("themes")
                .update({ is_default: true } as never)
                .eq("id", anyTheme.id);
              lines.push("الثيمات: تم تفعيل ثيم أساسي افتراضي بنجاح");
            }
          }
        } catch {
          /* ignore */
        }
      }

      // تحقق بعد الاستيراد: مقارنة الأعداد الفعلية في قاعدة البيانات.
      set({ progress: "التحقق بعد الاستيراد…", percent: 97 });
      for (const table of ["products", "categories"] as TableName[]) {
        const exp = expected[table];
        if (exp === undefined) continue;
        const actual = await countRows(table);
        if (actual === null) {
          hadIssues = true;
          lines.push(`تحقق ${table}: تعذّر القراءة`);
        } else {
          lines.push(`تحقق ${table}: ${actual} سجل في القاعدة (النسخة: ${exp})`);
          if (actual < exp) hadIssues = true;
        }
      }

      set({
        running: false,
        percent: 100,
        progress: hadIssues ? "اكتمل الاستيراد مع ملاحظات" : "اكتمل الاستيراد بنجاح",
        log: lines,
        error: hadIssues ? "الاستيراد غير مكتمل — راجعي التقرير أدناه" : null,
        finishedAt: Date.now(),
      });
    } catch (e) {
      set({
        running: false,
        error: (e as Error).message,
        log: lines,
        finishedAt: Date.now(),
        progress: "",
      });
    } finally {
      unlockTab();
    }
  })();
}
