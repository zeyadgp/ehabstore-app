import { csvSafe } from "@/lib/csv-safe";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Download, Gift, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adjustPoints, getDevCommission } from "@/lib/loyalty.functions";
import { CouponsManager } from "@/components/admin/CouponsManager";
import {
  CollapsibleCard,
  EmptyState,
  PageHeader,
  StatCard,
  adminBtn,
  adminInput,
} from "@/components/admin/ui/AdminUI";
import { useAdminCurrency } from "@/lib/admin";
import {
  useLoyaltyRewards,
  useLoyaltySettings,
  VIP_TIERS,
  type LoyaltyReward,
  type LoyaltySettingsRow,
} from "@/lib/loyalty";

export const Route = createFileRoute("/admin/loyalty")({
  head: () => ({
    meta: [{ title: "برنامج الولاء | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminLoyalty,
});

type Account = {
  id: string;
  phone: string;
  customer_name: string | null;
  points: number;
  pending_points: number;
  total_spent: number;
};

function useAccounts() {
  return useQuery({
    queryKey: ["admin", "loyalty-accounts"],
    queryFn: async (): Promise<Account[]> => {
      const { data } = await supabase
        .from("loyalty_accounts")
        .select("id, phone, customer_name, points, pending_points, total_spent")
        .order("points", { ascending: false })
        .limit(200);
      return (data as Account[] | null) ?? [];
    },
  });
}

function AdminLoyalty() {
  const qc = useQueryClient();
  const { label: cur } = useAdminCurrency();
  const { data: settings } = useLoyaltySettings();
  const loadDevCommission = useServerFn(getDevCommission);
  const { data: devCommission } = useQuery({
    queryKey: ["loyalty", "dev-commission"],
    queryFn: () => loadDevCommission({ data: {} }),
    staleTime: 60_000,
  });
  const { data: rewards = [] } = useLoyaltyRewards();
  const { data: accounts = [] } = useAccounts();
  const adjust = useServerFn(adjustPoints);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Account | null>(null);
  const [adjustPointsValue, setAdjustPointsValue] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [adjusting, setAdjusting] = useState<boolean>(false);
  const [reward, setReward] = useState({
    name: "",
    points_required: 100,
    discount_type: "amount",
    discount_value: 1000,
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["loyalty"] });
    await qc.invalidateQueries({ queryKey: ["admin", "loyalty-accounts"] });
  };

  const saveSettings = async (patch: Partial<LoyaltySettingsRow>) => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("loyalty_settings")
      .update(patch as never)
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حفظ التعديلات بنجاح");
    await refresh();
  };

  const addReward = async () => {
    if (!reward.name.trim()) {
      toast.error("اسم المكافأة مطلوب");
      return;
    }
    const { error } = await supabase.from("loyalty_rewards").insert({
      name: reward.name.trim(),
      points_required: Number(reward.points_required),
      discount_type: reward.discount_type,
      discount_value: Number(reward.discount_value),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setReward({ name: "", points_required: 100, discount_type: "amount", discount_value: 1000 });
    toast.success("تمت إضافة المكافأة");
    await refresh();
  };

  const removeReward = async (r: LoyaltyReward) => {
    const { error } = await supabase.from("loyalty_rewards").delete().eq("id", r.id);
    setDeleteConfirmId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حذف المكافأة");
    await refresh();
  };

  const submitAdjustPoints = async () => {
    if (!adjustTarget) return;
    if (adjustPointsValue === 0) {
      toast.error("يرجى تحديد عدد النقاط المراد إضافتها أو خصمها");
      return;
    }
    setAdjusting(true);
    try {
      await adjust({
        data: {
          phone: adjustTarget.phone,
          points: Math.trunc(adjustPointsValue),
          reason: adjustReason.trim() || undefined,
        },
      });
      toast.success("تم تعديل النقاط بنجاح");
      setAdjustTarget(null);
      setAdjustPointsValue(50);
      setAdjustReason("");
      await refresh();
    } catch {
      toast.error("تعذّر تعديل النقاط");
    } finally {
      setAdjusting(false);
    }
  };

  const exportAccountsCSV = () => {
    if (accounts.length === 0) {
      toast.info("لا توجد حسابات للتصدير");
      return;
    }
    const headers = [
      "اسم العميل",
      "رقم الجوال",
      "النقاط المتاحة",
      "النقاط المعلقة",
      "إجمالي المشتريات",
    ];
    const rows = accounts.map((a) => [
      `"${(a.customer_name ?? "عميل").replace(/"/g, '""')}"`,
      `"${a.phone}"`,
      a.points,
      a.pending_points,
      a.total_spent,
    ]);
    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.map(csvSafe).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `loyalty-members-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير قائمة عملاء الولاء بنجاح");
  };

  const input = adminInput;

  const filtered = accounts.filter((a) => {
    const q = search.trim();
    if (!q) return true;
    return (a.customer_name ?? "").includes(q) || a.phone.includes(q);
  });
  const totalPoints = accounts.reduce((s, a) => s + Number(a.points), 0);
  const totalSpent = accounts.reduce((s, a) => s + Number(a.total_spent), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Gift}
        title="برنامج الولاء"
        subtitle="اضبط قواعد النقاط والمكافآت وتابع أرصدة العملاء"
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatCard label="عملاء البرنامج" value={accounts.length} tone="primary" />
        <StatCard label="إجمالي النقاط" value={totalPoints.toLocaleString("ar")} />
        <StatCard
          label="مشتريات الأعضاء"
          value={`${Math.round(totalSpent).toLocaleString("ar")} ${cur}`}
        />
        <StatCard label="المكافآت المتاحة" value={rewards.length} tone="warning" />
      </div>

      <CollapsibleCard title="مستويات عضوية VIP والترقيات التلقائية (Tiered VIP Club)" defaultOpen>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            يتم ترقية رتبة العميل تلقائياً بمجرد تراكم نقاطه للحد المخصص. تمنح كل فئة مضاعفات نقاط
            وخصومات وشحناً مجانياً.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {VIP_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`rounded-2xl border ${tier.borderColor} bg-muted/20 p-4 space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg bg-gradient-to-r ${tier.badgeGradient} px-2.5 py-1 text-[11px] font-black shadow-sm`}
                  >
                    <Crown className="h-3 w-3" /> {tier.name}
                  </span>
                  <span className="text-[11px] font-bold text-foreground">
                    {tier.minPoints}+ نقطة
                  </span>
                </div>

                <div className="space-y-1 text-xs font-semibold text-foreground pt-1">
                  <div className="flex justify-between text-primary">
                    <span>مضاعف النقاط:</span>
                    <span>{tier.pointsMultiplier}x</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>الخصم الدائم:</span>
                    <span>{tier.discountPercent}%</span>
                  </div>
                  <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
                    <span>الشحن المجاني:</span>
                    <span>{tier.freeShipping ? "مفعّل" : "غير مفعّل"}</span>
                  </div>
                </div>

                <ul className="border-t border-border/60 pt-2 text-[10px] text-muted-foreground space-y-1">
                  {tier.perks.map((p, idx) => (
                    <li key={idx} className="truncate">
                      • {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="قواعد كسب واستبدال النقاط" defaultOpen>
        {settings && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-bold">
                مبلغ النقطة الواحدة ({settings.base_currency})
                <input
                  type="number"
                  defaultValue={settings.amount_per_point}
                  onBlur={(e) =>
                    void saveSettings({ amount_per_point: Number(e.target.value) || 1 })
                  }
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  كل كم {settings.base_currency} مشتريات تمنح نقطة واحدة.
                </span>
              </label>
              <label className="text-xs font-bold">
                الحد الأدنى للاستبدال
                <input
                  type="number"
                  defaultValue={settings.min_redeem_points}
                  onBlur={(e) =>
                    void saveSettings({ min_redeem_points: Number(e.target.value) || 1 })
                  }
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  أقل رصيد نقاط يُسمح بالبدء باستبداله.
                </span>
              </label>
              <label className="text-xs font-bold">
                قيمة النقطة ({settings.base_currency})
                <input
                  type="number"
                  defaultValue={settings.point_value}
                  onBlur={(e) => void saveSettings({ point_value: Number(e.target.value) || 0 })}
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  القيمة المالية لكل نقطة عند تحويلها لخصم.
                </span>
              </label>
              <label className="text-xs font-bold">
                الحد الأقصى للنقاط لكل عميل
                <input
                  type="number"
                  defaultValue={settings.max_points ?? 10000}
                  onBlur={(e) => void saveSettings({ max_points: Number(e.target.value) || 10000 })}
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  أقصى رصيد نقاط يمكن للعميل تجميعه.
                </span>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-bold">
                الحد الأدنى للطلب لتطبيق الكوبون ({settings.base_currency})
                <input
                  type="number"
                  defaultValue={settings.unlock_min_order ?? 0}
                  onBlur={(e) =>
                    void saveSettings({ unlock_min_order: Number(e.target.value) || 0 })
                  }
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  0 يعني يمكن تطبيق الكوبون على أي قيمة طلب.
                </span>
              </label>
              <label className="text-xs font-bold">
                سياسة النقاط عند الإلغاء أو الإرجاع
                <select
                  defaultValue={settings.refund_policy ?? "deduct"}
                  onChange={(e) => void saveSettings({ refund_policy: e.target.value })}
                  className={`mt-1 ${input}`}
                >
                  <option value="deduct">خصم النقاط المكتسبة تلقائياً</option>
                  <option value="keep">إبقاء النقاط كبادرة إرضاء</option>
                </select>
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  معالجة النقاط عند إلغاء أو إرجاع طلب.
                </span>
              </label>
              <div className="flex flex-col justify-center space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={settings.is_active}
                    onChange={(e) => void saveSettings({ is_active: e.target.checked })}
                    className="rounded border-border accent-primary"
                  />
                  <span>تفعيل نادي الولاء بالكامل في المتجر</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={settings.allow_partial_redeem ?? false}
                    onChange={(e) => void saveSettings({ allow_partial_redeem: e.target.checked })}
                    className="rounded border-border accent-primary"
                  />
                  <span>السماح بالاستبدال الجزئي للنقاط</span>
                </label>
              </div>
            </div>
          </div>
        )}
        {saving && <p className="mt-2 text-xs text-muted-foreground animate-pulse">جاري الحفظ…</p>}
      </CollapsibleCard>

      <CollapsibleCard title="نظام الإحالة ودعوة الأصدقاء (Referrals)" defaultOpen>
        {settings && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={settings.referral_enabled ?? true}
                  onChange={(e) => void saveSettings({ referral_enabled: e.target.checked })}
                  className="rounded border-border accent-primary"
                />
                <span>تفعيل نظام الإحالة (يظهر رابط الإحالة لجميع العملاء المسجلين)</span>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold">
                نقاط الداعي (المُحيل) عند طلب الصديق
                <input
                  type="number"
                  defaultValue={settings.referral_referrer_points ?? 50}
                  onBlur={(e) =>
                    void saveSettings({ referral_referrer_points: Number(e.target.value) || 0 })
                  }
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  تُضاف لرصيد الداعي بعد إتمام أول طلب ناجح للمدعو.
                </span>
              </label>
              <label className="text-xs font-bold">
                نقاط الترحيب للمدعو (العميل الجديد)
                <input
                  type="number"
                  defaultValue={settings.referral_invitee_points ?? 25}
                  onBlur={(e) =>
                    void saveSettings({ referral_invitee_points: Number(e.target.value) || 0 })
                  }
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  تُضاف فوراً لحساب العميل الجديد عند التسجيل برابط إحالة.
                </span>
              </label>
              <label className="text-xs font-bold">
                نسبة عمولة الداعي من مشتريات المدعو (%)
                <input
                  type="number"
                  defaultValue={settings.referral_commission_percent ?? 5}
                  onBlur={(e) =>
                    void saveSettings({ referral_commission_percent: Number(e.target.value) || 0 })
                  }
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  نسبة مئوية إضافية تُمنح كنقاط من قيمة طلبات الصديق.
                </span>
              </label>
            </div>
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard title="نقاط الحضور اليومي والسلاسل (Daily Login Streak)">
        {settings && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={settings.daily_enabled ?? false}
                onChange={(e) => void saveSettings({ daily_enabled: e.target.checked })}
                className="rounded border-border accent-primary"
              />
              <span>تفعيل مكافأة تسجيل الدخول اليومي للعملاء</span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-bold">
                نقاط اليوم الأول
                <input
                  type="number"
                  defaultValue={settings.daily_start_points ?? 5}
                  onBlur={(e) =>
                    void saveSettings({ daily_start_points: Number(e.target.value) || 1 })
                  }
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  نقاط البداية في أول يوم تسجيل دخول.
                </span>
              </label>
              <label className="text-xs font-bold">
                الحد الأقصى للنقاط اليومية
                <input
                  type="number"
                  defaultValue={settings.daily_max_points ?? 30}
                  onBlur={(e) =>
                    void saveSettings({ daily_max_points: Number(e.target.value) || 10 })
                  }
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  سقف النقاط التي يمكن الحصول عليها يومياً في السلسلة.
                </span>
              </label>
              <label className="text-xs font-bold">
                أيام السماح قبل كسر السلسلة
                <input
                  type="number"
                  defaultValue={settings.daily_grace_days ?? 1}
                  onBlur={(e) =>
                    void saveSettings({ daily_grace_days: Number(e.target.value) || 0 })
                  }
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  المهلة المسموحة للغياب قبل إعادة تصفير السلسلة.
                </span>
              </label>
              <label className="text-xs font-bold">
                بعد بلوغ الحد الأقصى للسلسلة
                <select
                  defaultValue={settings.daily_after_max ?? "keep_max"}
                  onChange={(e) => void saveSettings({ daily_after_max: e.target.value })}
                  className={`mt-1 ${input}`}
                >
                  <option value="keep_max">الاستمرار بمنح الحد الأقصى يومياً</option>
                  <option value="restart">إعادة السلسلة من اليوم الأول</option>
                </select>
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  ما يحدث عند استمرار الدخول بعد أعلى مستوى.
                </span>
              </label>
            </div>
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard title="صلاحية النقاط والكوبونات وتنبيهات الانتهاء">
        {settings && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-bold">
                صلاحية الكوبون المستبدل (أيام)
                <input
                  type="number"
                  defaultValue={settings.coupon_expiry_days}
                  onBlur={(e) =>
                    void saveSettings({ coupon_expiry_days: Number(e.target.value) || 30 })
                  }
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  فترة صلاحية كود الخصم بعد استبداله من النقاط.
                </span>
              </label>
              <label className="text-xs font-bold">
                صلاحية النقاط (أشهر)
                <input
                  type="number"
                  defaultValue={settings.expiry_months ?? 12}
                  onBlur={(e) => void saveSettings({ expiry_months: Number(e.target.value) || 0 })}
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  0 يعني نقاط دائمة لا تنتهي صلاحيتها.
                </span>
              </label>
              <label className="text-xs font-bold">
                أساس احتساب انتهاء الصلاحية
                <select
                  defaultValue={settings.expiry_basis ?? "from_earn"}
                  onChange={(e) => void saveSettings({ expiry_basis: e.target.value })}
                  className={`mt-1 ${input}`}
                >
                  <option value="from_earn">من تاريخ كسب كل نقطة</option>
                  <option value="from_last_activity">من تاريخ آخر نشاط / طلب للعميل</option>
                </select>
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  طريقة تحديد موعد انتهاء النقاط.
                </span>
              </label>
              <div className="flex items-center">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={settings.expiry_notify ?? true}
                    onChange={(e) => void saveSettings({ expiry_notify: e.target.checked })}
                    className="rounded border-border accent-primary"
                  />
                  <span>إرسال إشعار تنبيهي للعميل قبل انتهاء النقاط بـ 7 أيام</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard title="عمولة التطوير (Developer Commission)">
        {settings && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                key={`dc-${String(devCommission?.enabled)}`}
                defaultChecked={devCommission?.enabled ?? false}
                onChange={(e) => void saveSettings({ dev_commission_enabled: e.target.checked })}
                className="rounded border-border accent-primary"
              />
              <span>تفعيل عمولة التطوير التقني</span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">
                نسبة عمولة التطوير (%)
                <input
                  type="number"
                  step="0.1"
                  key={`dp-${String(devCommission?.percent)}`}
                  defaultValue={devCommission?.percent ?? 1}
                  onBlur={(e) =>
                    void saveSettings({ dev_commission_percent: Number(e.target.value) || 0 })
                  }
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  نسبة مئوية مخصصة للمطور من حجم المعاملات أو المشتريات.
                </span>
              </label>
              <label className="text-xs font-bold">
                حساب أو رقم تحويل العمولة
                <input
                  type="text"
                  key={`da-${devCommission?.account ?? ""}`}
                  defaultValue={devCommission?.account ?? ""}
                  onBlur={(e) =>
                    void saveSettings({ dev_commission_account: e.target.value.trim() || null })
                  }
                  placeholder="رقم المحفظة / الحساب البنكي"
                  className={`mt-1 ${input}`}
                />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                  بيانات حساب التحويل لعمولة التطوير.
                </span>
              </label>
            </div>
          </div>
        )}
      </CollapsibleCard>

      <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
        <h2 className="text-sm font-bold">المكافآت ({rewards.length})</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {rewards.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <span className="min-w-0 flex-1">
                <span className="font-bold">{r.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {r.points_required} نقطة ·{" "}
                  {r.discount_type === "percent"
                    ? `${r.discount_value}%`
                    : `${r.discount_value} ${settings?.base_currency ?? ""}`}
                </span>
              </span>
              {deleteConfirmId === r.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => void removeReward(r)}
                    className="rounded-xl bg-destructive px-2.5 py-1.5 text-xs font-bold text-destructive-foreground hover:opacity-90"
                  >
                    تأكيد
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="rounded-xl border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirmId(r.id)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                  aria-label="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
          {rewards.length === 0 && (
            <li>
              <EmptyState
                icon={Gift}
                title="لا توجد مكافآت"
                hint="أضف أول مكافأة يستبدل بها العملاء نقاطهم."
              />
            </li>
          )}
        </ul>

        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          <input
            value={reward.name}
            onChange={(e) => setReward((r) => ({ ...r, name: e.target.value }))}
            placeholder="اسم المكافأة"
            className={`sm:col-span-2 ${input}`}
          />
          <input
            type="number"
            value={reward.points_required}
            onChange={(e) => setReward((r) => ({ ...r, points_required: Number(e.target.value) }))}
            placeholder="النقاط"
            className={input}
          />
          <select
            value={reward.discount_type}
            onChange={(e) => setReward((r) => ({ ...r, discount_type: e.target.value }))}
            className={input}
          >
            <option value="amount">خصم مبلغ</option>
            <option value="percent">خصم نسبة %</option>
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              value={reward.discount_value}
              onChange={(e) => setReward((r) => ({ ...r, discount_value: Number(e.target.value) }))}
              className={input}
            />
            <button
              onClick={() => void addReward()}
              className="flex min-h-11 w-12 items-center justify-center rounded-xl gradient-gold text-primary-foreground"
              aria-label="إضافة مكافأة"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold">أرصدة العملاء ({accounts.length})</h2>
            <button
              onClick={exportAccountsCSV}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground shadow-soft transition-colors hover:bg-secondary active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>تصدير CSV</span>
            </button>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الجوال"
              className={`${input} ps-9`}
            />
          </div>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {filtered.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">{a.customer_name ?? "عميل"}</p>
                  <p dir="ltr" className="text-xs text-muted-foreground">
                    {a.phone}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-extrabold text-primary">{a.points} نقطة</p>
                  {a.pending_points > 0 && (
                    <p className="text-[11px] text-muted-foreground">{a.pending_points} معلّقة</p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  إجمالي المشتريات: {Math.round(Number(a.total_spent)).toLocaleString("ar")} {cur}
                </span>
                <button
                  onClick={() => {
                    setAdjustTarget(a);
                    setAdjustPointsValue(50);
                    setAdjustReason("");
                  }}
                  className={`${adminBtn} border border-border hover:border-primary hover:text-primary`}
                >
                  تعديل النقاط
                </button>
              </div>
            </li>
          ))}
          {filtered.length === 0 && (
            <li>
              <EmptyState
                icon={Gift}
                title="لا توجد حسابات نقاط"
                hint="تُنشأ الحسابات تلقائياً مع أول طلب للعميل."
              />
            </li>
          )}
        </ul>
      </section>

      <CouponsManager />

      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-extrabold text-foreground">
                  تعديل نقاط العميل
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {adjustTarget.customer_name ?? "عميل"} ·{" "}
                  <span dir="ltr">{adjustTarget.phone}</span>
                </p>
              </div>
              <button
                onClick={() => setAdjustTarget(null)}
                className="rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-border bg-secondary/50 p-3 text-center">
                <span className="text-xs text-muted-foreground">الرصيد الحالي</span>
                <p className="font-display text-xl font-extrabold text-primary">
                  {adjustTarget.points} نقطة
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-foreground">
                  عدد النقاط (موجب للإضافة أو سالب للخصم)
                </label>
                <input
                  type="number"
                  value={adjustPointsValue}
                  onChange={(e) => setAdjustPointsValue(Number(e.target.value))}
                  className={`w-full text-center font-bold text-base ${input}`}
                />
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {[10, 25, 50, 100, -20, -50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAdjustPointsValue(preset)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                        adjustPointsValue === preset
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background hover:bg-secondary"
                      }`}
                    >
                      {preset > 0 ? `+${preset}` : preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-foreground">
                  سبب التعديل (اختياري — يظهر في سجل المعاملات)
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="مثال: مكافأة عميل مميز / تصحيح رصيد"
                  className={input}
                />
              </div>

              <div className="flex items-center gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  disabled={adjusting || adjustPointsValue === 0}
                  onClick={() => void submitAdjustPoints()}
                  className="flex-1 rounded-2xl gradient-gold py-2.5 text-xs font-bold text-primary-foreground shadow-soft transition-transform hover:opacity-95 active:scale-95 disabled:opacity-50"
                >
                  {adjusting ? "جاري التعديل..." : "تأكيد التعديل"}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="rounded-2xl border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-secondary"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
