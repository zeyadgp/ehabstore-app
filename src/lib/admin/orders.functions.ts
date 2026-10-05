import { createServerFn } from "@tanstack/react-start";
import { requireAdminCaller } from "@/lib/caller.server";
import {
  getPageRange,
  getTotalPages,
  normalizePage,
  normalizePageSize,
} from "@/lib/admin/pagination";
import type { PaginatedResult } from "@/lib/admin/types";

export type AdminOrderRow = {
  id: string;
  order_number: number;
  customer_name: string;
  phone: string;
  city: string | null;
  status: string;
  payment_status: string;
  total: number;
  currency_label: string;
  created_at: string;
};

const ALLOWED_SORT_KEYS = ["created_at", "total", "order_number"] as const;
type AllowedSortKey = (typeof ALLOWED_SORT_KEYS)[number];

export const fetchAdminOrdersPage = createServerFn({ method: "GET" })
  .inputValidator((q: unknown) => {
    const p = (q ?? {}) as {
      page?: number;
      perPage?: number;
      search?: string;
      status?: string;
      paymentStatus?: string;
      dateFilter?: string;
      sortKey?: string;
      sortDirection?: string;
    };

    const page = normalizePage(p.page);
    const perPage = normalizePageSize(p.perPage);
    const search = String(p.search ?? "")
      .replace(/[,()*%\\:."]/g, " ")
      .trim()
      .slice(0, 100);
    const status = String(p.status ?? "all")
      .trim()
      .slice(0, 50);
    const paymentStatus = String(p.paymentStatus ?? "all")
      .trim()
      .slice(0, 50);
    const dateFilter = String(p.dateFilter ?? "all")
      .trim()
      .slice(0, 20);

    const sortKey: AllowedSortKey = ALLOWED_SORT_KEYS.includes(p.sortKey as AllowedSortKey)
      ? (p.sortKey as AllowedSortKey)
      : "created_at";

    const sortDirection: "asc" | "desc" = p.sortDirection === "asc" ? "asc" : "desc";

    return {
      page,
      perPage,
      search,
      status,
      paymentStatus,
      dateFilter,
      sortKey,
      sortDirection,
    };
  })
  .handler(async ({ data }): Promise<PaginatedResult<AdminOrderRow>> => {
    await requireAdminCaller();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { from, to } = getPageRange(data.page, data.perPage);

    // الأعمدة المحددة للجدول الإداري فقط تجنباً للـ select(*)
    let q = supabaseAdmin
      .from("orders")
      .select(
        "id,order_number,customer_name,phone,city,status,payment_status,total,currency_label,created_at",
        { count: "exact" },
      )
      .order(data.sortKey, { ascending: data.sortDirection === "asc" })
      .range(from, to);

    // تطبيق الفلاتر
    if (data.status && data.status !== "all") {
      q = q.eq("status", data.status as any);
    }

    if (data.paymentStatus && data.paymentStatus !== "all") {
      q = q.eq("payment_status", data.paymentStatus as any);
    }

    // فلتر التاريخ
    if (data.dateFilter === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      q = q.gte("created_at", today.toISOString());
    } else if (data.dateFilter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      q = q.gte("created_at", weekAgo.toISOString());
    } else if (data.dateFilter === "month") {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      q = q.gte("created_at", monthAgo.toISOString());
    }

    // البحث: يدعم رقم الطلب (إذا كان رقماً) أو اسم العميل أو رقم الهاتف
    if (data.search) {
      const searchNum = parseInt(data.search, 10);
      if (!isNaN(searchNum) && String(searchNum) === data.search) {
        q = q.or(
          `order_number.eq.${searchNum},customer_name.ilike.%${data.search}%,phone.ilike.%${data.search}%`,
        );
      } else {
        q = q.or(`customer_name.ilike.%${data.search}%,phone.ilike.%${data.search}%`);
      }
    }

    const { data: rows, error, count } = await q;

    if (error) {
      console.error("[fetchAdminOrdersPage] Supabase error:", error.message);
      throw new Error("تعذر جلب الطلبات من الخادم.");
    }

    const total = Number(count ?? 0);
    const totalPages = getTotalPages(total, data.perPage);

    return {
      rows: (rows as AdminOrderRow[]) ?? [],
      total,
      page: data.page,
      perPage: data.perPage,
      totalPages,
    };
  });
