import { Truck, CheckCircle2, Check } from "lucide-react";
import { formatMoney } from "@/lib/store";
import { useCurrency } from "@/lib/currency";

export const DEFAULT_FREE_SHIPPING_THRESHOLD = 25000; // 25,000 ريال يمني أو ما يعادله

interface FreeShippingBarProps {
  currentAmount: number;
  threshold?: number;
  className?: string;
  compact?: boolean;
}

export function FreeShippingBar({
  currentAmount,
  threshold = DEFAULT_FREE_SHIPPING_THRESHOLD,
  className = "",
  compact = false,
}: FreeShippingBarProps) {
  const { symbol, currencies, code } = useCurrency();
  const activeCurrency = currencies.find((c) => c.code === code);
  const currencySymbol = activeCurrency?.symbol || symbol || "ر.ي";

  const diff = Math.max(0, threshold - currentAmount);
  const percentage = Math.min(100, Math.round((currentAmount / threshold) * 100));
  const isQualified = currentAmount >= threshold;

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isQualified
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
          : "border-primary/20 bg-primary/5 text-foreground"
      } ${compact ? "p-3" : "p-4"} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-extrabold sm:text-sm">
        <div className="flex items-center gap-2">
          {isQualified ? (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-soft">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <Truck className="h-4 w-4" />
            </span>
          )}

          <span>
            {isQualified ? (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4 stroke-[3]" />
                <span>تهانينا! طلبك مؤهل للتوصيل المجاني بالكامل 🎉</span>
              </span>
            ) : (
              <span>
                أضف{" "}
                <strong className="font-display font-black text-primary underline">
                  {formatMoney(diff, currencySymbol)}
                </strong>{" "}
                إضافية للحصول على <span className="font-black text-primary">توصيل مجاني 🚚</span>
              </span>
            )}
          </span>
        </div>

        <span className="shrink-0 font-mono text-xs font-black tabular-nums text-muted-foreground">
          {percentage}%
        </span>
      </div>

      {/* شريط التقدم التفاعلي */}
      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-secondary/80">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isQualified ? "bg-emerald-500" : "gradient-gold"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
