import { createServerFn } from "@tanstack/react-start";
import { requireAdminCaller } from "@/lib/caller.server";
import {
  getPageRange,
  getTotalPages,
  normalizePage,
  normalizePageSize,
} from "@/lib/admin/pagination";
import type { PaginatedResult } from "@/lib/admin/types";

export type AdminProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  price: number;
  discount_price: number | null;
  stock: number;
  status: boolean;
  images: string[];
  created_at: string;
};

const ALLOWED_SORT_KEYS = ["created_at", "price", "stock", "name"] as const;
type AllowedSortKey = (typeof ALLOWED_SORT_KEYS)[number];

export const fetchAdminProductsPage = createServerFn({ method: "GET" })
  .inputValidator((q: unknown) => {
    const p = (q ?? {}) as {
      page?: number;
      perPage?: number;
      search?: string;
      categoryId?: string;
      status?: string;
      sortKey?: string;
      sortDirection?: string;
    };

    const page = normalizePage(p.page);
    const perPage = normalizePageSize(p.perPage);
    const search = String(p.search ?? "")
      .replace(/[,()*%\\:."]/g, " ")
      .trim()
      .slice(0, 100);
    const categoryId = String(p.categoryId ?? "").trim();
    const status = String(p.status ?? "all").trim();

    const sortKey: AllowedSortKey = ALLOWED_SORT_KEYS.includes(p.sortKey as AllowedSortKey)
      ? (p.sortKey as AllowedSortKey)
      : "created_at";

    const sortDirection: "asc" | "desc" = p.sortDirection === "asc" ? "asc" : "desc";

    return {
      page,
      perPage,
      search,
      categoryId,
      status,
      sortKey,
      sortDirection,
    };
  })
  .handler(async ({ data }): Promise<PaginatedResult<AdminProductRow>> => {
    await requireAdminCaller();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { from, to } = getPageRange(data.page, data.perPage);

    // اختيار الحقول المحددة فقط للجدول الإداري دون جلب الأوصاف الضخمة
    let q = supabaseAdmin
      .from("products")
      .select("id,name,slug,sku,price,discount_price,stock,status,images,created_at", {
        count: "exact",
      })
      .order(data.sortKey, { ascending: data.sortDirection === "asc" })
      .range(from, to);

    if (data.status === "active") {
      q = q.eq("status", true);
    } else if (data.status === "inactive") {
      q = q.eq("status", false);
    }

    if (data.categoryId) {
      q = q.eq("category_id", data.categoryId);
    }

    if (data.search) {
      q = q.or(
        `name.ilike.%${data.search}%,sku.ilike.%${data.search}%,slug.ilike.%${data.search}%`,
      );
    }

    const { data: rows, error, count } = await q;

    if (error) {
      console.error("[fetchAdminProductsPage] Supabase error:", error.message);
      throw new Error("تعذر جلب المنتجات من الخادم.");
    }

    const total = Number(count ?? 0);
    const totalPages = getTotalPages(total, data.perPage);

    return {
      rows: (rows as AdminProductRow[]) ?? [],
      total,
      page: data.page,
      perPage: data.perPage,
      totalPages,
    };
  });
