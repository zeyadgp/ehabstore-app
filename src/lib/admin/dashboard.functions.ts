import { createServerFn } from "@tanstack/react-start";
import { requireAdminCaller } from "@/lib/caller.server";

export type TopProductItem = {
  id: string | null;
  name: string;
  sold: number;
  revenue: number;
};

export type DashboardStatsResult = {
  total_sales: number;
  orders_count: number;
  new_orders_today: number;
  non_cancelled_count: number;
  avg_order_value: number;
  low_stock_count: number;
  profit_available: boolean;
  top_products: TopProductItem[];
};

export const getDashboardStats = createServerFn({ method: "GET" })
  .inputValidator((input?: unknown) => {
    const p = (input ?? {}) as { days?: number };
    const days = Math.max(1, Math.min(365, Number(p.days || 30)));
    return { days };
  })
  .handler(async ({ data }): Promise<DashboardStatsResult> => {
    await requireAdminCaller();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      const { data: rpcData, error } = await supabaseAdmin.rpc("dashboard_stats" as any, {
        p_days: data.days,
      });

      if (!error && rpcData && typeof rpcData === "object") {
        return rpcData as DashboardStatsResult;
      }

      if (error) {
        console.warn("[Dashboard Stats] RPC invocation warning:", error.message);
      }
    } catch (rpcErr) {
      console.warn(
        "[Dashboard Stats] RPC not available, executing optimized query fallback:",
        rpcErr,
      );
    }

    // استعلام احتياطي سريع ومحسن في حال عدم توفر الدالة بقاعدة البيانات بعد
    const sinceDate = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const todayStr = new Date().toISOString().slice(0, 10);

    const [{ data: orders }, { count: lowStockCount }] = await Promise.all([
      supabaseAdmin.from("orders").select("total,status,created_at").gte("created_at", sinceDate),
      supabaseAdmin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("status", true)
        .lte("stock", 5),
    ]);

    const orderList = orders ?? [];
    const validOrders = orderList.filter(
      (o) => o.status !== "cancelled" && o.status !== "returned",
    );
    const totalSales = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const newToday = orderList.filter((o) => o.created_at.startsWith(todayStr)).length;
    const avgValue =
      validOrders.length > 0 ? Math.round((totalSales / validOrders.length) * 100) / 100 : 0;

    return {
      total_sales: totalSales,
      orders_count: orderList.length,
      new_orders_today: newToday,
      non_cancelled_count: validOrders.length,
      avg_order_value: avgValue,
      low_stock_count: lowStockCount ?? 0,
      profit_available: false,
      top_products: [],
    };
  });
