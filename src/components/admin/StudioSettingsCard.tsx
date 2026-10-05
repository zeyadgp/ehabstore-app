import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  Eye,
  EyeOff,
  PowerOff,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useStudioSettings, useSaveStudioSettings } from "@/lib/studio-settings";
import { DEFAULT_STUDIO_SETTINGS, type StudioSettings } from "@/lib/studio-settings.functions";
import { Checkbox } from "@/components/ui/checkbox";

export function StudioSettingsCard() {
  const { data: savedSettings, isLoading } = useStudioSettings();
  const saveMutation = useSaveStudioSettings();

  const [draft, setDraft] = useState<StudioSettings>(DEFAULT_STUDIO_SETTINGS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (savedSettings) {
      setDraft(savedSettings);
      setDirty(false);
    }
  }, [savedSettings]);

  const handleChange = <K extends keyof StudioSettings>(key: K, val: StudioSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(draft);
      setDirty(false);
      toast.success("تم حفظ إعدادات تعطيل وإخفاء تجربة المكياج بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر حفظ الإعدادات");
    }
  };

  const handleReset = () => {
    if (savedSettings) {
      setDraft(savedSettings);
      setDirty(false);
    }
  };

  const isCompletelyHiddenOrDisabled =
    draft.disabled || (draft.hidePromoCard && draft.hideFromHeader);

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-foreground">بطاقة صفحة تجربة المكياج</h2>
              {draft.disabled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-bold text-destructive">
                  <PowerOff className="h-3 w-3" /> معطلة
                </span>
              ) : isCompletelyHiddenOrDisabled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  <EyeOff className="h-3 w-3" /> مخفية
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> مفعّلة وظاهرة
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              خيارات إخفاء وتعطيل تجربة المكياج الافتراضية والبطاقة الترويجية في المتجر
            </p>
          </div>
        </div>

        {/* Quick action: Preview link (hidden when disabled) */}
        {!draft.disabled && (
          <div className="flex items-center gap-2">
            <Link
              to="/studio"
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary active:scale-95"
            >
              <span>معاينة الصفحة</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </div>
        )}
      </div>

      {/* Toggles List */}
      <div className="mt-4 space-y-3.5">
        {/* Toggle 1: Disable entire page */}
        <label
          className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-3.5 transition-colors ${
            draft.disabled
              ? "border-destructive/30 bg-destructive/5"
              : "border-border bg-secondary/30 hover:bg-secondary/50"
          }`}
        >
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <PowerOff
                className={`h-4 w-4 ${
                  draft.disabled ? "text-destructive" : "text-muted-foreground"
                }`}
              />
              <span className="text-xs font-bold text-foreground">
                تعطيل صفحة تجربة المكياج بالكامل
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              إيقاف وصول الزوار لصفحة استوديو المكياج (/studio) وعرض رسالة تعذر مؤقتة مع توجيههم
              لمنتجات المتجر.
            </p>
          </div>
          <Checkbox
            checked={draft.disabled}
            onCheckedChange={(checked) => handleChange("disabled", checked === true)}
            aria-label="تعطيل صفحة تجربة المكياج"
            className="mt-0.5"
          />
        </label>

        {/* Toggle 2: Hide Promo Card */}
        <label
          className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-3.5 transition-colors ${
            draft.hidePromoCard
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-border bg-secondary/30 hover:bg-secondary/50"
          }`}
        >
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <EyeOff
                className={`h-4 w-4 ${
                  draft.hidePromoCard
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
                }`}
              />
              <span className="text-xs font-bold text-foreground">
                إخفاء بطاقة تجربة المكياج من المتجر
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              إخفاء بطاقة الترويج الكبيرة التفاعلية من الصفحة الرئيسية وصفحة التصنيفات.
            </p>
          </div>
          <Checkbox
            checked={draft.hidePromoCard}
            onCheckedChange={(checked) => handleChange("hidePromoCard", checked === true)}
            aria-label="إخفاء بطاقة تجربة المكياج"
            className="mt-0.5"
          />
        </label>

        {/* Toggle 3: Hide link from header navigation */}
        <label
          className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-3.5 transition-colors ${
            draft.hideFromHeader
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-border bg-secondary/30 hover:bg-secondary/50"
          }`}
        >
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <Eye
                className={`h-4 w-4 ${
                  draft.hideFromHeader
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
                }`}
              />
              <span className="text-xs font-bold text-foreground">
                إخفاء رابط تجربة المكياج من القائمة العلوية
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              إخفاء زر «استوديو المكياج» من شريط التنقل العلوي (Header) والقائمة الجانبية للهاتف.
            </p>
          </div>
          <Checkbox
            checked={draft.hideFromHeader}
            onCheckedChange={(checked) => handleChange("hideFromHeader", checked === true)}
            aria-label="إخفاء رابط تجربة المكياج من القائمة"
            className="mt-0.5"
          />
        </label>
      </div>

      {/* Info notice if disabled */}
      {draft.disabled && (
        <div className="mt-3.5 flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-[11px] text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            عند تفعيل التعطيل، تكون صفحة تجربة المكياج معطلة ومحجوبة بالكامل وتختفي عن الجميع بما في
            ذلك المسؤولين (تم إلغاء وضع المعاينة الإدارية).
          </span>
        </div>
      )}

      {/* Footer Actions */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-[11px] text-muted-foreground">
          {dirty ? "لديك تعديلات غير محفوظة" : "الإعدادات محفوظة ومزامنة"}
        </p>

        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saveMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>إلغاء</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty || saveMutation.isPending || isLoading}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-soft transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saveMutation.isPending ? "جارٍ الحفظ..." : "حفظ التغييرات"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
