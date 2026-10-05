import { createServerFn } from "@tanstack/react-start";
import { requireAdminCaller } from "@/lib/caller.server";
import {
  getPageRange,
  getTotalPages,
  normalizePage,
  normalizePageSize,
} from "@/lib/admin/pagination";
import type { PaginatedResult } from "@/lib/admin/types";

export type AdminCustomerRow = {
  id: string;
  name: string;
  phone: string;
  city: string;
  orders_count: number;
  total_spent: number;
  last_order_at: string;
};

export const fetchAdminCustomersPage = createServerFn({ method: "GET" })
  .inputValidator((q: unknown) => {
    const p = (q ?? {}) as {
      page?: number;
      perPage?: number;
      search?: string;
    };

    const page = normalizePage(p.page);
    const perPage = normalizePageSize(p.perPage);
    const search = String(p.search ?? "")
      .trim()
      .slice(0, 100);

    return { page, perPage, search };
  })
  .handler(async ({ data }): Promise<PaginatedResult<AdminCustomerRow>> => {
    await requireAdminCaller();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // جلب أحدث الطلبات لاستخراج وحساب بيانات العملاء التراكمية
    let q = supabaseAdmin
      .from("orders")
      .select("id,customer_name,phone,city,total,created_at")
      .order("created_at", { ascending: false });

    if (data.search) {
      q = q.or(
        `customer_name.ilike.%${data.search}%,phone.ilike.%${data.search}%,city.ilike.%${data.search}%`,
      );
    }

    const { data: orders, error } = await q;

    if (error) {
      console.error("[fetchAdminCustomersPage] Error:", error.message);
      throw new Error("تعذر جلب بيانات العملاء.");
    }

    const customerMap = new Map<string, AdminCustomerRow>();
    for (const o of orders ?? []) {
      const key = o.phone || o.id;
      const existing = customerMap.get(key);
      if (existing) {
        existing.orders_count += 1;
        existing.total_spent += Number(o.total || 0);
        if (new Date(o.created_at) > new Date(existing.last_order_at)) {
          existing.last_order_at = o.created_at;
        }
      } else {
        customerMap.set(key, {
          id: o.id,
          name: o.customer_name || "عميل بدون اسم",
          phone: o.phone || "—",
          city: o.city || "—",
          orders_count: 1,
          total_spent: Number(o.total || 0),
          last_order_at: o.created_at,
        });
      }
    }

    const allRows = Array.from(customerMap.values()).sort((a, b) => b.total_spent - a.total_spent);
    const total = allRows.length;
    const totalPages = getTotalPages(total, data.perPage);
    const { from, to } = getPageRange(data.page, data.perPage);
    const rows = allRows.slice(from, to + 1);

    return {
      rows,
      total,
      page: data.page,
      perPage: data.perPage,
      totalPages,
    };
  });
