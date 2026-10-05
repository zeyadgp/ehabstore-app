import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeYemeniPhone } from "@/lib/yemen";

export type LoyaltyTx = {
  id: string;
  type: string;
  points: number;
  order_number: number | null;
  description: string | null;
  created_at: string;
};

export type LoyaltyCoupon = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  status: string;
  expires_at: string | null;
  created_at: string;
};

export type LoyaltyOverview = {
  found: boolean;
  /** true فقط عندما يكون المتصل صاحب الرقم (أو مديراً) — التفاصيل الكاملة تُعرض له وحده. */
  owner: boolean;
  phone: string;
  name: string | null;
  points: number;
  pendingPoints: number;
  totalSpent: number;
  settings: {
    isActive: boolean;
    baseCurrency: string;
    amountPerPoint: number;
    minRedeemPoints: number;
    pointValue: number;
  } | null;
  nextReward: { name: string; pointsRequired: number } | null;
  transactions: LoyaltyTx[];
  coupons: LoyaltyCoupon[];
};

const phoneSchema = z.object({ phone: z.string().trim().min(7).max(20) });

export const getLoyaltyOverview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => phoneSchema.parse(data))
  .handler(async ({ data }): Promise<LoyaltyOverview> => {
    const { admin, getSettings } = await import("@/lib/loyalty.server");
    const { optionalCaller } = await import("@/lib/caller.server");
    const db = await admin();
    const phone = normalizeYemeniPhone(data.phone);
    const settingsRow = await getSettings(db);

    const caller = await optionalCaller();
    const owner = Boolean(caller && (caller.isAdmin || caller.phone === phone));

    const { data: account } = await db
      .from("loyalty_accounts")
      .select("id, phone, customer_name, points, pending_points, total_spent")
      .eq("phone", phone)
      .maybeSingle();

    const { data: rewards } = await db
      .from("loyalty_rewards")
      .select("name, points_required")
      .eq("is_active", true)
      .order("points_required");

    const points = Number(account?.points ?? 0);
    const nextReward =
      rewards?.find((r) => Number(r.points_required) > points) ??
      rewards?.[rewards.length - 1] ??
      null;

    const settings = settingsRow
      ? {
          isActive: settingsRow.is_active,
          baseCurrency: settingsRow.base_currency,
          amountPerPoint: Number(settingsRow.amount_per_point),
          minRedeemPoints: settingsRow.min_redeem_points,
          pointValue: Number(settingsRow.point_value),
        }
      : null;

    const next = nextReward
      ? { name: nextReward.name, pointsRequired: Number(nextReward.points_required) }
      : null;

    if (!account || !owner) {
      return {
        found: false,
        owner: false,
        phone,
        name: null,
        points: 0,
        pendingPoints: 0,
        totalSpent: 0,
        settings,
        nextReward: next,
        transactions: [],
        coupons: [],
      };
    }

    // غير المالك لا يرى أي رصيد — كل التفاصيل لصاحب الحساب فقط.
    if (!owner) {
      return {
        found: true,
        owner: false,
        phone,
        name: null,
        points: 0,
        pendingPoints: 0,
        totalSpent: 0,
        settings,
        nextReward: next,
        transactions: [],
        coupons: [],
      };
    }

    const { data: txs } = await db
      .from("loyalty_transactions")
      .select("id, type, points, order_number, description, created_at")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: coupons } = await db
      .from("loyalty_coupons")
      .select("id, code, discount_type, discount_value, status, expires_at, created_at")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(30);

    return {
      found: true,
      owner: true,
      phone,
      name: account.customer_name,
      points,
      pendingPoints: Number(account.pending_points ?? 0),
      totalSpent: Number(account.total_spent ?? 0),
      settings,
      nextReward: next,
      transactions: (txs ?? []).map((t) => ({ ...t, points: Number(t.points) })) as LoyaltyTx[],
      coupons: (coupons ?? []).map((c) => ({
        ...c,
        discount_value: Number(c.discount_value),
      })) as LoyaltyCoupon[],
    };
  });

export const redeemReward = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ phone: z.string().trim().min(7).max(20), rewardId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }): Promise<{ code: string; expiresAt: string | null }> => {
    const { admin, getSettings, couponCode } = await import("@/lib/loyalty.server");
    const { optionalCaller } = await import("@/lib/caller.server");
    const db = await admin();
    const phone = normalizeYemeniPhone(data.phone);

    // الاستبدال يتطلب تسجيل الدخول بحساب صاحب الرقم (أو مديراً).
    const caller = await optionalCaller();
    if (!caller) throw new Error("سجّل الدخول أولاً لاستبدال نقاطك");
    if (!caller.isAdmin && caller.phone !== phone) {
      throw new Error("لا يمكنك استبدال نقاط رقم جوال غير رقمك");
    }

    const settings = await getSettings(db);
    if (!settings?.is_active) throw new Error("برنامج الولاء غير مفعّل حالياً");

    const { data: account } = await db
      .from("loyalty_accounts")
      .select("id, points")
      .eq("phone", phone)
      .maybeSingle();
    if (!account) throw new Error("لا يوجد رصيد نقاط لهذا الرقم");

    const { data: reward } = await db
      .from("loyalty_rewards")
      .select("id, name, points_required, discount_type, discount_value, is_active")
      .eq("id", data.rewardId)
      .maybeSingle();
    if (!reward || !reward.is_active) throw new Error("المكافأة غير متاحة");

    const required = Number(reward.points_required);
    if (required < settings.min_redeem_points) throw new Error("لم تصل بعد للحد الأدنى للاستبدال");

    // خصم ذرّي: يمرّ فقط إذا كان الرصيد لا يزال كافياً — يمنع الاستبدال المزدوج.
    const { data: deducted, error: dErr } = await db
      .from("loyalty_accounts")
      .update({ points: Number(account.points) - required })
      .eq("id", account.id)
      .eq("points", Number(account.points))
      .gte("points", required)
      .select("id")
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!deducted) throw new Error("نقاطك غير كافية لهذه المكافأة");

    const expiresAt = new Date(
      Date.now() + (settings.coupon_expiry_days || 60) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const code = couponCode();

    const { error: cErr } = await db.from("loyalty_coupons").insert({
      code,
      account_id: account.id,
      reward_id: reward.id,
      discount_type: reward.discount_type,
      discount_value: reward.discount_value,
      points_spent: required,
      status: "available",
      expires_at: expiresAt,
    });
    if (cErr) {
      // إرجاع النقاط عند فشل إنشاء الكوبون
      await db
        .from("loyalty_accounts")
        .update({ points: Number(account.points) })
        .eq("id", account.id);
      throw new Error(cErr.message);
    }

    await db.from("loyalty_transactions").insert({
      account_id: account.id,
      type: "redeem",
      points: -required,
      description: `استبدال مكافأة: ${reward.name} — كوبون ${code}`,
    });

    return { code, expiresAt };
  });

/** تأكيد نقاط طلب مكتمل أو إلغاؤها — للمسؤولين فقط */
export const syncOrderPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ orderId: z.string().uuid(), status: z.string().trim().min(2).max(20) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; points: number }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { admin } = await import("@/lib/loyalty.server");
    const db = await admin();

    const { data: order } = await db
      .from("orders")
      .select("id, order_number, phone, status, total, currency")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) return { ok: false, points: 0 };

    const { normalizeYemeniPhone: norm } = await import("@/lib/yemen");
    const { data: account } = await db
      .from("loyalty_accounts")
      .select("id, points, pending_points")
      .eq("phone", norm(order.phone))
      .maybeSingle();
    if (!account) return { ok: false, points: 0 };

    const { data: pendingTx } = await db
      .from("loyalty_transactions")
      .select("id, points, type")
      .eq("account_id", account.id)
      .eq("order_id", order.id)
      .eq("type", "pending");

    const pending = (pendingTx ?? []).reduce((s, t) => s + Number(t.points), 0);
    if (pending <= 0) return { ok: false, points: 0 };

    if (data.status === "completed") {
      await db
        .from("loyalty_accounts")
        .update({
          points: Number(account.points) + pending,
          pending_points: Math.max(0, Number(account.pending_points) - pending),
        })
        .eq("id", account.id);
      await db
        .from("loyalty_transactions")
        .update({ type: "earn", description: `نقاط مؤكدة للطلب #${order.order_number}` })
        .eq("account_id", account.id)
        .eq("order_id", order.id)
        .eq("type", "pending");

      // احتساب عمولة ونقاط الداعي/المُحيل تلقائياً عند تسليم الطلب بنجاح
      try {
        const { processOrderReferralCommission } = await import("@/lib/referral.server");
        await processOrderReferralCommission(db, {
          id: order.id,
          order_number: order.order_number,
          phone: order.phone,
          total: Number(order.total || 0),
          subtotal: Number(order.total || 0),
          currency: order.currency ?? undefined,
        });
      } catch (refErr) {
        console.warn("processOrderReferralCommission error:", refErr);
      }

      // مزامنة حالة العمولات المسجلة للطلب (تسوية عند الاكتمال)
      try {
        const { syncOrderCommissionStatus } = await import("@/lib/commissions.server");
        await syncOrderCommissionStatus(db, order.id, "completed");
      } catch (commErr) {
        console.warn("syncOrderCommissionStatus completed error:", commErr);
      }

      return { ok: true, points: pending };
    }

    if (data.status === "cancelled") {
      await db
        .from("loyalty_accounts")
        .update({ pending_points: Math.max(0, Number(account.pending_points) - pending) })
        .eq("id", account.id);
      await db
        .from("loyalty_transactions")
        .update({
          type: "cancelled",
          points: 0,
          description: `أُلغيت نقاط الطلب #${order.order_number}`,
        })
        .eq("account_id", account.id)
        .eq("order_id", order.id)
        .eq("type", "pending");

      // عكس أي عمولات مسجلة للطلب عند الإلغاء
      try {
        const { syncOrderCommissionStatus } = await import("@/lib/commissions.server");
        await syncOrderCommissionStatus(db, order.id, "cancelled");
      } catch (commErr) {
        console.warn("syncOrderCommissionStatus cancelled error:", commErr);
      }

      return { ok: true, points: -pending };
    }

    return { ok: false, points: 0 };
  });

/** إدارة النقاط يدوياً من لوحة التحكم */
export const adjustPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        phone: z.string().trim().min(7).max(20),
        points: z.number().int().min(-100000).max(100000),
        reason: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ points: number }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { admin, ensureAccount } = await import("@/lib/loyalty.server");
    const db = await admin();
    const account = await ensureAccount(db, data.phone);
    const next = Math.max(0, Number(account.points) + data.points);
    await db.from("loyalty_accounts").update({ points: next }).eq("id", account.id);
    await db.from("loyalty_transactions").insert({
      account_id: account.id,
      type: "adjust",
      points: data.points,
      description: data.reason ?? "تعديل يدوي من لوحة التحكم",
    });
    return { points: next };
  });

/** قراءة إعدادات عمولة التطوير — للمديرين فقط (محجوبة عن العملاء) */
export const getDevCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({}).optional().parse(data))
  .handler(
    async ({ context }): Promise<{ enabled: boolean; percent: number; account: string | null }> => {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Forbidden");
      const { admin } = await import("@/lib/loyalty.server");
      const db = await admin();
      const { data } = await db
        .from("loyalty_settings")
        .select("dev_commission_enabled, dev_commission_percent, dev_commission_account")
        .limit(1)
        .maybeSingle();
      return {
        enabled: Boolean(data?.dev_commission_enabled),
        percent: Number(data?.dev_commission_percent ?? 0),
        account: data?.dev_commission_account ?? null,
      };
    },
  );

export type MyReferralData = {
  referralCode: string;
  referralsCount: number;
  referralEnabled: boolean;
  referrerPoints: number;
  inviteePoints: number;
  commissionPercent: number;
};

/** الحصول على كود ورابط الإحالة وإحصائيات المدعوين للعميل المسجل */
export const getMyReferralInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({}).optional().parse(data))
  .handler(async ({ context }): Promise<MyReferralData> => {
    const { admin } = await import("@/lib/loyalty.server");
    const db = await admin();
    const { data: profile } = await db
      .from("profiles")
      .select("id, referral_code, full_name, phone")
      .eq("id", context.userId)
      .maybeSingle();

    let code = profile?.referral_code;
    if (!code) {
      const shortId = context.userId.replace(/-/g, "").slice(0, 6).toUpperCase();
      code = `EH-${shortId}`;
      await db
        .from("profiles")
        .update({ referral_code: code } as never)
        .eq("id", context.userId);
    }

    const { data: settingsRow } = await db
      .from("loyalty_settings")
      .select(
        "referral_enabled, referral_referrer_points, referral_invitee_points, referral_commission_percent",
      )
      .limit(1)
      .maybeSingle();

    const { count } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", code);

    return {
      referralCode: code,
      referralsCount: count ?? 0,
      referralEnabled: settingsRow?.referral_enabled ?? true,
      referrerPoints: Number(settingsRow?.referral_referrer_points ?? 50),
      inviteePoints: Number(settingsRow?.referral_invitee_points ?? 25),
      commissionPercent: Number(settingsRow?.referral_commission_percent ?? 5),
    };
  });

/**
 * معالجة مكافأة الإحالة الترحيبية للعميل الجديد والداعي عند التسجيل
 */
export const processSignupReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        referralCode: z.string().trim().min(3).max(30),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("@/lib/loyalty.server");
    const { rewardSignupReferral } = await import("@/lib/referral.server");
    const db = await admin();

    const { data: profile } = await db
      .from("profiles")
      .select("id, phone, full_name, referred_by")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile) return { success: false, reason: "profile_not_found" };
    if (profile.referred_by) return { success: false, reason: "already_referred" };

    const res = await rewardSignupReferral(
      db,
      { id: profile.id, phone: profile.phone, fullName: profile.full_name },
      data.referralCode,
    );

    return { success: res.rewarded, details: res };
  });
