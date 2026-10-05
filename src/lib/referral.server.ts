import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeYemeniPhone } from "./yemen";

type AdminClient = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

/**
 * منح مكافأة التسجيل الترحيبية عند قيام زائر بالتسجيل عبر كود إحالة
 */
export async function rewardSignupReferral(
  db: AdminClient,
  newUser: { id: string; phone?: string | null; fullName?: string | null },
  referralCode: string,
) {
  try {
    const cleanCode = referralCode.trim().toUpperCase();
    if (!cleanCode) return { rewarded: false, reason: "no_code" };

    // البحث عن صاحب كود الإحالة (الداعي)
    const { data: referrerProfile } = await db
      .from("profiles")
      .select("id, phone, full_name, referral_code")
      .eq("referral_code", cleanCode)
      .maybeSingle();

    if (!referrerProfile || referrerProfile.id === newUser.id) {
      return { rewarded: false, reason: "invalid_referrer" };
    }

    // قراءة إعدادات نظام الإحالة والولاء
    const { data: settings } = await db
      .from("loyalty_settings")
      .select("referral_enabled, referral_referrer_points, referral_invitee_points")
      .limit(1)
      .maybeSingle();

    if (settings?.referral_enabled === false) {
      return { rewarded: false, reason: "referrals_disabled" };
    }

    const inviteePoints = Number(settings?.referral_invitee_points ?? 25);
    const referrerPoints = Number(settings?.referral_referrer_points ?? 50);

    // 1. منح العميل الجديد نقاط الترحيب
    if (newUser.phone && inviteePoints > 0) {
      const inviteePhone = normalizeYemeniPhone(newUser.phone);
      const { data: inviteeAcc } = await db
        .from("loyalty_accounts")
        .select("id, points")
        .eq("phone", inviteePhone)
        .maybeSingle();

      let targetAccId = inviteeAcc?.id;
      if (!targetAccId) {
        const { data: created } = await db
          .from("loyalty_accounts")
          .insert({
            phone: inviteePhone,
            customer_name: newUser.fullName ?? null,
            points: inviteePoints,
          })
          .select("id")
          .maybeSingle();
        targetAccId = created?.id;
      } else {
        await db
          .from("loyalty_accounts")
          .update({ points: Number(inviteeAcc?.points ?? 0) + inviteePoints })
          .eq("id", targetAccId);
      }

      if (targetAccId) {
        await db.from("loyalty_transactions").insert({
          account_id: targetAccId,
          type: "earn",
          points: inviteePoints,
          description: `هدية ترحيبية للتسجيل عبر دعوة الصديق (${referrerProfile.full_name || cleanCode})`,
        });
      }
    }

    // 2. تحديث بروفايل العميل الجديد لتثبيت المحيل
    await db
      .from("profiles")
      .update({ referred_by: cleanCode } as never)
      .eq("id", newUser.id);

    return { rewarded: true, inviteePoints, referrerPoints };
  } catch (err) {
    console.error("rewardSignupReferral failed:", err);
    return { rewarded: false, error: String(err) };
  }
}

/**
 * احتساب وتوزيع مكافآت الإحالة عند اكتمال أو تسليم طلب
 */
export async function processOrderReferralCommission(
  db: AdminClient,
  order: {
    id: string;
    order_number: number | null;
    phone: string;
    total: number;
    subtotal?: number;
    currency?: string;
  },
) {
  try {
    const customerPhone = normalizeYemeniPhone(order.phone);

    // التحقق من حساب العميل هل هو مُحال من شخص آخر؟
    const { data: customerProfile } = await db
      .from("profiles")
      .select("id, referred_by")
      .eq("phone", customerPhone)
      .maybeSingle();

    const referralCode = customerProfile?.referred_by;
    if (!referralCode) return { processed: false, reason: "not_referred" };

    // قراءة إعدادات الإحالة
    const { data: settings } = await db
      .from("loyalty_settings")
      .select("referral_enabled, referral_referrer_points, referral_commission_percent, is_active")
      .limit(1)
      .maybeSingle();

    if (settings?.referral_enabled === false) return { processed: false, reason: "disabled" };

    // جلب الداعي
    const { data: referrer } = await db
      .from("profiles")
      .select("id, phone, full_name")
      .eq("referral_code", referralCode)
      .maybeSingle();

    if (!referrer || !referrer.phone) return { processed: false, reason: "referrer_not_found" };

    // التحقق هل هذا هو أول طلب للعميل المكتمل
    const { count: previousOrdersCount } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("phone", order.phone)
      .in("status", ["completed", "delivered"])
      .neq("id", order.id);

    const isFirstOrder = (previousOrdersCount ?? 0) === 0;

    let pointsToAdd = 0;
    const notes: string[] = [];

    // مكافأة أول طلب للداعي
    const baseReferrerBonus = Number(settings?.referral_referrer_points ?? 50);
    if (isFirstOrder && baseReferrerBonus > 0) {
      pointsToAdd += baseReferrerBonus;
      notes.push(`مكافأة أول طلب للمدعو (+${baseReferrerBonus} نقطة)`);
    }

    // نسبة عمولة الإحالة من أرباح مشتريات المدعو
    const commissionPercent = Number(settings?.referral_commission_percent ?? 5);
    if (commissionPercent > 0) {
      const orderAmount = Number(order.subtotal ?? order.total ?? 0);

      // استعلام تكلفة أصناف الطلب لحساب الربح المحقق
      let orderCostCents: number | null = null;
      try {
        const { data: costsSetting } = await db
          .from("site_settings")
          .select("value")
          .eq("key", "admin_product_costs_map")
          .maybeSingle();

        if (costsSetting?.value) {
          const costsMap = JSON.parse(costsSetting.value) as Record<
            string,
            { cost_price?: number }
          >;
          const { data: items } = await db
            .from("order_items")
            .select("product_id, quantity")
            .eq("order_id", order.id);

          if (items && items.length > 0) {
            let sumCost = 0;
            let allValid = true;
            for (const item of items) {
              if (!item.product_id) {
                allValid = false;
                break;
              }
              const c = costsMap[item.product_id]?.cost_price;
              if (typeof c !== "number" || c < 0) {
                allValid = false;
                break;
              }
              sumCost += c * (Number(item.quantity) || 1);
            }
            if (allValid) orderCostCents = sumCost;
          }
        }
      } catch {
        orderCostCents = null;
      }

      const { calculateCommissionFromProfit } = await import("@/lib/commissions");
      const { commissionCents: commissionPoints, reason } = calculateCommissionFromProfit(
        orderAmount,
        orderCostCents,
        commissionPercent,
      );

      if (reason === "no_cost_data") {
        console.warn(
          `Referral commission skipped for order #${order.order_number}: no cost data available`,
        );
      } else if (commissionPoints > 0) {
        pointsToAdd += commissionPoints;
        notes.push(
          `عمولة أرباح ${commissionPercent}% من طلب الصديق #${order.order_number || ""} (+${commissionPoints} نقطة)`,
        );
      }
    }

    if (pointsToAdd <= 0) return { processed: false, points: 0 };

    // إضافة النقاط لحساب ولاء الداعي
    const referrerPhone = normalizeYemeniPhone(referrer.phone);
    const { data: referrerAcc } = await db
      .from("loyalty_accounts")
      .select("id, points")
      .eq("phone", referrerPhone)
      .maybeSingle();

    let targetAccId = referrerAcc?.id;
    if (!targetAccId) {
      const { data: created } = await db
        .from("loyalty_accounts")
        .insert({
          phone: referrerPhone,
          customer_name: referrer.full_name ?? null,
          points: pointsToAdd,
        })
        .select("id")
        .maybeSingle();
      targetAccId = created?.id;
    } else {
      await db
        .from("loyalty_accounts")
        .update({ points: Number(referrerAcc?.points ?? 0) + pointsToAdd })
        .eq("id", targetAccId);
    }

    if (targetAccId) {
      await db.from("loyalty_transactions").insert({
        account_id: targetAccId,
        order_id: order.id,
        type: "earn",
        points: pointsToAdd,
        description: `مكافأة إحالة صديق: ${notes.join(" - ")}`,
      });
    }

    return { processed: true, pointsAdded: pointsToAdd };
  } catch (err) {
    console.error("processOrderReferralCommission failed:", err);
    return { processed: false, error: String(err) };
  }
}
