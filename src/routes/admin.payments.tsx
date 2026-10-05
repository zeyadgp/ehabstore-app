import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  HelpCircle,
  Info,
  Plus,
  QrCode,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  Wallet,
  XCircle,
} from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/admin";
import { SmartImage } from "@/components/SmartImage";
import { useAllPaymentMethods, type PaymentMethod } from "@/lib/payments";
import { useAdmin } from "@/hooks/useAdmin";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({
    meta: [{ title: "طرق الدفع | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPayments,
});

const POPULAR_YEMEN_PRESETS = [
  {
    name: "حساب بنك الكريمي (حاسب)",
    icon: "🏦",
    instructions: "يرجى التحويل إلى حساب الكريمي المميز وإرفاق الإشعار",
  },
  {
    name: "محفظة ون كاش (OneCash)",
    icon: "📱",
    instructions: "التحويل عبر رقم محفظة ون كاش فوراً",
  },
  {
    name: "محفظة جايبي (Jaib)",
    icon: "💳",
    instructions: "التحويل المباشر عبر جايبي لتأكيد فوري للطلب",
  },
  {
    name: "محفظة كاش (فلوسك / كاش)",
    icon: "💰",
    instructions: "إرسال المبلغ إلى رقم حساب المحفظة",
  },
  {
    name: "الدفع عند الاستلام (COD)",
    icon: "💵",
    instructions: "السداد نقداً لمندوب التوصيل عند استلام الطلب",
  },
];

function AdminPayments() {
  const qc = useQueryClient();
  const { data: methods = [], isLoading } = useAllPaymentMethods();
  const { can, isViewer, isAddOnly } = useAdmin();
  const canAdd = can("add_payments") && !isViewer;
  const canEdit = can("manage_payments") && !isViewer && !isAddOnly;
  const canDelete = can("delete_payments") && !isViewer && !isAddOnly;

  const [busy, setBusy] = useState(false);
  const [newMethodName, setNewMethodName] = useState("");
  const [newMethodIcon, setNewMethodIcon] = useState("💳");
  const [newMethodAccount, setNewMethodAccount] = useState("");
  const [newMethodInstructions, setNewMethodInstructions] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["payment-methods"] });

  const patch = async (m: PaymentMethod, values: Partial<PaymentMethod>) => {
    setBusy(true);
    const { error } = await supabase
      .from("payment_methods")
      .update(values as never)
      .eq("id", m.id);
    setBusy(false);
    if (error) {
      toast.error(`فشل الحفظ: ${error.message}`);
      return;
    }
    toast.success("تم تحديث طريقة الدفع بنجاح");
    await refresh();
  };

  const addPreset = async (preset: (typeof POPULAR_YEMEN_PRESETS)[0]) => {
    const exists = methods.some(
      (m) => m.name.trim().toLowerCase() === preset.name.trim().toLowerCase(),
    );
    if (exists) {
      toast.info(`طريقة "${preset.name}" مضافة بالفعل`);
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("payment_methods").insert({
      name: preset.name,
      icon: preset.icon,
      instructions: preset.instructions,
      sort_order: methods.length,
      is_active: true,
    } as never);
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`تمت إضافة "${preset.name}" بنجاح`);
    await refresh();
  };

  const handleCreateNew = async () => {
    if (!newMethodName.trim()) {
      toast.error("يرجى إدخال اسم طريقة الدفع");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("payment_methods").insert({
      name: newMethodName.trim(),
      icon: newMethodIcon.trim() || "💳",
      account_details: newMethodAccount.trim() || null,
      instructions: newMethodInstructions.trim() || null,
      sort_order: methods.length,
      is_active: true,
    } as never);
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("تمت إضافة طريقة الدفع بنجاح");
    setNewMethodName("");
    setNewMethodAccount("");
    setNewMethodInstructions("");
    setShowAddModal(false);
    await refresh();
  };

  const remove = async (m: PaymentMethod) => {
    if (!confirm(`هل أنت متأكد من حذف طريقة الدفع "${m.name}"؟`)) return;
    const { error } = await supabase.from("payment_methods").delete().eq("id", m.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحذف بنجاح");
    await refresh();
  };

  const uploadIcon = async (m: PaymentMethod, file: File) => {
    setBusy(true);
    try {
      const path = await uploadImage(file, "payments");
      await patch(m, { icon: path });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // إحصائيات وتشخيص الجاهزية
  const activeCount = methods.filter((m) => m.is_active).length;
  const configuredAccountsCount = methods.filter((m) => !!m.account_details?.trim()).length;
  const missingAccountCount = methods.filter(
    (m) =>
      m.is_active &&
      !m.name.includes("نقد") &&
      !m.name.includes("استلام") &&
      !m.account_details?.trim(),
  ).length;

  return (
    <div className="space-y-6">
      {/* الترويسة الرئيسية */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl flex items-center gap-2.5">
            <CreditCard className="h-7 w-7 text-primary" />
            <span>إدارة بوابات وطرق الدفع</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            تفعيل طرق السداد والتحويل البنكي، إدارة أرقام المحافظ والحسابات، وتعليمات الدفع للعملاء.
          </p>
        </div>

        {canAdd && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-2xl gradient-gold px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-soft transition-transform hover:opacity-95 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة طريقة دفع مخصصة</span>
            </button>
          </div>
        )}
      </div>

      {/* بطاقات Bento للإحصائيات والتشخيص */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">الطرق المفعلة</span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-display font-extrabold text-foreground">
            {activeCount}{" "}
            <span className="text-xs text-muted-foreground font-normal">
              من أصل {methods.length}
            </span>
          </p>
          <span className="text-[10px] text-emerald-600 font-bold">
            تظهر للعملاء في صفحة إتمام الطلب
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">الحسابات المكتملة</span>
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-display font-extrabold text-foreground">
            {configuredAccountsCount}
          </p>
          <span className="text-[10px] text-muted-foreground">تحتوي على رقم حساب أو محفظة</span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">تشخيص الجاهزية</span>
            <div
              className={`rounded-xl p-2 ${missingAccountCount === 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}
            >
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-display font-extrabold text-foreground">
            {missingAccountCount === 0 ? "100% جاهز" : `${missingAccountCount} بحاجة لرقم`}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {missingAccountCount === 0 ? "جميع الطرق الرقمية معرّفة" : "يرجى إكمال بيانات الحسابات"}
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">الدفع عند الاستلام</span>
            <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-display font-extrabold text-foreground">
            {methods.some(
              (m) => m.is_active && (m.name.includes("استلام") || m.name.includes("نقد")),
            )
              ? "مفعّل"
              : "موقوف"}
          </p>
          <span className="text-[10px] text-muted-foreground">تسليم نقدي لمندوب الشحن</span>
        </div>
      </div>

      {/* تنبيه التشخيص إذا لم تكن هناك طرق دفع نشطة */}
      {activeCount === 0 && !isLoading && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-400 animate-in fade-in-50">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="text-xs">
            <p className="font-extrabold">
              تنبيه حرج: لا توجد أي طريقة دفع مفعلة في المتجر حالياً!
            </p>
            <p className="mt-0.5 text-[11px] opacity-90">
              لن يتمكن العملاء من إتمام الطلبات في المتجر. يرجى تفعيل طريقة واحدة على الأقل أو
              استخدام القوالب السريعة أدناه.
            </p>
          </div>
        </div>
      )}

      {/* شريط القوالب السريعة الشائعة في اليمن */}
      {canAdd && (
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <StoreLogo className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-extrabold text-foreground">
                القوالب الجاهزة لطرق الدفع في اليمن
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground">إضافة بضغطة زر واحدة</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {POPULAR_YEMEN_PRESETS.map((preset) => {
              const isAdded = methods.some(
                (m) => m.name.trim().toLowerCase() === preset.name.trim().toLowerCase(),
              );
              return (
                <button
                  key={preset.name}
                  type="button"
                  disabled={isAdded || busy}
                  onClick={() => addPreset(preset)}
                  className={`flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold transition-all ${
                    isAdded
                      ? "border-border/50 bg-secondary/50 text-muted-foreground cursor-not-allowed opacity-70"
                      : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-secondary active:scale-95"
                  }`}
                >
                  <span className="text-base">{preset.icon}</span>
                  <span>{preset.name}</span>
                  {isAdded ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 ms-1" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-primary ms-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* قائمة طرق الدفع الحالية بتصميم Bento Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-extrabold text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <span>طرق الدفع المعرفة ({methods.length})</span>
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {methods.map((m) => {
            return (
              <div
                key={m.id}
                className={`rounded-3xl border bg-card p-5 shadow-soft transition-all duration-200 hover:shadow-lift ${
                  m.is_active
                    ? "border-border hover:border-primary/40"
                    : "border-border/60 bg-card/60 opacity-80"
                }`}
              >
                {/* Header of the Card */}
                <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-3">
                    {m.icon && !/^\p{Extended_Pictographic}/u.test(m.icon) ? (
                      <SmartImage
                        paths={[m.icon]}
                        fallback="/favicon.png"
                        alt={m.name}
                        className="h-10 w-10 rounded-2xl border border-border object-contain p-1"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-xl">
                        {m.icon || "💳"}
                      </span>
                    )}

                    <div>
                      {canEdit ? (
                        <input
                          defaultValue={m.name}
                          onBlur={(e) =>
                            e.target.value.trim() !== m.name &&
                            patch(m, { name: e.target.value.trim() })
                          }
                          className="font-display text-sm font-extrabold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none transition-colors"
                          title="انقر لتعديل الاسم"
                        />
                      ) : (
                        <span className="font-display text-sm font-extrabold text-foreground">
                          {m.name}
                        </span>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        الترتيب في القائمة: #{m.sort_order}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => canEdit && patch(m, { is_active: !m.is_active })}
                      className={`rounded-full px-3 py-1 text-[11px] font-extrabold transition-colors ${
                        m.is_active
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                      } ${!canEdit ? "opacity-75 cursor-not-allowed" : ""}`}
                    >
                      {m.is_active ? "مفعّلة للعملاء" : "موقوفة مؤقتاً"}
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => remove(m)}
                        aria-label="حذف"
                        className="rounded-xl bg-destructive/10 p-2 text-destructive transition hover:bg-destructive/20 active:scale-95"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Account details and instructions */}
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1">
                      رقم الحساب أو المحفظة البنكية
                    </label>
                    <input
                      readOnly={!canEdit}
                      defaultValue={m.account_details ?? ""}
                      placeholder={
                        canEdit
                          ? "مثال: رقم حساب الكريمي 12345678 أو هاتف ون كاش 777123456"
                          : "لا يوجد"
                      }
                      onBlur={(e) =>
                        canEdit &&
                        e.target.value !== (m.account_details ?? "") &&
                        patch(m, { account_details: e.target.value })
                      }
                      className={`w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-xs font-mono font-bold text-foreground outline-none ${canEdit ? "focus:border-primary" : "opacity-80 cursor-default"}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1">
                      تعليمات السداد الموجهة للعميل
                    </label>
                    <textarea
                      readOnly={!canEdit}
                      defaultValue={m.instructions ?? ""}
                      placeholder={
                        canEdit
                          ? "تعليمات إضافية تظهر للعميل عند اختيار هذه الطريقة..."
                          : "لا توجد تعليمات"
                      }
                      rows={2}
                      onBlur={(e) =>
                        canEdit &&
                        e.target.value !== (m.instructions ?? "") &&
                        patch(m, { instructions: e.target.value })
                      }
                      className={`w-full rounded-2xl border border-border bg-background p-3 text-xs text-foreground outline-none resize-none ${canEdit ? "focus:border-primary" : "opacity-80 cursor-default"}`}
                    />
                  </div>

                  {/* Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-3 py-1.5 text-xs font-bold text-foreground transition hover:bg-secondary">
                          <Upload className="h-3.5 w-3.5 text-primary" />
                          <span>رفع شعار / أيقونة</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={busy}
                            onChange={(e) =>
                              e.target.files?.[0] && uploadIcon(m, e.target.files[0] as File)
                            }
                          />
                        </label>
                      )}

                      {canEdit && (
                        <input
                          defaultValue={
                            m.icon && /^\p{Extended_Pictographic}/u.test(m.icon) ? m.icon : ""
                          }
                          placeholder="إيموجي 🏦"
                          onBlur={(e) =>
                            e.target.value &&
                            e.target.value !== m.icon &&
                            patch(m, { icon: e.target.value })
                          }
                          className="w-20 rounded-xl border border-border bg-background px-2.5 py-1.5 text-center text-xs outline-none focus:border-primary"
                          title="رمز إيموجي بديل"
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">ترتيب العرض:</span>
                      {canEdit ? (
                        <input
                          type="number"
                          defaultValue={m.sort_order}
                          onBlur={(e) =>
                            Number(e.target.value) !== m.sort_order &&
                            patch(m, { sort_order: Number(e.target.value) })
                          }
                          className="w-14 rounded-xl border border-border bg-background px-2 py-1 text-center text-xs font-bold outline-none focus:border-primary"
                        />
                      ) : (
                        <span className="font-bold text-xs px-2 py-1">{m.sort_order}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {methods.length === 0 && !isLoading && (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
            <CreditCard className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-xs font-bold">لا توجد طرق دفع معرفة بعد</p>
            <p className="text-[11px] text-muted-foreground">
              اختر من القوالب الجاهزة أعلاه لإضافة طرق السداد فوراً.
            </p>
          </div>
        )}
      </div>

      {/* نافذة إضافة طريقة جديدة مخصصة */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in-50">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="font-display text-base font-extrabold text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span>إضافة طريقة دفع جديدة</span>
            </h3>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-muted-foreground mb-1">
                  اسم طريقة الدفع *
                </label>
                <input
                  value={newMethodName}
                  onChange={(e) => setNewMethodName(e.target.value)}
                  placeholder="مثال: بنك التضامن الإسلامي"
                  className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">أيقونة إيموجي</label>
                <input
                  value={newMethodIcon}
                  onChange={(e) => setNewMethodIcon(e.target.value)}
                  placeholder="مثال: 🏦 أو 💳 أو 📱"
                  className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">
                  رقم الحساب / المحفظة
                </label>
                <input
                  value={newMethodAccount}
                  onChange={(e) => setNewMethodAccount(e.target.value)}
                  placeholder="رقم الحساب أو الآيبان"
                  className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">تعليمات للعميل</label>
                <textarea
                  value={newMethodInstructions}
                  onChange={(e) => setNewMethodInstructions(e.target.value)}
                  placeholder="مثال: التحويل باسم المتجر وإرسال الإشعار لواتساب..."
                  rows={2}
                  className="w-full rounded-2xl border border-border bg-background p-3 outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/60 pt-4">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-2xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-secondary"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleCreateNew}
                className="flex items-center gap-1.5 rounded-2xl gradient-gold px-5 py-2 text-xs font-extrabold text-primary-foreground shadow-soft transition-transform hover:opacity-95 active:scale-95 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>حفظ الطريقة</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
