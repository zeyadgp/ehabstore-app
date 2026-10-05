import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CouponCheck = {
  ok: boolean;
  message: string;
  code?: string;
  kind?: "discount" | "loyalty" | "influencer";
  discountType?: string;
  discountValue?: number;
  influencerName?: string;
};

const schema = z.object({ code: z.string().trim().min(2).max(24) });

/** التحقق الفوري من كود الخصم قبل إرسال الطلب (كوبونات الخصم، الولاء، أو أكواد المؤثرين). */
export const checkCoupon = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<CouponCheck> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.trim().toUpperCase();
    const now = Date.now();

    const { data: c } = await supabaseAdmin
      .from("discount_coupons")
      .select(
        "code, discount_type, discount_value, is_active, starts_at, expires_at, max_uses, used_count",
      )
      .eq("code", code)
      .maybeSingle();

    if (c) {
      if (!c.is_active) return { ok: false, message: "هذا الكود غير مفعّل حالياً" };
      if (c.starts_at && new Date(c.starts_at).getTime() > now)
        return { ok: false, message: "لم يبدأ العمل بهذا الكود بعد" };
      if (c.expires_at && new Date(c.expires_at).getTime() < now)
        return { ok: false, message: "انتهت صلاحية هذا الكود" };
      if (c.max_uses !== null && Number(c.used_count) >= Number(c.max_uses))
        return { ok: false, message: "تم استهلاك عدد مرات استخدام هذا الكود" };
      const label =
        c.discount_type === "percent"
          ? `خصم ${Number(c.discount_value)}%`
          : `خصم ${Number(c.discount_value)}`;
      return {
        ok: true,
        message: `تم تطبيق الكود — ${label}`,
        code,
        kind: "discount",
        discountType: c.discount_type,
        discountValue: Number(c.discount_value),
      };
    }

    const { data: l } = await supabaseAdmin
      .from("loyalty_coupons")
      .select("code, status, discount_type, discount_value, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (l) {
      if (l.status !== "available") return { ok: false, message: "كوبون الولاء مستخدم أو ملغي" };
      if (l.expires_at && new Date(l.expires_at).getTime() < now)
        return { ok: false, message: "انتهت صلاحية كوبون الولاء" };
      return {
        ok: true,
        message: "تم تطبيق كوبون الولاء",
        code,
        kind: "loyalty",
        discountType: l.discount_type,
        discountValue: Number(l.discount_value),
      };
    }

    // التحقق من كود المؤثرين المسجلين في المتجر
    const { data: inf } = await supabaseAdmin
      .from("influencers")
      .select("code, name, status")
      .eq("code", code)
      .maybeSingle();

    if (inf) {
      if (inf.status !== "active") return { ok: false, message: "كود المؤثر هذا موقف مؤقتاً" };
      return {
        ok: true,
        message: `تم تفعيل كود الإحالة للمؤثرة: ${inf.name} ✨`,
        code: inf.code,
        kind: "influencer",
        influencerName: inf.name,
      };
    }

    return { ok: false, message: "الكود غير صحيح" };
  });
