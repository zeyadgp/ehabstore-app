import { normalizeYemeniPhone } from "./yemen";

export type LoyaltySettings = {
  id: string;
  is_active: boolean;
  base_currency: string;
  amount_per_point: number;
  min_redeem_points: number;
  point_value: number;
  coupon_expiry_days: number;
};

type Admin = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

export async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getSettings(db: Admin): Promise<LoyaltySettings | null> {
  const { data } = await db.from("loyalty_settings").select("*").limit(1).maybeSingle();
  if (!data) return null;
  return {
    ...data,
    amount_per_point: Number(data.amount_per_point) || 1,
    point_value: Number(data.point_value) || 0,
  } as LoyaltySettings;
}

/** سعر صرف عملة معينة مقارنة بالعملة الأساسية للمتجر */
export async function currencyRate(db: Admin, code: string): Promise<number> {
  const { data } = await db.from("currencies").select("code, rate").eq("code", code).maybeSingle();
  return Number(data?.rate ?? 1) || 1;
}

/** يحوّل مبلغ الطلب (بعملة الطلب) إلى عملة أساس نظام الولاء */
export function toLoyaltyAmount(orderTotal: number, orderRate: number, loyaltyRate: number) {
  const store = Number(orderTotal || 0) / (Number(orderRate) || 1);
  return store * (Number(loyaltyRate) || 1);
}

export function pointsFor(amountInLoyaltyCurrency: number, amountPerPoint: number) {
  const per = Number(amountPerPoint) || 1;
  return Math.max(0, Math.floor(amountInLoyaltyCurrency / per));
}

export async function ensureAccount(db: Admin, phone: string, name?: string | null) {
  const normalized = normalizeYemeniPhone(phone);
  const { data: existing } = await db
    .from("loyalty_accounts")
    .select("*")
    .eq("phone", normalized)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await db
    .from("loyalty_accounts")
    .insert({ phone: normalized, customer_name: name ?? null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export function couponCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  for (let i = 0; i < 10; i += 1) out += chars[bytes[i]! % chars.length];
  return `EH-${out}`;
}
