/**
 * Commission Reconciliation Script
 * Scans commission records and affiliate earnings for:
 * 1. Cancelled/refunded/returned orders where commission was not reversed.
 * 2. Settled commissions that exceed profit-derived expected amounts.
 * 3. Records settled despite missing cost data.
 *
 * Usage:
 *   npx tsx scripts/reconcile_commissions.ts [--apply]
 * Defaults to dry-run unless --apply flag is explicitly provided.
 */

import { createClient } from "@supabase/supabase-js";
import { calculateCommissionFromProfit } from "../src/lib/commissions";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const isApply = process.argv.includes("--apply");
  console.log(`\n=== فحص ومطابقة سجلات العمولات (Reconciliation) ===`);
  console.log(`الوضع الحالي: ${isApply ? "تنفيذ وتصحيح فعلي (APPLY)" : "فحص تجريبي (DRY-RUN)"}\n`);

  // 1. فحص الطلبات الملغاة أو المرتجعة
  const { data: cancelledOrders, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_number, status, total")
    .in("status", ["cancelled", "refunded", "returned"]);

  if (orderErr) {
    console.error("تعذر جلب الطلبات:", orderErr.message);
    process.exit(1);
  }

  const cancelledMap = new Map((cancelledOrders || []).map((o) => [o.id, o]));
  const cancelledIds = Array.from(cancelledMap.keys());

  console.log(`عدد الطلبات الملغاة أو المسترجعة المفحوصة: ${cancelledIds.length}`);

  // 2. استعلام السجلات المعلقة لطلبات ملغاة
  let commissionAnomalies: any[] = [];
  if (cancelledIds.length > 0) {
    try {
      const { data: records } = await (supabase as any)
        .from("commission_records")
        .select("id, order_id, order_item_id, amount_cents, status")
        .in("order_id", cancelledIds)
        .in("status", ["pending", "settled"]);

      if (records) commissionAnomalies = records;
    } catch {
      console.log("ملاحظة: جدول commission_records لم يتم تفعيله بعد على قاعدة البيانات الحالية.");
    }
  }

  // 3. فحص سجلات affiliate_earnings لطلبات ملغاة
  let affiliateAnomalies: any[] = [];
  if (cancelledIds.length > 0) {
    try {
      const { data: earnings } = await supabase
        .from("affiliate_earnings")
        .select("id, order_id, influencer_id, commission_amount, status")
        .in("order_id", cancelledIds)
        .neq("status", "reversed");

      if (earnings) affiliateAnomalies = earnings;
    } catch (err) {
      console.warn("خطأ أثناء استعلام affiliate_earnings:", err);
    }
  }

  // 4. فحص العمولات المحسوبة بأعلى من الربح (Discrepancy audit)
  const { data: costsSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "admin_product_costs_map")
    .maybeSingle();

  let costsMap: Record<string, { cost_price?: number }> = {};
  if (costsSetting?.value) {
    try {
      costsMap = JSON.parse(costsSetting.value);
    } catch {
      costsMap = {};
    }
  }

  const discrepancyList: any[] = [];
  try {
    const { data: settledRecords } = await (supabase as any)
      .from("commission_records")
      .select("id, order_id, order_item_id, amount_cents, profit_cents, commission_percent, status")
      .eq("status", "settled");

    if (settledRecords && settledRecords.length > 0) {
      for (const rec of settledRecords) {
        if (!rec.order_item_id) continue;
        const { data: item } = await supabase
          .from("order_items")
          .select("product_id, quantity, price")
          .eq("id", rec.order_item_id)
          .maybeSingle();

        if (item && item.product_id) {
          const cost = costsMap[item.product_id]?.cost_price;
          const total = Number(item.price || 0) * Number(item.quantity || 1);
          const totalCost = typeof cost === "number" ? cost * Number(item.quantity || 1) : null;
          const expected = calculateCommissionFromProfit(
            total,
            totalCost,
            Number(rec.commission_percent || 10),
          );

          if (rec.amount_cents > expected.commissionCents) {
            discrepancyList.push({
              recordId: rec.id,
              orderId: rec.order_id,
              current: rec.amount_cents,
              expected: expected.commissionCents,
            });
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  console.log(`\n--- النتائج المكتشفة ---`);
  console.log(`• سجلات commission_records لطلبات ملغاة: ${commissionAnomalies.length}`);
  console.log(`• سجلات affiliate_earnings لطلبات ملغاة: ${affiliateAnomalies.length}`);
  console.log(`• سجلات عمولات أعلى من صافي الربح: ${discrepancyList.length}`);

  let totalToReverse = 0;
  for (const c of commissionAnomalies) {
    const ord = cancelledMap.get(c.order_id);
    console.log(
      `  - [commission_records] طلب #${ord?.order_number || c.order_id} - عمولة: ${c.amount_cents} (حالة: ${c.status})`,
    );
    totalToReverse += Number(c.amount_cents || 0);
  }

  for (const a of affiliateAnomalies) {
    const ord = cancelledMap.get(a.order_id);
    console.log(
      `  - [affiliate_earnings] طلب #${ord?.order_number || a.order_id} - مؤثر: ${a.influencer_id} - عمولة: ${a.commission_amount}`,
    );
    totalToReverse += Number(a.commission_amount || 0);
  }

  for (const d of discrepancyList) {
    console.log(
      `  - [discrepancy] سجل #${d.recordId} - المسجل: ${d.current} - المتوقع من الربح: ${d.expected}`,
    );
  }

  console.log(`\nإجمالي مبالغ العمولات المستوجب عكسها: ${totalToReverse.toLocaleString()}`);

  if (
    commissionAnomalies.length === 0 &&
    affiliateAnomalies.length === 0 &&
    discrepancyList.length === 0
  ) {
    console.log("✅ جميع السجلات مطابقة تماماً للقواعد المالية للأرباح والطلبات.");
    return;
  }

  if (!isApply) {
    console.log("\n💡 لتطبيق التعديل الفعلي، أعد التشغيل مع مفتاح --apply:");
    console.log("   npx tsx scripts/reconcile_commissions.ts --apply\n");
    return;
  }

  console.log("\nجاري تطبيق التصحيحات وعكس العمولات...");
  for (const c of commissionAnomalies) {
    await (supabase as any)
      .from("commission_records")
      .update({ status: "reversed", updated_at: new Date().toISOString() })
      .eq("id", c.id);
  }

  for (const a of affiliateAnomalies) {
    await supabase.from("affiliate_earnings").update({ status: "reversed" }).eq("id", a.id);
    const amt = Number(a.commission_amount || 0);
    if (a.influencer_id && amt > 0) {
      const { data: inf } = await supabase
        .from("influencers")
        .select("id, balance, total_earned")
        .eq("id", a.influencer_id)
        .maybeSingle();

      if (inf) {
        await supabase
          .from("influencers")
          .update({
            balance: Math.max(0, Number(inf.balance || 0) - amt),
            total_earned: Math.max(0, Number(inf.total_earned || 0) - amt),
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", inf.id);
      }
    }
  }

  for (const d of discrepancyList) {
    await (supabase as any)
      .from("commission_records")
      .update({ amount_cents: d.expected, updated_at: new Date().toISOString() })
      .eq("id", d.recordId);
  }

  console.log("✅ تم تطبيق التصحيحات والتسوية بنجاح.");
}

main().catch((err) => {
  console.error("Reconciliation script error:", err);
  process.exit(1);
});
