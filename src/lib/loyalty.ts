import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LoyaltyReward = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  sort_order: number;
};

export type LoyaltySettingsRow = {
  id: string;
  is_active: boolean;
  base_currency: string;
  amount_per_point: number;
  min_redeem_points: number;
  point_value: number;
  coupon_expiry_days: number;
  allow_partial_redeem?: boolean;
  max_points?: number;
  unlock_min_order?: number;
  refund_policy?: string;
  expiry_basis?: string;
  expiry_months?: number;
  expiry_notify?: boolean;
  daily_enabled?: boolean;
  daily_start_points?: number;
  daily_max_points?: number;
  daily_grace_days?: number;
  daily_after_max?: string;
  referral_enabled?: boolean;
  referral_referrer_points?: number;
  referral_invitee_points?: number;
  referral_commission_percent?: number;
  dev_commission_enabled?: boolean;
  dev_commission_percent?: number;
  dev_commission_account?: string | null;
};

export function useLoyaltyRewards() {
  return useQuery({
    queryKey: ["loyalty", "rewards"],
    queryFn: async (): Promise<LoyaltyReward[]> => {
      const { data } = await supabase
        .from("loyalty_rewards")
        .select("*")
        .eq("is_active", true)
        .order("points_required");
      return (data as LoyaltyReward[] | null) ?? [];
    },
    staleTime: 60_000,
  });
}

/** الأعمدة العامة فقط — حقول عمولة المطور محجوبة عن العملاء */
const PUBLIC_SETTINGS_COLUMNS =
  "id, is_active, base_currency, amount_per_point, min_redeem_points, point_value, coupon_expiry_days, daily_enabled, daily_start_points, daily_max_points, daily_after_max, daily_grace_days, referral_enabled, referral_referrer_points, referral_invitee_points, referral_commission_percent, max_points, unlock_min_order, allow_partial_redeem, expiry_months, expiry_basis, expiry_notify, refund_policy, created_at, updated_at";

export function useLoyaltySettings() {
  return useQuery({
    queryKey: ["loyalty", "settings"],
    queryFn: async (): Promise<LoyaltySettingsRow | null> => {
      const { data } = await supabase
        .from("loyalty_settings")
        .select(PUBLIC_SETTINGS_COLUMNS)
        .limit(1)
        .maybeSingle();
      return (data as LoyaltySettingsRow | null) ?? null;
    },
    staleTime: 60_000,
  });
}

export const LOYALTY_STORAGE_KEY = "ehab-loyalty-phone";

export function rewardLabel(
  r: Pick<LoyaltyReward, "discount_type" | "discount_value">,
  currency: string,
) {
  return r.discount_type === "percent"
    ? `خصم ${Number(r.discount_value)}%`
    : `خصم ${Number(r.discount_value).toLocaleString("en-US")} ${currency}`;
}

export type VIPTierLevel = "bronze" | "silver" | "gold" | "platinum";

export type VIPTier = {
  id: VIPTierLevel;
  name: string;
  minPoints: number;
  badgeGradient: string;
  borderColor: string;
  pointsMultiplier: number;
  discountPercent: number;
  freeShipping: boolean;
  perks: string[];
};

export const VIP_TIERS: VIPTier[] = [
  {
    id: "bronze",
    name: "العضوية البرونزية",
    minPoints: 0,
    badgeGradient: "from-amber-700 to-amber-900 text-amber-100",
    borderColor: "border-amber-700/40",
    pointsMultiplier: 1.0,
    discountPercent: 0,
    freeShipping: false,
    perks: ["اكتساب 1 نقطة لكل ريال", "كوبونات استبدال حصرية", "عروض أعياد ومواسم خاصة"],
  },
  {
    id: "silver",
    name: "العضوية الفضية",
    minPoints: 500,
    badgeGradient: "from-slate-400 via-slate-200 to-slate-400 text-slate-900",
    borderColor: "border-slate-400/50",
    pointsMultiplier: 1.25,
    discountPercent: 5,
    freeShipping: false,
    perks: [
      "مضاعف نقاط 1.25x لكل طلب",
      "خصم إضافي 5% دائم على منتجات مختارة",
      "أولوية تجهيز وإرسال الطلبات",
      "عينات مجانية مع الطلبات",
    ],
  },
  {
    id: "gold",
    name: "العضوية الذهبية",
    minPoints: 1500,
    badgeGradient: "from-amber-400 via-yellow-300 to-amber-500 text-amber-950",
    borderColor: "border-amber-400/60",
    pointsMultiplier: 1.5,
    discountPercent: 10,
    freeShipping: true,
    perks: [
      "مضاعف نقاط 1.5x لكل طلب",
      "خصم إضافي 10% دائم",
      "شحن مجاني للطلبات فوق 20,000 ريال",
      "هدية فاخرة في شهر ميلادك",
      "خدمة عملاء VIP مخصصة",
    ],
  },
  {
    id: "platinum",
    name: "عضوية النخبة البلاتينية",
    minPoints: 4000,
    badgeGradient: "from-indigo-600 via-purple-600 to-pink-600 text-white",
    borderColor: "border-purple-500/60",
    pointsMultiplier: 2.0,
    discountPercent: 15,
    freeShipping: true,
    perks: [
      "مضاعف نقاط 2.0x مضاعف كامل لكل طلب",
      "خصم استثنائي 15% على جميع المشتريات",
      "شحن مجاني دائماً لكافة المحافظات",
      "صندوق عينات حصرية قبل إطلاق أي منتج جديد",
      "مدير حساب وخدمة شخصية متواصلة عبر واتساب",
    ],
  },
];

export function getCustomerVIPTier(points: number): {
  current: VIPTier;
  next: VIPTier | null;
  progress: number;
  pointsToNext: number;
} {
  const safePoints = Math.max(0, points);
  let currentTier = VIP_TIERS[0]!;

  for (let i = VIP_TIERS.length - 1; i >= 0; i--) {
    const tier = VIP_TIERS[i]!;
    if (safePoints >= tier.minPoints) {
      currentTier = tier;
      break;
    }
  }

  const currentIndex = VIP_TIERS.findIndex((t) => t.id === currentTier.id);
  const nextTier = currentIndex < VIP_TIERS.length - 1 ? VIP_TIERS[currentIndex + 1]! : null;

  if (!nextTier) {
    return {
      current: currentTier,
      next: null,
      progress: 100,
      pointsToNext: 0,
    };
  }

  const pointsInCurrentRange = safePoints - currentTier.minPoints;
  const rangeSpan = nextTier.minPoints - currentTier.minPoints;
  const progress = Math.min(100, Math.max(0, Math.round((pointsInCurrentRange / rangeSpan) * 100)));
  const pointsToNext = Math.max(0, nextTier.minPoints - safePoints);

  return {
    current: currentTier,
    next: nextTier,
    progress,
    pointsToNext,
  };
}
