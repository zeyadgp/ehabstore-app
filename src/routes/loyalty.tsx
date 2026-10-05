import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Award, Copy, Crown, Gift, ShoppingBag, Ticket, CheckCircle2, Zap } from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import { toast } from "sonner";
import { getLoyaltyOverview, redeemReward, type LoyaltyOverview } from "@/lib/loyalty.functions";
import {
  LOYALTY_STORAGE_KEY,
  rewardLabel,
  useLoyaltyRewards,
  useLoyaltySettings,
  getCustomerVIPTier,
  VIP_TIERS,
} from "@/lib/loyalty";
import { normalizeYemeniPhone } from "@/lib/yemen";
import { ReferralCard } from "@/components/ReferralCard";

const title = "نادي الولاء | إيهاب ستور";
const description =
  "اجمع نقاط الولاء مع كل طلب من إيهاب ستور واستبدلها بكوبونات خصم ومكافآت — نادي ولاء إيهاب ستور للعناية والتجميل.";

export const Route = createFileRoute("/loyalty")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:image", content: "https://www.ehabstore.app/icon-512.png" },
      { name: "twitter:image", content: "https://www.ehabstore.app/icon-512.png" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app/loyalty" }],
  }),
  component: LoyaltyPage,
});

const txLabel: Record<string, string> = {
  pending: "بانتظار التأكيد",
  earn: "نقاط مكتسبة",
  redeem: "استبدال نقاط",
  adjust: "تعديل إداري",
  coupon: "استخدام كوبون",
  cancelled: "ملغاة",
};

function LoyaltyPage() {
  const lookup = useServerFn(getLoyaltyOverview);
  const redeem = useServerFn(redeemReward);
  const navigate = useNavigate();
  const { data: rewards = [] } = useLoyaltyRewards();
  const { data: settings } = useLoyaltySettings();
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<LoyaltyOverview | null>(null);
  const [loading, setLoading] = useState(false);

  const currency = settings?.base_currency ?? "YER";

  const load = async (value: string) => {
    const normalized = normalizeYemeniPhone(value);
    if (normalized.length < 9) {
      toast.error("أدخل رقم جوال صحيح");
      return;
    }
    setLoading(true);
    try {
      const res = await lookup({ data: { phone: normalized } });
      setData(res);
      localStorage.setItem(LOYALTY_STORAGE_KEY, normalized);
      if (!res.found) toast.info("لا يوجد رصيد نقاط لهذا الرقم بعد — أول طلب يبدأ رصيدك");
    } catch {
      toast.error("تعذّر جلب الرصيد، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(LOYALTY_STORAGE_KEY);
    if (saved) {
      setPhone(saved);
      void load(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const points = data?.points ?? 0;
  const nextReward =
    rewards.find((r) => r.points_required > points) ?? rewards[rewards.length - 1] ?? null;
  const progress = nextReward
    ? Math.min(100, Math.round((points / Math.max(1, nextReward.points_required)) * 100))
    : 0;

  const doRedeem = async (rewardId: string) => {
    if (!data?.phone) return;
    try {
      const res = await redeem({ data: { phone: data.phone, rewardId } });
      toast.success(`تم إنشاء كوبونك: ${res.code}`, {
        action: {
          label: "استخدم في السلة",
          onClick: () => navigate({ to: "/checkout", search: { coupon: res.code } }),
        },
      });
      await load(data.phone);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الاستبدال");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl gradient-gold p-6 text-primary-foreground shadow-soft">
        <p className="flex items-center gap-2 text-sm font-bold">
          <StoreLogo className="h-4 w-4 text-primary-foreground" /> نادي ولاء إيهاب ستور
        </p>
        <h1 className="mt-2 text-2xl font-extrabold">
          نادي الولاء: اجمع نقاطك واستبدلها بمكافآت وخصومات
        </h1>
        <p className="mt-2 text-xs opacity-90">
          كل {Number(settings?.amount_per_point ?? 1000).toLocaleString("en-US")} {currency} من
          مشترياتكِ = نقطة واحدة. النقاط تُعتمد بعد استلام الطلب وتُستبدل بكوبونات خصم فورية.
        </p>
      </div>

      <div className="mt-4">
        <ReferralCard />
      </div>

      <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <label className="mb-1.5 block text-sm font-bold">رقم جوالك (نفس رقم الطلبات)</label>
        <div className="flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            dir="ltr"
            inputMode="tel"
            placeholder="770000000"
            maxLength={20}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => void load(phone)}
            disabled={loading}
            className="shrink-0 rounded-xl gradient-gold px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "..." : "عرض النقاط"}
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-border bg-card p-5 text-center shadow-soft">
              <Award className="mx-auto h-5 w-5 text-primary" />
              <p className="mt-2 text-2xl font-extrabold">{points}</p>
              <p className="text-xs text-muted-foreground">نقطة متاحة</p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5 text-center shadow-soft">
              <Gift className="mx-auto h-5 w-5 text-rose" />
              <p className="mt-2 text-2xl font-extrabold">{data.pendingPoints}</p>
              <p className="text-xs text-muted-foreground">نقاط بانتظار التأكيد</p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5 text-center shadow-soft">
              <Ticket className="mx-auto h-5 w-5 text-primary" />
              <p className="mt-2 text-2xl font-extrabold">
                {data.coupons.filter((c) => c.status === "available").length}
              </p>
              <p className="text-xs text-muted-foreground">كوبون متاح</p>
            </div>
          </div>

          {!data.owner && (
            <div className="mt-4 rounded-3xl border border-border bg-card p-5 text-center shadow-soft">
              <p className="text-sm font-bold">لعرض سجل نقاطك وكوبوناتك واستبدال المكافآت</p>
              <p className="mt-1 text-xs text-muted-foreground">
                سجّل الدخول بحسابك المرتبط بهذا الرقم — الرصيد فقط يظهر بدون تسجيل دخول لحماية
                خصوصية العملاء.
              </p>
              <Link
                to="/account"
                className="mt-3 inline-block rounded-xl gradient-gold px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                تسجيل الدخول
              </Link>
            </div>
          )}

          {/* بطاقة عضوية VIP ومستوى الترقية التلقائي */}
          {(() => {
            const vip = getCustomerVIPTier(points);
            return (
              <div className="mt-4 rounded-3xl border border-border bg-card p-6 shadow-soft space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${vip.current.badgeGradient} shadow-md`}
                    >
                      <Crown className="h-6 w-6" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-foreground">{vip.current.name}</h3>
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-black text-primary">
                          {vip.current.pointsMultiplier}x مضاعف نقاط
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        رصيدك الحالي: <strong className="text-foreground">{points}</strong> نقطة
                      </p>
                    </div>
                  </div>
                  {vip.current.discountPercent > 0 && (
                    <span className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary">
                      خصم إضافي دائم {vip.current.discountPercent}%
                    </span>
                  )}
                </div>

                {/* شريط التقدم للترقية إلى الفئة التالية */}
                {vip.next ? (
                  <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-foreground">
                        الترقية القادمة إلى:{" "}
                        <strong className="text-primary">{vip.next.name}</strong>
                      </span>
                      <span className="text-muted-foreground">باقي {vip.pointsToNext} نقطة</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full gradient-gold transition-all duration-500"
                        style={{ width: `${vip.progress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      متبقي لك {vip.pointsToNext} نقطة لتصل إلى {vip.next.name} وتضاعف نقاطك إلى{" "}
                      {vip.next.pointsMultiplier}x مع مزايا استثنائية!
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-center text-xs font-bold text-primary">
                    👑 تهانينا! أنت في أعلى فئة عضوية VIP (نخبة إيهاب ستور) وتتمتع بأقصى المزايا
                    والخصومات والشحن المجاني الدائم.
                  </div>
                )}

                {/* مزايا فئتك الحالية */}
                <div>
                  <h4 className="text-xs font-extrabold text-foreground mb-2">
                    المزايا المفعلة لعضويتك الآن:
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {vip.current.perks.map((perk, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{perk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {nextReward && (
            <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>المكافأة القادمة: {nextReward.name}</span>
                <span className="text-primary">
                  {points}/{nextReward.points_required}
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full gradient-gold transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {points >= nextReward.points_required
                  ? "مبروك! تقدر تستبدل مكافأتك الآن."
                  : `باقي ${nextReward.points_required - points} نقطة للوصول للمكافأة.`}
              </p>
            </div>
          )}

          <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-base font-bold">المكافآت المتاحة</h2>
            <ul className="mt-3 space-y-2">
              {rewards.map((r) => {
                const can = data.owner && points >= r.points_required;
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.description ?? rewardLabel(r, currency)} · {r.points_required} نقطة
                      </p>
                    </div>
                    <button
                      onClick={() => void doRedeem(r.id)}
                      disabled={!can}
                      className="rounded-xl gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40"
                    >
                      استبدال
                    </button>
                  </li>
                );
              })}
              {rewards.length === 0 && (
                <li className="py-4 text-center text-xs text-muted-foreground">
                  لا توجد مكافآت حالياً
                </li>
              )}
            </ul>
          </div>

          {data.coupons.length > 0 && (
            <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
              <h2 className="text-base font-bold">كوبوناتي</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.coupons.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-2xl border border-border p-3"
                  >
                    <span dir="ltr" className="font-extrabold text-primary">
                      {c.code}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.discount_type === "percent"
                        ? `خصم ${c.discount_value}%`
                        : `خصم ${c.discount_value.toLocaleString("en-US")} ${currency}`}
                    </span>
                    <span className="ms-auto text-[11px] text-muted-foreground">
                      {c.status === "available" ? "متاح" : c.status === "used" ? "مستخدم" : "منتهي"}
                    </span>
                    {c.status === "available" && (
                      <div className="flex items-center gap-1.5">
                        <Link
                          to="/checkout"
                          search={{ coupon: c.code }}
                          className="flex items-center gap-1 rounded-xl gradient-gold px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-soft transition-transform hover:opacity-95 active:scale-95"
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          <span>استخدم في الدفع</span>
                        </Link>
                        <button
                          onClick={() => {
                            void navigator.clipboard.writeText(c.code);
                            toast.success("تم نسخ الكوبون");
                          }}
                          className="rounded-xl border border-border p-2 text-foreground transition-colors hover:bg-secondary"
                          aria-label="نسخ الكوبون"
                          title="نسخ الكود"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-base font-bold">سجل النقاط</h2>
            <ul className="mt-3 divide-y divide-border text-sm">
              {data.transactions.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="font-bold">{txLabel[t.type] ?? t.type}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.description ?? (t.order_number ? `الطلب #${t.order_number}` : "")}
                    </span>
                  </span>
                  <span
                    className={`font-extrabold ${t.points < 0 ? "text-destructive" : "text-primary"}`}
                  >
                    {t.points > 0 ? `+${t.points}` : t.points}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("ar-EG")}
                  </span>
                </li>
              ))}
              {data.transactions.length === 0 && (
                <li className="py-4 text-center text-xs text-muted-foreground">لا يوجد سجل بعد</li>
              )}
            </ul>
          </div>
        </>
      )}

      {/* عرض كافة فئات ومستويات عضوية VIP */}
      <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Crown className="h-5 w-5 text-amber-500" />
          <div>
            <h2 className="text-base font-black text-foreground">
              مستويات عضوية النخبة VIP ومزايا الترقية التلقائية
            </h2>
            <p className="text-xs text-muted-foreground">
              ترقية عضويتك تتم تلقائياً بمجرد وصول نقاطك للحد المطلوب للاستمتاع بخصومات ومضاعفات
              نقاط أكبر
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {VIP_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-2xl border ${tier.borderColor} bg-muted/20 p-4 space-y-3 transition-all hover:bg-muted/40`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r ${tier.badgeGradient} px-3 py-1 text-xs font-black shadow-sm`}
                >
                  <Crown className="h-3.5 w-3.5" /> {tier.name}
                </span>
                <span className="text-xs font-extrabold text-foreground">
                  من {tier.minPoints.toLocaleString("en-US")} نقطة
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-primary">
                  مضاعف {tier.pointsMultiplier}x
                </span>
                {tier.discountPercent > 0 && (
                  <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                    خصم {tier.discountPercent}% إضافي
                  </span>
                )}
                {tier.freeShipping && (
                  <span className="rounded-lg bg-indigo-500/10 px-2 py-0.5 text-indigo-600 dark:text-indigo-400">
                    شحن مجاني
                  </span>
                )}
              </div>

              <ul className="space-y-1.5 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                {tier.perks.map((p, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/products" className="font-bold text-primary">
          تسوّق الآن واكسب نقاطك
        </Link>
      </div>
    </div>
  );
}
