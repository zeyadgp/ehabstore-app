import { createServerFn } from "@tanstack/react-start";
import { requireAdminCaller } from "@/lib/caller.server";
import {
  getPageRange,
  getTotalPages,
  normalizePage,
  normalizePageSize,
} from "@/lib/admin/pagination";
import type { PaginatedResult } from "@/lib/admin/types";

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  details: any;
  ip: string | null;
  created_at: string;
};

export const ACTION_LABELS: Record<string, string> = {
  order_status_changed: "تعديل حالة طلب",
  order_deleted: "حذف طلب",
  product_created: "إضافة منتج جديد",
  product_updated: "تعديل بيانات منتج",
  product_deleted: "حذف منتج",
  inventory_updated: "تعديل مخزون المنتجات",
  settings_updated: "تحديث إعدادات المتجر",
  secrets_status_viewed: "فحص حالة المتغيرات البيئية",
  loyalty_points_adjusted: "تعديل نقاط ولاء العميل",
  coupon_created: "إنشاء قسيمة تخفيض",
  coupon_deleted: "حذف قسيمة تخفيض",
};

export const fetchAdminAuditLogs = createServerFn({ method: "GET" })
  .inputValidator((input?: unknown) => {
    const p = (input ?? {}) as {
      page?: number;
      perPage?: number;
      action?: string;
      search?: string;
      days?: number;
    };

    const page = normalizePage(p.page);
    const perPage = normalizePageSize(p.perPage);
    const action = String(p.action ?? "all").trim();
    const search = String(p.search ?? "")
      .trim()
      .slice(0, 100);
    const days = Math.max(1, Math.min(365, Number(p.days || 30)));

    return { page, perPage, action, search, days };
  })
  .handler(async ({ data }): Promise<PaginatedResult<AuditLogRow>> => {
    await requireAdminCaller();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { from, to } = getPageRange(data.page, data.perPage);
    const sinceDate = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();

    let q = supabaseAdmin
      .from("admin_audit_log" as any)
      .select("id,actor_id,actor_email,action,target_table,target_id,details,ip,created_at", {
        count: "exact",
      })
      .gte("created_at", sinceDate)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.action && data.action !== "all") {
      q = q.eq("action", data.action);
    }

    if (data.search) {
      q = q.or(
        `action.ilike.%${data.search}%,actor_email.ilike.%${data.search}%,target_id.ilike.%${data.search}%`,
      );
    }

    const { data: rows, error, count } = await q;

    if (error) {
      console.warn("[fetchAdminAuditLogs] Query warning:", error.message);
      return {
        rows: [],
        total: 0,
        page: data.page,
        perPage: data.perPage,
        totalPages: 1,
      };
    }

    const total = Number(count ?? 0);
    const totalPages = getTotalPages(total, data.perPage);

    return {
      rows: (rows as unknown as AuditLogRow[]) ?? [],
      total,
      page: data.page,
      perPage: data.perPage,
      totalPages,
    };
  });
