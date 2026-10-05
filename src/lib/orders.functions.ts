import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(20),
  city: z.string().trim().min(2).max(60),
  district: z.string().trim().max(60).optional().nullable(),
  address: z.string().trim().min(5).max(200),
  notes: z.string().trim().max(400).optional().nullable(),
  currency: z.string().trim().min(2).max(16).optional(),
  paymentMethod: z.string().trim().max(80).optional().nullable(),
  receiptUrl: z.string().trim().max(300).optional().nullable(),
  couponCode: z.string().trim().max(20).optional().nullable(),
  influencerCode: z.string().trim().max(30).optional().nullable(),
  clientToken: z.string().trim().max(64).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
        colorValueId: z.string().uuid().optional().nullable(),
        sizeValueId: z.string().uuid().optional().nullable(),
      }),
    )
    .min(1)
    .max(50),
});

export type PlacedOrder = {
  orderId: string;
  orderNumber: number | null;
  subtotal: number;
  total: number;
  currency: string;
  currencyLabel: string;
  storeName: string;
  whatsappNumber: string;
  paymentMethod: string | null;
  deliveryFee: number;
  items: {
    name: string;
    quantity: number;
    price: number;
    color_name: string | null;
    size_name: string | null;
  }[];
  discount: number;
  couponCode: string | null;
  pointsEarned: number;
  pointsBalance: number;
};

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<PlacedOrder> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ids = data.items.map((i) => i.id);
    const { data: products, error: prodError } = await supabaseAdmin
      .from("products")
      .select("id, name, price, discount_price, status, images")
      .in("id", ids);
    if (prodError) throw new Error(prodError.message);

    const { data: settings } = await supabaseAdmin
      .from("store_settings")
      .select(
        "store_name, currency, currency_label, whatsapp_number, delivery_enabled, delivery_default_fee, free_delivery_until",
      )
      .limit(1)
      .maybeSingle();

    const { data: currencies } = await supabaseAdmin
      .from("currencies")
      .select("code, symbol, rate, is_default, is_active")
      .eq("is_active", true);

    const fallbackCurrency = currencies?.find((c) => c.is_default) ?? currencies?.[0] ?? null;
    const chosen = currencies?.find((c) => c.code === (data.currency ?? "")) ?? fallbackCurrency;
    const currencyCode = chosen?.code ?? settings?.currency ?? "SAR";
    const currencyLabel = chosen?.symbol ?? settings?.currency_label ?? "ر.ي";
    const currencyRate = Number(chosen?.rate ?? 1) || 1;
    const roundMoney = (v: number) =>
      currencyCode.startsWith("YER") ? Math.round(v) : Math.round(v * 100) / 100;

    const { data: overrides } = await supabaseAdmin
      .from("product_prices")
      .select("product_id, price, discount_price")
      .eq("currency_code", currencyCode)
      .in("product_id", ids);

    // قيم الخيارات المختارة (اللون/المقاس) — السعر والمخزون يُحسمان من الخادم دائماً
    const valueIds = data.items
      .flatMap((i) => [i.colorValueId, i.sizeValueId])
      .filter((v): v is string => Boolean(v));
    const { data: optionValues } = valueIds.length
      ? await supabaseAdmin
          .from("product_option_values")
          .select("id, product_id, name, price, stock, sku, is_available, images")
          .in("id", valueIds)
      : { data: [] as never[] };

    const lines = data.items
      .map((item) => {
        const p = products?.find((x) => x.id === item.id);
        if (!p || p.status !== true) return null;
        const color = optionValues?.find(
          (v) => v.id === item.colorValueId && v.product_id === p.id && v.is_available,
        );
        const size = optionValues?.find(
          (v) => v.id === item.sizeValueId && v.product_id === p.id && v.is_available,
        );
        const base =
          size && size.price != null && Number(size.price) > 0
            ? Number(size.price)
            : p.discount_price != null && Number(p.discount_price) > 0
              ? Number(p.discount_price)
              : Number(p.price);
        const o = overrides?.find((x) => x.product_id === p.id);
        const override = size
          ? null
          : o?.discount_price != null && Number(o.discount_price) > 0
            ? Number(o.discount_price)
            : o?.price != null && Number(o.price) > 0
              ? Number(o.price)
              : null;
        const unit = override ?? roundMoney(base * currencyRate);
        const image =
          (color?.images?.[0] as string | undefined) ??
          (p as { images?: string[] }).images?.[0] ??
          null;
        return {
          product_id: p.id,
          product_name: p.name,
          price: unit,
          quantity: item.quantity,
          color_name: color?.name ?? null,
          size_name: size?.name ?? null,
          size_value_id: size?.id ?? null,
          sku: size?.sku ?? null,
          image,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (lines.length === 0) throw new Error("لا توجد منتجات متاحة في الطلب");

    const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

    const loyalty = await import("@/lib/loyalty.server");
    const loySettings = await loyalty.getSettings(supabaseAdmin);
    const loyaltyActive = Boolean(loySettings?.is_active);
    const loyaltyRate = loySettings
      ? await loyalty.currencyRate(supabaseAdmin, loySettings.base_currency)
      : 1;

    // كوبون الولاء (إن وُجد)
    let discount = 0;
    let appliedCoupon: { id: string; code: string } | null = null;
    if (loyaltyActive && data.couponCode) {
      const { data: coupon } = await supabaseAdmin
        .from("loyalty_coupons")
        .select("id, code, status, discount_type, discount_value, expires_at")
        .eq("code", data.couponCode.trim().toUpperCase())
        .maybeSingle();
      const valid =
        coupon &&
        coupon.status === "available" &&
        (!coupon.expires_at || new Date(coupon.expires_at).getTime() > Date.now());
      if (valid && coupon) {
        if (coupon.discount_type === "percent") {
          discount = roundMoney((subtotal * Number(coupon.discount_value)) / 100);
        } else {
          const inStore = Number(coupon.discount_value) / (loyaltyRate || 1);
          discount = roundMoney(inStore * currencyRate);
        }
        discount = Math.min(discount, subtotal);
        appliedCoupon = { id: coupon.id, code: coupon.code };
      }
    }

    // كوبون خصم عام / كود إحالة شخصي
    let appliedDiscountCoupon: { id: string; code: string; owner_phone: string | null } | null =
      null;
    if (!appliedCoupon && data.couponCode) {
      const now = Date.now();
      const { data: dc } = await supabaseAdmin
        .from("discount_coupons")
        .select(
          "id, code, discount_type, discount_value, min_order, is_active, starts_at, expires_at, max_uses, used_count, owner_phone",
        )
        .eq("code", data.couponCode.trim().toUpperCase())
        .maybeSingle();
      const valid =
        dc &&
        dc.is_active &&
        (!dc.starts_at || new Date(dc.starts_at).getTime() <= now) &&
        (!dc.expires_at || new Date(dc.expires_at).getTime() > now) &&
        (dc.max_uses === null || Number(dc.used_count) < Number(dc.max_uses)) &&
        subtotal >= Number(dc.min_order ?? 0);
      if (valid && dc) {
        discount =
          dc.discount_type === "percent"
            ? roundMoney((subtotal * Number(dc.discount_value)) / 100)
            : roundMoney((Number(dc.discount_value) / (loyaltyRate || 1)) * currencyRate);
        discount = Math.min(discount, subtotal);
        appliedDiscountCoupon = { id: dc.id, code: dc.code, owner_phone: dc.owner_phone };
      }
    }

    // رسوم التوصيل حسب المحافظة + فترة التوصيل المجاني
    let deliveryFee = 0;
    const freeUntil = settings?.free_delivery_until
      ? new Date(settings.free_delivery_until).getTime()
      : 0;
    const freeActive = freeUntil > Date.now();
    if (settings?.delivery_enabled !== false && !freeActive) {
      const { data: zones } = await supabaseAdmin
        .from("delivery_zones")
        .select("governorate, fee, is_active");
      const zone = zones?.find((z) => z.is_active && z.governorate.trim() === data.city.trim());
      const baseFee = Number(zone?.fee ?? settings?.delivery_default_fee ?? 2000) || 0;
      deliveryFee = roundMoney((baseFee / (loyaltyRate || 1)) * currencyRate);
    }

    const total = Math.max(0, roundMoney(subtotal - discount + deliveryFee));

    // نقاط الولاء (تُحتسب هنا وتُسجَّل ذرياً داخل المعاملة)
    const loyaltyAmount = loyaltyActive
      ? loyalty.toLoyaltyAmount(total, currencyRate, loyaltyRate)
      : 0;
    const pointsEarned =
      loyaltyActive && loySettings
        ? loyalty.pointsFor(loyaltyAmount, loySettings.amount_per_point)
        : 0;
    const { normalizeYemeniPhone } = await import("@/lib/yemen");

    // كل شيء داخل معاملة واحدة: المخزون + الطلب + الأصناف + الكوبون + الولاء
    const { data: result, error: txError } = await supabaseAdmin.rpc("place_order_tx", {
      p: {
        client_token: data.clientToken ?? null,
        customer_name: data.name,
        phone: data.phone,
        city: data.city,
        district: data.district ?? null,
        address: data.address,
        notes: data.notes ?? null,
        total,
        delivery_fee: deliveryFee,
        discount,
        payment_status: data.receiptUrl ? "pending" : "unpaid",
        currency: currencyCode,
        currency_label: currencyLabel,
        currency_rate: currencyRate,
        payment_method: data.paymentMethod ?? null,
        receipt_url: data.receiptUrl ?? null,
        lines,
        coupon_code: appliedCoupon?.code ?? appliedDiscountCoupon?.code ?? null,
        discount_coupon_id: appliedDiscountCoupon?.id ?? null,
        loyalty_coupon_id: appliedCoupon?.id ?? null,
        loyalty_active: loyaltyActive,
        loyalty_points: pointsEarned,
        loyalty_amount: loyaltyAmount,
        loyalty_phone: normalizeYemeniPhone(data.phone),
      },
    } as never);

    if (txError) {
      const raw = txError.message ?? "";
      console.error("place_order_tx failed", raw);
      if (raw.includes("OUT_OF_STOCK")) {
        const name = raw.split("OUT_OF_STOCK:")[1]?.split('"')[0]?.trim();
        throw new Error(
          name
            ? `الكمية المتوفرة من "${name}" غير كافية`
            : "بعض المنتجات لم تعد متوفرة بالكمية المطلوبة",
        );
      }
      if (raw.includes("COUPON_EXHAUSTED"))
        throw new Error("تم استهلاك عدد مرات استخدام هذا الكود");
      if (raw.includes("COUPON_USED")) throw new Error("كوبون الولاء مستخدم أو غير متاح");
      throw new Error("تعذّر إتمام الطلب، حاول مرة أخرى");
    }

    const order = result as unknown as {
      id: string;
      order_number: number | null;
      duplicate: boolean;
      points_balance: number;
    };
    const pointsBalance = Number(order.points_balance ?? 0);

    // احتساب عمولة التسويق بالعمولة للمؤثر إذا كان الكود مستخدماً ومفعلاً
    if (!order.duplicate && data.influencerCode) {
      try {
        const cleanInfCode = data.influencerCode.trim().toUpperCase();
        const { data: influencer } = await supabaseAdmin
          .from("influencers")
          .select("id, commission_percent, balance, total_earned, status")
          .eq("code", cleanInfCode)
          .maybeSingle();

        if (influencer && influencer.status === "active") {
          const commPercent = Number(influencer.commission_percent ?? 10);

          // استعلام تكاليف المنتجات لحساب الربح (Profit = Subtotal - TotalCost)
          const { data: costsSetting } = await supabaseAdmin
            .from("site_settings")
            .select("value")
            .eq("key", "admin_product_costs_map")
            .maybeSingle();

          let costsMap: Record<string, { cost_price?: number }> = {};
          if (costsSetting?.value) {
            try {
              costsMap = JSON.parse(costsSetting.value);
            } catch {
              /* ignore parse error */
            }
          }

          let orderCostCents: number | null = 0;
          for (const item of data.items) {
            const itemCost = costsMap[item.id]?.cost_price;
            if (typeof itemCost !== "number" || itemCost < 0) {
              orderCostCents = null; // تكلفة غير محددة — تفعيل سياسة الأمان بعدم الاحتساب
              break;
            }
            orderCostCents += itemCost * (item.quantity || 1);
          }

          const { calculateCommissionFromProfit } = await import("@/lib/commissions");
          const { commissionCents: commAmount, reason } = calculateCommissionFromProfit(
            subtotal,
            orderCostCents,
            commPercent,
          );

          if (reason === "no_cost_data") {
            console.warn(
              `Order #${order.order_number}: No cost data available. Influencer commission set to 0.`,
            );
          } else if (commAmount > 0) {
            // 1. تسجيل عمولة المؤثر في سجلات الأرباح
            await supabaseAdmin.from("affiliate_earnings").insert({
              influencer_id: influencer.id,
              order_id: order.id,
              order_number: String(order.order_number),
              order_total: subtotal,
              commission_percent: commPercent,
              commission_amount: roundMoney(commAmount),
              currency: currencyCode,
              status: "confirmed",
            });

            // 2. تحديث الرصيد الحالي وإجمالي الأرباح للمؤثر
            await supabaseAdmin
              .from("influencers")
              .update({
                balance: Number(influencer.balance ?? 0) + roundMoney(commAmount),
                total_earned: Number(influencer.total_earned ?? 0) + roundMoney(commAmount),
                updated_at: new Date().toISOString(),
              } as never)
              .eq("id", influencer.id);
          }
        }
      } catch (err) {
        console.error("Failed to distribute influencer commission:", err);
      }
    }

    // حفظ إحداثيات الموقع (اختيارية) بعد نجاح المعاملة
    if (!order.duplicate && data.latitude != null && data.longitude != null) {
      await supabaseAdmin
        .from("orders")
        .update({ latitude: data.latitude, longitude: data.longitude } as never)
        .eq("id", order.id);
    }

    // تنبيه الإدارة تلقائياً بالطلب الجديد (سجل داخلي + واتساب/بريد عند توفر الإعداد)
    try {
      const { notifyNewOrder } = await import("@/lib/notify.server");
      const { data: contact } = await supabaseAdmin
        .from("store_settings")
        .select("email")
        .limit(1)
        .maybeSingle();
      await notifyNewOrder(
        supabaseAdmin,
        {
          orderNumber: order.order_number ?? null,
          customerName: data.name,
          phone: data.phone,
          city: data.city,
          district: data.district ?? null,
          address: data.address,
          total,
          currencyLabel,
          paymentMethod: data.paymentMethod ?? null,
          items: lines.map((l) => ({ name: l.product_name, quantity: l.quantity, price: l.price })),
        },
        {
          name: settings?.store_name ?? "إيهاب ستور للعناية والتجميل",
          whatsapp: settings?.whatsapp_number ?? "",
          email: contact?.email ?? null,
        },
      );
    } catch {
      // لا نُفشل الطلب بسبب التنبيهات
    }

    // رسالة تأكيد تلقائية للعميل عند تفعيلها وتوفر خدمة واتساب الرسمية.
    if (!order.duplicate) {
      try {
        const { data: saved } = await supabaseAdmin
          .from("site_settings")
          .select("value")
          .eq("key", "whatsapp_automation")
          .maybeSingle();
        const { defaultWaTemplates, fillTemplate } = await import("@/lib/wa-templates");
        const config = saved?.value ? JSON.parse(saved.value) : {};
        if (config.confirm !== false) {
          const body = fillTemplate(config.templates?.confirm ?? defaultWaTemplates.confirm, {
            name: data.name,
            order: order.order_number ?? "—",
            total: `${total} ${currencyLabel}`,
            city: data.city,
            store: settings?.store_name ?? "متجرنا",
            delivery: `${deliveryFee} ${currencyLabel}`,
          });
          const { sendWhatsappText } = await import("@/lib/notify.server");
          await sendWhatsappText(body, data.phone.replace(/[^\d]/g, ""));
          await supabaseAdmin.from("whatsapp_messages").insert({
            order_id: order.id,
            phone: data.phone,
            template: "auto_confirm",
            body,
          });
        }
      } catch {
        // لا نُفشل الطلب إذا تعذر إشعار واتساب.
      }
    }

    return {
      orderId: order.id,
      orderNumber: order.order_number ?? null,
      subtotal: total - deliveryFee + discount,
      total,
      currency: currencyCode,
      currencyLabel,
      storeName: settings?.store_name ?? "إيهاب ستور للعناية والتجميل",
      whatsappNumber: settings?.whatsapp_number ?? "967780187409",
      paymentMethod: data.paymentMethod ?? null,
      deliveryFee,
      items: lines.map((l) => ({
        name: l.product_name,
        quantity: l.quantity,
        price: l.price,
        color_name: l.color_name,
        size_name: l.size_name,
      })),
      discount,
      couponCode: appliedCoupon?.code ?? appliedDiscountCoupon?.code ?? null,
      pointsEarned,
      pointsBalance,
    };
  });
