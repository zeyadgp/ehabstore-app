/**
 * حساب العمولات بالاعتماد على الأرباح المحققة (الربح = الإجمالي - التكلفة)
 * طبقاً للسياسة الأمنية الصارمة: إذا لم تتوفر بيانات التكلفة فلا تحتسب العمولة آلياً.
 */

export type CommissionResult = {
  commissionCents: number;
  profitCents: number | null;
  reason?: "ok" | "no_cost_data" | "negative_profit" | "zero_commission" | undefined;
};

/**
 * حساب العمولة من الربح
 * profit = total - cost
 * إذا لم تتوفر التكلفة (typeof costCents !== 'number') ترجع 0 مع سبب no_cost_data
 */
export function calculateCommissionFromProfit(
  totalCents: number,
  costCents: number | null | undefined,
  commissionPercent: number,
): CommissionResult {
  // إذا لم تتوفر تكلفة المنتج، لا تحتسب العمولة آلياً — سياسة أمان
  if (typeof costCents !== "number" || isNaN(costCents)) {
    // سجل السبب في الخادم (audit) إن أمكن، وارجع صفراً
    return { commissionCents: 0, profitCents: null, reason: "no_cost_data" };
  }

  const safeTotal = Math.max(0, totalCents || 0);
  const safeCost = Math.max(0, costCents || 0);
  const profitCents = Math.max(0, safeTotal - safeCost);

  if (profitCents <= 0) {
    return { commissionCents: 0, profitCents: 0, reason: "negative_profit" };
  }

  const rate = Math.max(0, commissionPercent || 0);
  const commissionCents = Math.floor((profitCents * rate) / 100);

  if (commissionCents === 0) {
    return { commissionCents: 0, profitCents, reason: "zero_commission" };
  }

  return {
    commissionCents,
    profitCents,
    reason: "ok",
  };
}
