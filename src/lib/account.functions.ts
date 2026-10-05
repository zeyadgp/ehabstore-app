import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getYemeniPhoneVariants,
  normalizeYemeniPhone,
  phonesMatch,
  toWesternDigits,
} from "@/lib/yemen";

export type MyOrder = {
  id: string;
  order_number: number;
  status: string;
  customer_name?: string | null;
  total: number;
  delivery_fee?: number;
  discount?: number;
  currency_label: string;
  created_at: string;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  payment_method?: string | null;
  items: {
    product_name: string;
    quantity: number;
    price?: number | null;
    color_name?: string | null;
    size_name?: string | null;
  }[];
};

/** طلبات العميل الحالي مرتبطة برقم الجوال المحفوظ في ملفه الشخصي. */
export const myOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyOrder[]> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("phone")
      .eq("id", context.userId)
      .maybeSingle();
    const phone = (profile as { phone: string | null } | null)?.phone;
    if (!phone) return [];

    const variants = getYemeniPhoneVariants(phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, status, total, delivery_fee, currency_label, created_at, city, district, order_items(product_name, quantity, price, color_name, size_name)",
      )
      .in("phone", variants)
      .order("created_at", { ascending: false })
      .limit(30);

    return ((data ?? []) as unknown as (MyOrder & { order_items: MyOrder["items"] })[]).map(
      (o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        customer_name: null,
        total: Number(o.total),
        delivery_fee: Number(o.delivery_fee || 0),
        discount: 0,
        currency_label: o.currency_label,
        created_at: o.created_at,
        city: o.city ?? null,
        district: o.district ?? null,
        address: null,
        payment_method: null,
        items: o.order_items ?? [],
      }),
    );
  });

const avatarSchema = z.object({ dataUrl: z.string().min(20).max(4_000_000) });

/** رفع صورة البروفايل إلى مخزن المتجر وإرجاع مسارها. */
export const uploadAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => avatarSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ path: string }> => {
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("صيغة الصورة غير مدعومة");
    const contentType = match[1] as string;
    const bytes = Buffer.from(match[2] as string, "base64");
    if (bytes.byteLength > 3 * 1024 * 1024) throw new Error("حجم الصورة كبير (الحد 3MB)");
    const ext = (contentType.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
    const path = `avatars/${context.userId}-${Date.now()}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("store-images")
      .upload(path, bytes, { contentType, upsert: true });
    if (error) throw new Error(error.message);
    return { path };
  });

const phoneLoginSchema = z.object({
  phone: z.string().trim().min(7).max(20),
  password: z.string().min(6).max(72),
});

export type PhoneLoginResult = { access_token: string; refresh_token: string };

/**
 * دخول برقم الجوال: نطابق الرقم مع الملف الشخصي داخل الخادم ثم ننفّذ الدخول،
 * بحيث لا يُكشف بريد أي عميل للمتصفح.
 */
export const signInWithPhone = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => phoneLoginSchema.parse(data))
  .handler(async ({ data }): Promise<PhoneLoginResult> => {
    const generic = new Error("بيانات الدخول غير صحيحة");
    const phone = normalizeYemeniPhone(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // بحث مباشر بالرقم (بكل صيغه الشائعة) بدل جلب آلاف الحسابات
    const variants = Array.from(
      new Set([phone, `0${phone}`, `967${phone}`, `+967${phone}`, `00967${phone}`]),
    );
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, phone")
      .in("phone", variants)
      .limit(5);
    const match = ((rows ?? []) as { id: string; phone: string | null }[]).find(
      (r) => r.phone && normalizeYemeniPhone(r.phone) === phone,
    );

    let email: string | undefined;
    if (match) {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(match.id);
      email = userRes?.user?.email ?? undefined;
    }

    if (!email) throw generic;

    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: session, error } = await client.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !session.session) throw generic;
    return {
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    };
  });

const trackSchema = z.object({
  orderNumber: z
    .union([z.number(), z.string()])
    .transform((val) => {
      const digits = toWesternDigits(String(val)).replace(/\D/g, "");
      const n = parseInt(digits, 10);
      return Number.isFinite(n) ? n : 0;
    })
    .pipe(z.number().int().positive()),
  phone: z.string().min(4).max(40),
});

export type TrackedOrder = {
  order_number: number;
  status: string;
  customer_name?: string | null;
  total: number;
  delivery_fee?: number;
  discount?: number;
  currency_label: string;
  created_at: string;
  updated_at: string;
  city: string;
  district: string | null;
  address?: string | null;
  payment_method?: string | null;
  items: {
    product_name: string;
    quantity: number;
    price?: number | null;
    color_name?: string | null;
    size_name?: string | null;
  }[];
};

/** متابعة الطلب للزائر برقم الطلب ورقم الجوال (بدون تسجيل دخول). */
export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => trackSchema.parse(data))
  .handler(async ({ data }): Promise<TrackedOrder | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // نطلب تفاصيل الطلب برقم الطلب الفريد (بدون حقول غير موجودة مثل discount)
    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .select(
        "order_number, status, total, delivery_fee, currency_label, created_at, updated_at, city, district, phone, order_items(product_name, quantity, color_name, size_name)",
      )
      .eq("order_number", data.orderNumber)
      .maybeSingle();

    if (error) {
      console.error("trackOrder database error:", error);
      return null;
    }
    if (!row) return null;

    const r = row as unknown as {
      order_number: number;
      status: string;
      customer_name?: string | null;
      total: number;
      delivery_fee?: number | null;
      currency_label?: string | null;
      created_at: string;
      updated_at: string;
      city: string;
      district: string | null;
      address: string | null;
      payment_method: string | null;
      phone: string;
      order_items: TrackedOrder["items"];
    };

    // التحقق المرن من مطابقة رقم الهاتف (يدعم الأرقام المشرقية، والبادئات، والمسافات المسجلة)
    if (!phonesMatch(r.phone, data.phone)) {
      return null;
    }

    return {
      order_number: r.order_number,
      status: r.status,
      // لا نعيد الاسم أو العنوان التفصيلي أو طريقة الدفع لصفحة التتبع العامة.
      customer_name: null,
      total: Number(r.total),
      delivery_fee: Number(r.delivery_fee || 0),
      discount: 0,
      currency_label: r.currency_label || "ر.ي",
      created_at: r.created_at,
      updated_at: r.updated_at,
      city: r.city,
      district: r.district,
      address: null,
      payment_method: null,
      items: (r.order_items ?? []).map((i) => ({
        product_name: i.product_name,
        quantity: i.quantity,
        color_name: i.color_name ?? null,
        size_name: i.size_name ?? null,
      })),
    };
  });
