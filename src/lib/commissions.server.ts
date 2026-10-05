import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateCommissionFromProfit } from "./commissions";
import { recordAdminAudit } from "./admin/audit.server";

type AdminClient = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

export type OrderCommissionStatusResult = {
  ok: boolean;
  status: "settled" | "reversed" | "noop" | "no_cost_data" | "not_found";
  amountCents?: number;
  reversedAmountCents?: number;
  settledItemsCount?: number;
  message?: string;
};

/**
 * تسوية العمولات لطلب مكتمل/مسلّم بشكل ذري (Atomic Settlement)
 * يدعم الاستدعاء عبر RPC في Postgres مع fallback آمن يربط السجلات بكل صنف (order_items)
 */
export async function settleOrderCommissions(
  db: AdminClient | SupabaseClient,
  orderId: string,
  commissionPercent = 10,
): Promise<OrderCommissionStatusResult> {
  const client = db as any;

  // 1. محاولة التنفيذ عبر RPC في قاعدة البيانات للضمان الذري مع Row-level lock
  try {
    const { data: rpcRes, error: rpcErr } = await client.rpc("settle_commissions_for_order", {
      order_uuid: orderId,
      commission_percent: commissionPercent,
    });

    if (!rpcErr && rpcRes && rpcRes.status === "ok") {
      void recordAdminAudit({
        action: "commission_settled",
        targetTable: "commission_records",
        targetId: orderId,
        details: {
          method: "rpc",
          settledCount: rpcRes.settled_count,
          totalCommission: rpcRes.total_commission,
        },
      });

      return {
        ok: true,
        status: "settled",
        amountCents: Number(rpcRes.total_commission || 0),
        settledItemsCount: Number(rpcRes.settled_count || 0),
        message: "تم تسوية العمولات ذرياً عبر الخادم",
      };
    }
  } catch (rpcCatch) {
    console.warn("RPC settle_commissions_for_order not available, using safe fallback:", rpcCatch);
  }

  // 2. Fallback الآمن: قراءة بنود الطلب وحساب العمولة لكل صنف على حدة
  const { data: order } = await client
    .from("orders")
    .select("id, order_number, total, subtotal, currency, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return { ok: false, status: "not_found", message: "الطلب غير موجود" };
  }

  // جلب خريطة تكاليف المنتجات
  let costsMap: Record<string, { cost_price?: number }> = {};
  try {
    const { data: costsSetting } = await client
      .from("site_settings")
      .select("value")
      .eq("key", "admin_product_costs_map")
      .maybeSingle();

    if (costsSetting?.value) {
      costsMap = JSON.parse(costsSetting.value);
    }
  } catch {
    costsMap = {};
  }

  // جلب أصناف الطلب
  const { data: items } = await client
    .from("order_items")
    .select("id, product_id, quantity, price")
    .eq("order_id", orderId);

  let totalSettled = 0;
  let settledCount = 0;

  if (items && items.length > 0) {
    for (const item of items) {
      const unitCost = item.product_id ? costsMap[item.product_id]?.cost_price : undefined;
      const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);
      const totalItemCost =
        typeof unitCost === "number" ? unitCost * Number(item.quantity || 1) : null;

      const { commissionCents, profitCents, reason } = calculateCommissionFromProfit(
        itemTotal,
        totalItemCost,
        commissionPercent,
      );

      // فحص هل السجل موجود مسبقاً لتفادي الازدواجية (Idempotency)
      const { data: existing } = await client
        .from("commission_records")
        .select("id, status")
        .eq("order_item_id", item.id)
        .maybeSingle();

      if (existing) {
        if (existing.status !== "settled" && reason === "ok" && commissionCents > 0) {
          await client
            .from("commission_records")
            .update({
              amount_cents: commissionCents,
              profit_cents: profitCents,
              commission_percent: commissionPercent,
              status: "settled",
              reason: "ok",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          totalSettled += commissionCents;
          settledCount += 1;
        }
      } else {
        await client.from("commission_records").insert({
          order_id: orderId,
          order_item_id: item.id,
          amount_cents: commissionCents,
          profit_cents: profitCents,
          commission_percent: commissionPercent,
          status: reason === "ok" && commissionCents > 0 ? "settled" : "pending",
          reason: reason ?? "pending",
        });
        if (reason === "ok" && commissionCents > 0) {
          totalSettled += commissionCents;
          settledCount += 1;
        }
      }
    }
  }

  void recordAdminAudit({
    action: "commission_settled",
    targetTable: "commission_records",
    targetId: orderId,
    details: { totalSettled, settledCount, orderNumber: order.order_number },
  });

  return {
    ok: true,
    status: totalSettled > 0 ? "settled" : "no_cost_data",
    amountCents: totalSettled,
    settledItemsCount: settledCount,
    message: "تم تسوية العمولات على مستوى الأصناف",
  };
}

/**
 * عكس العمولات عند إلغاء الطلب كلياً أو جزئياً (Partial Return / Full Cancellation)
 * يتميز بكونه idempotent: لا يعكس السجلات المعكوسة سابقاً، ويحدث أرصدة المؤثرين ذرياً
 */
export async function reverseOrderCommissions(
  db: AdminClient | SupabaseClient,
  orderId: string,
  targetItemId?: string | null,
): Promise<OrderCommissionStatusResult> {
  const client = db as any;

  // 1. محاولة التنفيذ عبر RPC في قاعدة البيانات للضمان الذري
  try {
    const { data: rpcRes, error: rpcErr } = await client.rpc("reverse_commissions_for_order", {
      order_uuid: orderId,
      target_item_uuid: targetItemId ?? null,
    });

    if (!rpcErr && rpcRes && rpcRes.status === "ok") {
      void recordAdminAudit({
        action: targetItemId ? "commission_item_reversed" : "commission_reversed",
        targetTable: "commission_records",
        targetId: orderId,
        details: {
          method: "rpc",
          reversedCount: rpcRes.reversed_count,
          reversedAmount: rpcRes.reversed_amount,
          targetItemId: targetItemId ?? null,
        },
      });

      return {
        ok: true,
        status: "reversed",
        reversedAmountCents: Number(rpcRes.reversed_amount || 0),
        message: "تم عكس العمولات ذرياً عبر الخادم",
      };
    }
  } catch (rpcCatch) {
    console.warn("RPC reverse_commissions_for_order not available, using safe fallback:", rpcCatch);
  }

  // 2. Fallback الآمن في الخادم
  let query = client
    .from("commission_records")
    .select("id, order_item_id, amount_cents, status")
    .eq("order_id", orderId)
    .in("status", ["pending", "settled"]);

  if (targetItemId) {
    query = query.eq("order_item_id", targetItemId);
  }

  const { data: records } = await query;
  let reversedTotal = 0;

  if (records && records.length > 0) {
    for (const rec of records) {
      if (rec.status === "reversed") continue; // Idempotency check

      reversedTotal += Number(rec.amount_cents || 0);
      await client
        .from("commission_records")
        .update({
          status: "reversed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", rec.id);
    }
  }

  // عكس سجلات affiliate_earnings وخصم الرصيد ذرياً إذا كان إلغاء كلي
  if (!targetItemId) {
    const { data: earnings } = await client
      .from("affiliate_earnings")
      .select("id, influencer_id, commission_amount, status")
      .eq("order_id", orderId)
      .neq("status", "reversed");

    if (earnings && earnings.length > 0) {
      for (const earn of earnings) {
        if (earn.status === "reversed") continue;

        const amt = Number(earn.commission_amount || 0);
        await client.from("affiliate_earnings").update({ status: "reversed" }).eq("id", earn.id);

        if (earn.influencer_id && amt > 0) {
          const { data: inf } = await client
            .from("influencers")
            .select("id, balance, total_earned")
            .eq("id", earn.influencer_id)
            .maybeSingle();

          if (inf) {
            await client
              .from("influencers")
              .update({
                balance: Math.max(0, Number(inf.balance || 0) - amt),
                total_earned: Math.max(0, Number(inf.total_earned || 0) - amt),
                updated_at: new Date().toISOString(),
              })
              .eq("id", inf.id);
          }
        }
      }
    }
  }

  void recordAdminAudit({
    action: targetItemId ? "commission_item_reversed" : "commission_reversed",
    targetTable: "commission_records",
    targetId: orderId,
    details: { reversedTotal, targetItemId: targetItemId ?? null },
  });

  return {
    ok: true,
    status: "reversed",
    reversedAmountCents: reversedTotal,
    message: "تم عكس العمولات بنجاح",
  };
}

/**
 * الموجه الرئيسي لمزامنة عمولة الطلب حسب الحالة الجديدة
 */
export async function syncOrderCommissionStatus(
  db: AdminClient | SupabaseClient,
  orderId: string,
  newStatus: string,
): Promise<OrderCommissionStatusResult> {
  const normalized = (newStatus || "").trim().toLowerCase();

  if (["completed", "delivered"].includes(normalized)) {
    return await settleOrderCommissions(db, orderId);
  }

  if (["cancelled", "refunded", "returned"].includes(normalized)) {
    return await reverseOrderCommissions(db, orderId);
  }

  return { ok: true, status: "noop" };
}
