import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminCaller } from "@/lib/caller.server";
import { recordAdminAudit } from "@/lib/admin/audit.server";
import { BACKUP_TABLES } from "@/lib/backup";
import { BUCKET } from "@/lib/store";

const getSupabaseServerClient = () => supabaseAdmin;

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const GATEWAY_UPLOAD_URL = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files";
const ROOT_FOLDER = "نسخ_احتياطي_متجر_إيهاب";
const IMAGES_FOLDER = "صور_المتجر";
const DB_BACKUPS_FOLDER = "قواعد_البيانات";

/** ترتيب استيراد الجداول الآمن لتفادي أخطاء المفاتيح الأجنبية */
const IMPORT_ORDER = [
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
] as const;

function getConflictTarget(table: string): string {
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

/** ترويسات التفويض الموحدة لخدمات Google Drive وLovable Gateway */
function getAuthHeaders(contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const driveKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !driveKey) {
    throw new Error("حساب Google Drive غير مربوط بالمتجر");
  }
  headers["Authorization"] = `Bearer ${lovableKey}`;
  headers["X-Connection-Api-Key"] = driveKey;
  return headers;
}

/** العثور على مجلد أو إنشاؤه في Google Drive */
async function getOrCreateFolder(name: string, parentId?: string): Promise<string> {
  let query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  const searchRes = await fetch(`${GATEWAY_URL}/files?q=${encodeURIComponent(query)}`, {
    headers: getAuthHeaders(),
  });
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) return data.files[0].id;
  }

  const createRes = await fetch(`${GATEWAY_URL}/files`, {
    method: "POST",
    headers: getAuthHeaders("application/json"),
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  const resData = await createRes.json();
  if (!createRes.ok || !resData.id) {
    throw new Error(resData?.error?.message || `تعذر إنشاء المجلد ${name} في Google Drive`);
  }
  return resData.id;
}

/** جلب قائمة أسماء الصور المحفوظة مسبقاً لمنع التكرار */
async function getUploadedImagesSet(folderId: string): Promise<Set<string>> {
  const existing = new Set<string>();
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GATEWAY_URL}/files`);
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("fields", "nextPageToken, files(id, name)");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { headers: getAuthHeaders() });
    if (!res.ok) break;
    const data = await res.json();
    if (data.files) {
      for (const item of data.files) existing.add(item.name);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return existing;
}

/** استعراض كافة ملفات التخزين بجميع المجلدات الفرعية بشكل تكراري */
async function listAllStorageFiles(supabase: any, prefix = ""): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const out: string[] = [];
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      out.push(path);
    } else {
      out.push(...(await listAllStorageFiles(supabase, path)));
    }
  }
  return out;
}

/** جلب كافة سجلات الجدول بالترقيم لتفادي انقطاع البيانات */
async function fetchAllTableRows(supabase: any, table: string): Promise<Record<string, unknown>[]> {
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

// =====================================================================
// 1. تصدير قاعدة البيانات كاملة إلى Google Drive
// =====================================================================
export const exportFullDatabaseToDriveAction = createServerFn({ method: "POST" })
  .handler(async () => {
    const caller = await requireAdminCaller();
    const supabase = getSupabaseServerClient();
    const mainFolderId = await getOrCreateFolder(ROOT_FOLDER);
    const dbFolderId = await getOrCreateFolder(DB_BACKUPS_FOLDER, mainFolderId);

    const exportedData: {
      version: number;
      type: string;
      store: string;
      exported_at: string;
      tables: Record<string, Record<string, unknown>[]>;
      summary: { total_tables: number; total_records: number };
    } = {
      version: 2,
      type: "full_database_backup",
      store: "إيهاب ستور",
      exported_at: new Date().toISOString(),
      tables: {},
      summary: { total_tables: 0, total_records: 0 },
    };

    let totalRecordsCount = 0;
    for (const table of BACKUP_TABLES) {
      try {
        const rows = await fetchAllTableRows(supabase, table);
        exportedData["tables"][table] = rows;
        totalRecordsCount += rows.length;
      } catch (err) {
        console.warn(`[ExportDrive] Error reading table ${table}:`, err);
        exportedData["tables"][table] = [];
      }
    }

    exportedData.summary = {
      total_tables: Object.keys(exportedData.tables).length,
      total_records: totalRecordsCount,
    };

    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileName = `backup_database_${dateStr}.json`;
    const metadata = { name: fileName, parents: [dbFolderId], mimeType: "application/json" };
    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(exportedData) +
      closeDelimiter;

    const uploadRes = await fetch(`${GATEWAY_UPLOAD_URL}?uploadType=multipart`, {
      method: "POST",
      headers: getAuthHeaders(`multipart/related; boundary=${boundary}`),
      body: multipartBody,
    });

    const uploadResult = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadResult?.error?.message || "فشل رفع ملف النسخة الاحتياطية إلى Google Drive");
    }

    // إبقاء آخر 10 نسخ فقط وحذف الأقدم
    try {
      const u = new URL(`${GATEWAY_URL}/files`);
      u.searchParams.set("q", `'${dbFolderId}' in parents and trashed = false`);
      u.searchParams.set("orderBy", "createdTime desc");
      u.searchParams.set("pageSize", "200");
      u.searchParams.set("fields", "files(id)");
      const lr = await fetch(u.toString(), { headers: getAuthHeaders() });
      if (lr.ok) {
        const old = ((await lr.json()).files || []).slice(10);
        for (const f of old) {
          await fetch(`${GATEWAY_URL}/files/${f.id}`, { method: "DELETE", headers: getAuthHeaders() });
        }
      }
    } catch {}

    void recordAdminAudit({
      actorId: caller.userId,
      actorEmail: caller.phone || null,
      action: "drive_database_exported",
      targetTable: "backup",
      targetId: uploadResult.id,
      details: {
        fileName,
        totalTables: exportedData.summary.total_tables,
        totalRecords: totalRecordsCount,
      },
    });

    return {
      success: true,
      fileId: uploadResult.id,
      fileName,
      totalTables: exportedData.summary.total_tables,
      totalRecords: totalRecordsCount,
      timestamp: exportedData.exported_at,
    };
  });

// =====================================================================
// 2. استعراض كافة النسخ الاحتياطية المخزنة على Google Drive
// =====================================================================
export type DriveBackupItem = {
  id: string;
  name: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
};

export const listDriveBackupsAction = createServerFn({ method: "GET" })
  .handler(async (): Promise<DriveBackupItem[]> => {
    await requireAdminCaller();
    const mainFolderId = await getOrCreateFolder(ROOT_FOLDER);
    const dbFolderId = await getOrCreateFolder(DB_BACKUPS_FOLDER, mainFolderId);

    const url = new URL(`${GATEWAY_URL}/files`);
    url.searchParams.set("q", `'${dbFolderId}' in parents and trashed = false`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("orderBy", "createdTime desc");
    url.searchParams.set("fields", "files(id, name, size, createdTime, modifiedTime, webViewLink)");

    const res = await fetch(url.toString(), { headers: getAuthHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || "تعذر قراءة قائمة النسخ الاحتياطية من Google Drive");
    }

    const data = await res.json();
    const files: DriveBackupItem[] = (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      size: Number(f.size || 0),
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
    }));

    return files;
  });

// =====================================================================
// 3. استيراد واستعادة النسخة الكاملة من Google Drive إلى قاعدة البيانات
// =====================================================================
const restoreSchema = z.object({
  fileId: z.string().min(1, "معرف الملف مطلوب"),
  fileName: z.string().optional(),
});

export const restoreDriveBackupAction = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => restoreSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await requireAdminCaller();
    const supabase = getSupabaseServerClient();

    // 1. تنزيل محتوى ملف النسخة من Google Drive
    const downloadRes = await fetch(`${GATEWAY_URL}/files/${data.fileId}?alt=media`, {
      headers: getAuthHeaders(),
    });

    if (!downloadRes.ok) {
      const err = await downloadRes.text();
      throw new Error(`تعذر تنزيل النسخة الاحتياطية من Google Drive: ${err.slice(0, 150)}`);
    }

    const backupJson = await downloadRes.json();
    const tablesData = backupJson.tables || backupJson;

    if (!tablesData || typeof tablesData !== "object") {
      throw new Error("ملف النسخة الاحتياطية غير صالح أو لا يحتوي على جداول صالحة.");
    }

    const restoredSummary: Record<string, number> = {};
    let totalRestoredRecords = 0;

    // 2. استعادة الجداول بترتيب المفاتيح الأجنبية الآمن
    for (const table of IMPORT_ORDER) {
      const rows = tablesData[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const conflictCol = getConflictTarget(table);
      const batchSize = 150;
      let tableSuccess = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await (supabase.from(table as any) as any).upsert(batch, {
          onConflict: conflictCol,
          ignoreDuplicates: false,
        });

        if (error) {
          console.warn(`[RestoreDrive] Partial error on table ${table}:`, error.message);
        } else {
          tableSuccess += batch.length;
        }
      }

      restoredSummary[table] = tableSuccess;
      totalRestoredRecords += tableSuccess;
    }

    // 3. توثيق العملية في سجل التدقيق
    void recordAdminAudit({
      actorId: caller.userId,
      actorEmail: caller.phone || null,
      action: "drive_database_restored",
      targetTable: "backup",
      targetId: data.fileId,
      details: {
        fileName: data.fileName,
        restoredTablesCount: Object.keys(restoredSummary).length,
        totalRecordsRestored: totalRestoredRecords,
      },
    });

    return {
      success: true,
      fileName: data.fileName || "ملف غير مسمى",
      restoredTables: Object.keys(restoredSummary).length,
      totalRecordsRestored: totalRestoredRecords,
      summary: restoredSummary,
      timestamp: new Date().toISOString(),
    };
  });

// =====================================================================
// 4. حذف نسخة احتياطية من Google Drive
// =====================================================================
const deleteSchema = z.object({
  fileId: z.string().min(1, "معرف الملف مطلوب"),
});

export const deleteDriveBackupAction = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdminCaller();

    const deleteRes = await fetch(`${GATEWAY_URL}/files/${data.fileId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!deleteRes.ok && deleteRes.status !== 404) {
      const err = await deleteRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || "تعذر حذف الملف من Google Drive");
    }

    return { success: true };
  });

// =====================================================================
// 5. المزامنة الدورية (البيانات والصور مع دعم المجلدات الفرعية)
// =====================================================================
const syncInput = z.object({
  batchSize: z.number().int().min(1).max(2000).optional(),
  skipDb: z.boolean().optional(),
});

export async function runDriveSync(opts: { batchSize?: number | undefined; skipDb?: boolean | undefined } = {}) {
  const batchLimit = opts.batchSize ?? 100;
  const supabase = getSupabaseServerClient();
  const mainFolderId = await getOrCreateFolder(ROOT_FOLDER);
  const imagesFolderId = await getOrCreateFolder(IMAGES_FOLDER, mainFolderId);
  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  let dbName: string | null = null;
  if (!opts.skipDb) {
    const exportedData: Record<string, any> = {
      export_version: 2,
      created_at: new Date().toISOString(),
      tables: {},
    };
    for (const table of BACKUP_TABLES) {
      try {
        exportedData["tables"][table] = await fetchAllTableRows(supabase, table);
      } catch {
        exportedData["tables"][table] = [];
      }
    }
    dbName = `مزامنة_البيانات_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`;
    const metadata = { name: dbName, parents: [mainFolderId], mimeType: "application/json" };
    await fetch(`${GATEWAY_UPLOAD_URL}?uploadType=multipart`, {
      method: "POST",
      headers: getAuthHeaders(`multipart/related; boundary=${boundary}`),
      body:
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(exportedData) +
        closeDelimiter,
    });
  }

  const alreadyUploaded = await getUploadedImagesSet(imagesFolderId);
  const storageFiles = await listAllStorageFiles(supabase);
  const pending = storageFiles.filter((p) => !alreadyUploaded.has(p.replace(/\//g, "___")));
  const startedAt = Date.now();
  let newUploadsCount = 0;
  let failed = 0;

  const uploadOne = async (filePath: string) => {
    const sanitizedName = filePath.replace(/\//g, "___");
    const { data: blob } = await supabase.storage.from(BUCKET).download(filePath);
    if (!blob) {
      failed++;
      return;
    }
    const encoder = new TextEncoder();
    const headBytes = encoder.encode(
      delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify({ name: sanitizedName, parents: [imagesFolderId] }) +
        delimiter +
        `Content-Type: ${blob.type || "image/jpeg"}\r\n\r\n`,
    );
    const footBytes = encoder.encode(closeDelimiter);
    const img = new Uint8Array(await blob.arrayBuffer());
    const full = new Uint8Array(headBytes.length + img.length + footBytes.length);
    full.set(headBytes, 0);
    full.set(img, headBytes.length);
    full.set(footBytes, headBytes.length + img.length);
    const r = await fetch(`${GATEWAY_UPLOAD_URL}?uploadType=multipart`, {
      method: "POST",
      headers: getAuthHeaders(`multipart/related; boundary=${boundary}`),
      body: full,
    });
    if (r.ok) newUploadsCount++;
    else failed++;
  };

  // رفع 4 صور في الوقت نفسه لتسريع المزامنة
  const queue = pending.slice(0, batchLimit);
  let idx = 0;
  const worker = async () => {
    while (idx < queue.length && Date.now() - startedAt < 22000) {
      const p = queue[idx++]!;
      try {
        await uploadOne(p);
      } catch {
        failed++;
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  const result = {
    success: true,
    databaseFile: dbName,
    newUploadedImages: newUploadsCount,
    failedImages: failed,
    totalImages: storageFiles.length,
    remainingImages: Math.max(0, pending.length - newUploadsCount),
    timestamp: new Date().toISOString(),
  };
  await appendSyncLog({
    at: result.timestamp,
    uploaded: newUploadsCount,
    failed,
    remaining: result.remainingImages,
  });
  return result;
}

// =====================================================================
// سجل المزامنة (آخر 50 عملية)
// =====================================================================
const SYNC_LOG_KEY = "drive_sync_log";
export type SyncLogEntry = { at: string; uploaded: number; failed: number; remaining: number; error?: string };

export async function appendSyncLog(entry: SyncLogEntry) {
  try {
    const { data } = await supabaseAdmin.from("site_settings").select("id,value").eq("key", SYNC_LOG_KEY).maybeSingle();
    let list: SyncLogEntry[] = [];
    try {
      list = data?.value ? JSON.parse(String(data.value)) : [];
    } catch {}
    const value = JSON.stringify([entry, ...list].slice(0, 50));
    if (data?.id) await supabaseAdmin.from("site_settings").update({ value }).eq("id", data.id);
    else
      await (supabaseAdmin.from("site_settings") as any).insert({
        key: SYNC_LOG_KEY,
        value,
        group: "backup",
        description: "سجل مزامنة Google Drive",
      });
  } catch {}
}

export const getSyncLogAction = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminCaller();
  const { data } = await supabaseAdmin.from("site_settings").select("value").eq("key", SYNC_LOG_KEY).maybeSingle();
  try {
    return (data?.value ? JSON.parse(String(data.value)) : []) as SyncLogEntry[];
  } catch {
    return [] as SyncLogEntry[];
  }
});

export const syncStoreToDriveAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => syncInput.parse(d ?? {}))
  .handler(async ({ data }) => {
    await requireAdminCaller();
    return runDriveSync(data);
  });

// =====================================================================
// إعدادات المزامنة التلقائية
// =====================================================================
export const AUTO_SYNC_KEY = "drive_auto_sync";
export type AutoSyncSettings = {
  enabled: boolean;
  hours: number;
  batchSize: number;
  lastRun?: string | null;
};
const DEFAULT_AUTO: AutoSyncSettings = { enabled: false, hours: 24, batchSize: 200, lastRun: null };

export async function readAutoSync(): Promise<AutoSyncSettings> {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", AUTO_SYNC_KEY)
    .maybeSingle();
  try {
    return { ...DEFAULT_AUTO, ...(data?.value ? JSON.parse(String(data.value)) : {}) };
  } catch {
    return DEFAULT_AUTO;
  }
}

export async function writeAutoSync(s: AutoSyncSettings) {
  const value = JSON.stringify(s);
  const { data: ex } = await supabaseAdmin
    .from("site_settings")
    .select("id")
    .eq("key", AUTO_SYNC_KEY)
    .maybeSingle();
  if (ex?.id) {
    await supabaseAdmin.from("site_settings").update({ value }).eq("id", ex.id);
  } else {
    await (supabaseAdmin.from("site_settings") as any).insert({
      key: AUTO_SYNC_KEY,
      value,
      group: "backup",
      description: "إعدادات مزامنة Google Drive التلقائية",
    });
  }
}

export const getAutoSyncAction = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminCaller();
  return readAutoSync();
});

export const saveAutoSyncAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        hours: z.number().min(1).max(720),
        batchSize: z.number().int().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminCaller();
    const cur = await readAutoSync();
    const next = { ...cur, ...data };
    await writeAutoSync(next);
    return next;
  });

// =====================================================================
// حالة الحساب المربوط (الاسم، البريد، المساحة)
// =====================================================================
export type DriveAccountInfo = {
  connected: boolean;
  name?: string;
  email?: string;
  photo?: string;
  usedBytes?: number;
  limitBytes?: number;
  error?: string;
};

export const getDriveAccountAction = createServerFn({ method: "GET" }).handler(
  async (): Promise<DriveAccountInfo> => {
    await requireAdminCaller();
    try {
      const res = await fetch(`${GATEWAY_URL}/about?fields=user,storageQuota`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return { connected: false, error: `HTTP ${res.status}` };
      const d = await res.json();
      return {
        connected: true,
        name: d.user?.displayName,
        email: d.user?.emailAddress,
        photo: d.user?.photoLink,
        usedBytes: Number(d.storageQuota?.usage || 0),
        limitBytes: Number(d.storageQuota?.limit || 0),
      };
    } catch (e) {
      return { connected: false, error: e instanceof Error ? e.message : "خطأ" };
    }
  },
);

// =====================================================================
// استعادة الصور من Google Drive إلى مخزن المتجر (على دفعات)
// =====================================================================
export const restoreImagesFromDriveAction = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminCaller();
  const supabase = getSupabaseServerClient();
  const mainFolderId = await getOrCreateFolder(ROOT_FOLDER);
  const imagesFolderId = await getOrCreateFolder(IMAGES_FOLDER, mainFolderId);
  const existing = new Set(await listAllStorageFiles(supabase));

  const driveFiles: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  do {
    const u = new URL(`${GATEWAY_URL}/files`);
    u.searchParams.set("q", `'${imagesFolderId}' in parents and trashed = false`);
    u.searchParams.set("pageSize", "1000");
    u.searchParams.set("fields", "nextPageToken, files(id, name, mimeType)");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const r = await fetch(u.toString(), { headers: getAuthHeaders() });
    if (!r.ok) throw new Error(`تعذر قراءة مجلد الصور [${r.status}]`);
    const d = await r.json();
    driveFiles.push(...(d.files || []));
    pageToken = d.nextPageToken;
  } while (pageToken);

  const missing = driveFiles.filter((f) => !existing.has(f.name.replace(/___/g, "/")));
  const started = Date.now();
  let restored = 0;
  let failed = 0;
  let idx = 0;
  const worker = async () => {
    while (idx < missing.length && Date.now() - started < 22000) {
      const f = missing[idx++]!;
      try {
        const r = await fetch(`${GATEWAY_URL}/files/${f.id}?alt=media`, { headers: getAuthHeaders() });
        if (!r.ok) {
          failed++;
          continue;
        }
        const blob = await r.blob();
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(f.name.replace(/___/g, "/"), blob, { upsert: true, contentType: blob.type || "image/jpeg" });
        if (error) failed++;
        else restored++;
      } catch {
        failed++;
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { restored, failed, total: driveFiles.length, remaining: Math.max(0, missing.length - restored - failed) };
});

/** تنبيه واتساب لصاحب المتجر عند فشل المزامنة */
export async function alertSyncFailure(message: string) {
  try {
    const { sendWhatsappText } = await import("@/lib/notify.server");
    const { data } = await supabaseAdmin.from("store_settings").select("*").limit(1).maybeSingle();
    const phone = String((data as any)?.whatsapp || (data as any)?.phone || "").replace(/[^\d]/g, "");
    if (phone) await sendWhatsappText(`⚠️ فشلت مزامنة Google Drive التلقائية:\n${message.slice(0, 300)}`, phone);
  } catch {}
}
