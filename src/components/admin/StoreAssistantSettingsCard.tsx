import { useState, useEffect } from "react";
import {
  Bot,
  Sparkles,
  Eye,
  EyeOff,
  PowerOff,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  KeyRound,
  Cpu,
  Zap,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAssistantSettings,
  useSaveAssistantSettings,
  useTestAssistantConnection,
} from "@/lib/assistant-settings";
import {
  DEFAULT_ASSISTANT_SETTINGS,
  PROVIDER_INFO,
  GEMINI_MODELS,
  OTHER_PROVIDER_MODELS,
  type AssistantSettings,
  type AiModelProvider,
} from "@/lib/assistant-settings.functions";
import { Checkbox } from "@/components/ui/checkbox";

export function StoreAssistantSettingsCard() {
  const { data: savedSettings, isLoading } = useAssistantSettings();
  const saveMutation = useSaveAssistantSettings();
  const testMutation = useTestAssistantConnection();

  const [draft, setDraft] = useState<AssistantSettings>(DEFAULT_ASSISTANT_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (savedSettings) {
      setDraft(savedSettings);
      setDirty(false);
    }
  }, [savedSettings]);

  const handleChange = <K extends keyof AssistantSettings>(key: K, val: AssistantSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const handleKeyChange = (provider: AiModelProvider, val: string) => {
    setDraft((prev) => ({
      ...prev,
      providerKeys: {
        ...prev.providerKeys,
        [provider]: val,
      },
    }));
    setDirty(true);
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(draft);
      setDirty(false);
      toast.success("تم حفظ إعدادات مساعد الذكاء الاصطناعي بنجاح");
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

  const handleTestConnection = async () => {
    setTestResult(null);
    const provider = draft.activeProvider;
    const key = draft.providerKeys[provider as keyof typeof draft.providerKeys];
    const model = draft.customModelName;

    try {
      const res = await testMutation.mutateAsync({
        provider,
        apiKey: key,
        model,
        geminiModel: draft.geminiModel,
        geminiAutoFallback: draft.geminiAutoFallback,
      });
      setTestResult(res);
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      const msg = err?.message || "فشل الاتصال بالنموذج";
      setTestResult({ ok: false, message: msg });
      toast.error(msg);
    }
  };

  const activeProviderMeta = PROVIDER_INFO[draft.activeProvider];
  const activeModelDisplay =
    draft.activeProvider === "gemini"
      ? draft.customModelName || draft.geminiModel || "gemini-2.5-flash"
      : draft.customModelName || activeProviderMeta.defaultModel;

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-extrabold text-foreground">
                مساعد الذكاء الاصطناعي للمتجر (استشارة واختيار المنتجات)
              </h2>
              {!draft.enabled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-bold text-destructive">
                  <PowerOff className="h-3 w-3" /> معطل
                </span>
              ) : draft.hideFloatingButton ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  <EyeOff className="h-3 w-3" /> الأيقونة مخفية
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> مفعّل (
                  {activeProviderMeta.name.split(" ")[0]} - {activeModelDisplay})
                </span>
              )}

              {draft.enabled && draft.activeProvider === "gemini" && draft.geminiAutoFallback && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" /> تبديل تلقائي مفعّل
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              مساعد تفاعلي ذكي يساعد العملاء في شرح مشاكل البشرة والشعر واختيار المنتجات المطابقة
              فوراً
            </p>
          </div>
        </div>

        {/* Test Connection Button */}
        <button
          type="button"
          onClick={() => void handleTestConnection()}
          disabled={testMutation.isPending}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary active:scale-95 disabled:opacity-50"
        >
          {testMutation.isPending ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Zap className="h-3.5 w-3.5 text-primary" />
          )}
          <span>اختبار الاتصال بالنموذج</span>
        </button>
      </div>

      {/* Test Result Banner */}
      {testResult && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-2xl border p-3 text-xs font-bold ${
            testResult.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Section 1: Visibility & Disable Toggles */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-extrabold text-foreground">
          حالة التفعيل والظهور (تعطيل وإخفاء)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Toggle 1: Disable entirely */}
          <label
            className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-3.5 transition-colors ${
              !draft.enabled
                ? "border-destructive/30 bg-destructive/5"
                : "border-border bg-secondary/20 hover:bg-secondary/40"
            }`}
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <PowerOff
                  className={`h-4 w-4 ${
                    !draft.enabled ? "text-destructive" : "text-muted-foreground"
                  }`}
                />
                <span className="text-xs font-bold text-foreground">
                  تعطيل المساعد الذكي بالكامل
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                إيقاف خدمة المساعد الذكي عن العمل في المتجر.
              </p>
            </div>
            <Checkbox
              checked={!draft.enabled}
              onCheckedChange={(checked) => handleChange("enabled", checked !== true)}
              aria-label="تعطيل المساعد الذكي"
              className="mt-0.5"
            />
          </label>

          {/* Toggle 2: Hide floating icon */}
          <label
            className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-3.5 transition-colors ${
              draft.hideFloatingButton
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-border bg-secondary/20 hover:bg-secondary/40"
            }`}
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <EyeOff
                  className={`h-4 w-4 ${
                    draft.hideFloatingButton
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  }`}
                />
                <span className="text-xs font-bold text-foreground">
                  إخفاء الأيقونة العائمة من المتجر
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                إخفاء زر المساعد العائم من أسفل شاشة المتجر.
              </p>
            </div>
            <Checkbox
              checked={draft.hideFloatingButton}
              onCheckedChange={(checked) => handleChange("hideFloatingButton", checked === true)}
              aria-label="إخفاء الأيقونة العائمة"
              className="mt-0.5"
            />
          </label>
        </div>
      </div>

      {/* Section 2: Model Providers & API Keys */}
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold text-foreground">
              اختيار نموذج الذكاء الاصطناعي وربط المفاتيح
            </p>
            <p className="text-[11px] text-muted-foreground">
              حدّدي النموذج المفضّل للرد على استفسارات العملاء واقتراح المنتجات
            </p>
          </div>
          <span className="rounded-xl bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            النموذج النشط حالياً: {activeProviderMeta.name}
          </span>
        </div>

        {/* Provider Selector Tabs / Buttons */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {(Object.keys(PROVIDER_INFO) as AiModelProvider[]).map((prov) => {
            const isSelected = draft.activeProvider === prov;
            const hasKey =
              prov === "lovable" ||
              Boolean(draft.providerKeys[prov as keyof typeof draft.providerKeys]?.trim());

            return (
              <button
                key={prov}
                type="button"
                onClick={() => handleChange("activeProvider", prov)}
                className={`relative flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/20"
                    : "border-border bg-secondary/30 text-foreground hover:bg-secondary/60"
                }`}
              >
                <div className="flex items-center gap-1 text-xs font-black">
                  {prov === "gemini" && "🌟"}
                  {prov === "openai" && "🤖"}
                  {prov === "deepseek" && "⚡"}
                  {prov === "grok" && "🚀"}
                  {prov === "claude" && "🧠"}
                  {prov === "lovable" && "💖"}
                  <span>{PROVIDER_INFO[prov].name.split(" ")[0]}</span>
                </div>
                <span className="mt-1 text-[9px] text-muted-foreground truncate max-w-full">
                  {PROVIDER_INFO[prov].defaultModel}
                </span>
                {hasKey && (
                  <span className="absolute -top-1 -end-1 flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Provider Details & API Key Config */}
        <div className="mt-4 rounded-2xl border border-border bg-secondary/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">
                إعدادات {activeProviderMeta.name}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              النموذج الافتراضي: <code>{activeProviderMeta.defaultModel}</code>
            </span>
          </div>

          {/* Gemini Specific Detailed Setup */}
          {draft.activeProvider === "gemini" && (
            <div className="mt-3 space-y-4">
              {/* Gemini API Key */}
              <div>
                <label className="mb-1.5 flex flex-wrap items-center justify-between text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    <span>مفتاح API الخاص بـ Google Gemini</span>
                  </span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <span>الحصول على مفتاح مجاني من Google AI Studio</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={showKeys["gemini"] ? "text" : "password"}
                    dir="ltr"
                    value={draft.providerKeys.gemini || ""}
                    onChange={(e) => handleKeyChange("gemini", e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey("gemini")}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title={showKeys["gemini"] ? "إخفاء" : "إظهار"}
                  >
                    {showKeys["gemini"] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  (أو يُستخرج تلقائياً من المتغير البيئي <code>GEMINI_API_KEY</code> في السيرفر عند
                  تركه فارغاً)
                </p>
              </div>

              {/* Gemini Auto-Fallback / Auto-Switch Toggle */}
              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3.5 transition-colors hover:bg-primary/10">
                <label className="flex cursor-pointer items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary animate-pulse" />
                      <span className="text-xs font-black text-foreground">
                        خيار التبديل التلقائي بين نماذج Gemini (Auto-Fallback / Failover)
                      </span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                        موصى به لضمان استمرارية الخدمة 100%
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      في حال نفاد حصة الطلبات (Quota Exceeded 429) أو بطء استجابة النموذج المحدد،
                      يقوم المساعد بالتبديل الفوري والتلقائي إلى النموذج البديل التالي في سلسلة
                      Gemini (مثال: من 2.5 Flash إلى 2.5 Flash Lite ثم 2.0 Flash) لضمان عدم توقف
                      المحادثة نهائياً أمام العميلة.
                    </p>
                  </div>
                  <Checkbox
                    checked={draft.geminiAutoFallback}
                    onCheckedChange={(checked) =>
                      handleChange("geminiAutoFallback", checked === true)
                    }
                    aria-label="تفعيل التبديل التلقائي بين نماذج Gemini"
                    className="mt-1"
                  />
                </label>
              </div>

              {/* Gemini Models Lineup Grid */}
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-extrabold text-foreground">
                      جميع نماذج Google Gemini المتاحة للاختيار:
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    النموذج النشط:{" "}
                    <code className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                      {draft.geminiModel || "gemini-2.5-flash"}
                    </code>
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {GEMINI_MODELS.map((gm) => {
                    const isSelected = (draft.geminiModel || "gemini-2.5-flash") === gm.id;
                    return (
                      <button
                        key={gm.id}
                        type="button"
                        onClick={() => {
                          handleChange("geminiModel", gm.id);
                          handleChange("customModelName", "");
                        }}
                        className={`flex flex-col justify-between rounded-2xl border p-3 text-start transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-xs ring-2 ring-primary/20"
                            : "border-border bg-background hover:bg-secondary/40"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-mono text-xs font-black text-foreground">
                              {gm.name}
                            </span>
                            {gm.badge && (
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-muted-foreground"
                                }`}
                              >
                                {gm.badge}
                              </span>
                            )}
                          </div>
                          {gm.tag && (
                            <span className="mt-1 inline-block text-[9px] font-semibold text-primary/80">
                              {gm.tag}
                            </span>
                          )}
                          <p className="mt-1 text-[10px] leading-snug text-muted-foreground line-clamp-3">
                            {gm.description}
                          </p>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-1.5 text-[9px]">
                          <code className="text-muted-foreground truncate max-w-[120px]">
                            {gm.id}
                          </code>
                          {isSelected && (
                            <span className="flex items-center gap-1 font-bold text-primary">
                              <CheckCircle2 className="h-3 w-3" /> نشط
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Optional Custom Gemini Model */}
                <div className="mt-3">
                  <label className="mb-1 flex items-center justify-between text-xs font-bold text-muted-foreground">
                    <span>أو كتابة اسم نموذج Gemini تجريبي / مخصص يدوي:</span>
                    <span className="text-[10px] font-normal">
                      اتركه فارغاً لاعتماد النموذج المختار أعلاه
                    </span>
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={draft.customModelName || ""}
                    onChange={(e) => handleChange("customModelName", e.target.value)}
                    placeholder="مثال: gemini-experimental أو gemini-2.0-flash-exp"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Other Non-Gemini Providers Setup */}
          {draft.activeProvider !== "gemini" && draft.activeProvider !== "lovable" && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1.5 flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    <span>مفتاح API الخاص بـ {activeProviderMeta.name}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    (أو يُستخرج تلقائياً من <code>{activeProviderMeta.envKeyName}</code> في السيرفر)
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={showKeys[draft.activeProvider] ? "text" : "password"}
                    dir="ltr"
                    value={
                      draft.providerKeys[draft.activeProvider as keyof typeof draft.providerKeys] ||
                      ""
                    }
                    onChange={(e) => handleKeyChange(draft.activeProvider, e.target.value)}
                    placeholder={activeProviderMeta.placeholder}
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey(draft.activeProvider)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title={showKeys[draft.activeProvider] ? "إخفاء" : "إظهار"}
                  >
                    {showKeys[draft.activeProvider] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Model Presets for other providers */}
              {OTHER_PROVIDER_MODELS[draft.activeProvider] && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-muted-foreground">
                    نماذج جاهزة للاختيار السريع:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(OTHER_PROVIDER_MODELS[draft.activeProvider] ?? []).map((m) => {
                      const isCurrent =
                        (draft.customModelName || activeProviderMeta.defaultModel) === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleChange("customModelName", m.id)}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-all ${
                            isCurrent
                              ? "border-primary bg-primary/10 font-bold text-primary shadow-xs ring-1 ring-primary/20"
                              : "border-border bg-background text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          <span>{m.name}</span>
                          {m.badge && (
                            <span className="rounded-md bg-secondary px-1 py-0.5 text-[9px]">
                              {m.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom Model Override */}
              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span>اسم النموذج المخصص (اختياري)</span>
                  <span className="text-[10px] font-normal">اتركه فارغاً لاستخدام الافتراضي</span>
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={draft.customModelName || ""}
                  onChange={(e) => handleChange("customModelName", e.target.value)}
                  placeholder={activeProviderMeta.defaultModel}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {draft.activeProvider === "lovable" && (
            <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
              بوابة النظام المدمجة تستخدم رصيد الذكاء الاصطناعي المشترك دون الحاجة لإدخال مفاتيح
              إضافية.
            </div>
          )}
        </div>

        {/* Section 3: Assistant Customization (Name, Greeting, Instructions) */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">
              اسم المساعدة الافتراضية
            </label>
            <input
              type="text"
              value={draft.assistantName}
              onChange={(e) => handleChange("assistantName", e.target.value)}
              placeholder="مستشارة الجمال الذكية"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">
              رسالة الترحيب الأولى للعميلة
            </label>
            <input
              type="text"
              value={draft.welcomeMessage}
              onChange={(e) => handleChange("welcomeMessage", e.target.value)}
              placeholder="أهلاً بكِ في إيهاب ستور..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-[11px] text-muted-foreground">
          {dirty ? "لديك تعديلات غير محفوظة" : "الإعدادات محفوظة ومحدثة"}
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
            <span>{saveMutation.isPending ? "جارٍ الحفظ..." : "حفظ إعدادات المساعد"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
