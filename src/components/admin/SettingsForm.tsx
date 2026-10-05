import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage, useAdminSettings } from "@/lib/admin";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import { enhanceProductImage } from "@/lib/ai-image.functions";
import type { StoreSettingsFull } from "@/lib/store";
import { webpifyStoredImage } from "@/lib/image-optimize";

export type SettingsField = {
  key: keyof StoreSettingsFull;
  label: string;
  type?: "text" | "textarea" | "ltr" | "image" | "select" | "boolean";
  hint?: string;
  options?: { value: string; label: string }[];
  numeric?: boolean;
};

export function SettingsForm({ title, fields }: { title: string; fields: SettingsField[] }) {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useAdminSettings();
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [aiKey, setAiKey] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!settings) return;
    const next: Record<string, string> = {};
    fields.forEach((f) => {
      const v = settings[f.key];
      next[f.key as string] = v == null ? "" : String(v);
    });
    setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const save = async () => {
    setBusy(true);
    const patch: Record<string, string | number | null> = {};
    fields.forEach((f) => {
      const value = (form[f.key as string] ?? "").trim();
      patch[f.key as string] =
        f.type === "boolean"
          ? ((value === "true") as unknown as string)
          : value === ""
            ? null
            : f.numeric
              ? Number(value)
              : value;
    });

    // إن لم يوجد سجل إعدادات، نبحث عنه مجدداً ثم ننشئ سجلاً افتراضياً
    let id = settings?.id ?? null;
    if (!id) {
      const { data: row } = await supabase
        .from("store_settings")
        .select("id")
        .limit(1)
        .maybeSingle();
      id = (row as { id: string } | null)?.id ?? null;
    }
    if (!id) {
      const { data: created, error: createError } = await supabase
        .from("store_settings")
        .insert({
          store_name: (patch["store_name"] as string) ?? "متجري",
          whatsapp_number: (patch["whatsapp_number"] as string) ?? "967700000000",
          currency: (patch["currency"] as string) ?? "YER",
          currency_label: (patch["currency_label"] as string) ?? "ر.ي",
        } as never)
        .select("id")
        .maybeSingle();
      if (createError || !created) {
        setBusy(false);
        const msg = createError?.message ?? "تعذر إنشاء سجل الإعدادات";
        setStatus({ ok: false, msg: `فشل الحفظ: ${msg}` });
        toast.error(msg);
        return;
      }
      id = (created as { id: string }).id;
    }

    const { error } = await supabase
      .from("store_settings")
      .update(patch as never)
      .eq("id", id);

    setBusy(false);
    if (error) {
      setStatus({ ok: false, msg: `فشل الحفظ: ${error.message}` });
      toast.error(error.message);
      return;
    }
    setStatus({ ok: true, msg: "تم حفظ الإعدادات بنجاح" });
    toast.success("تم حفظ الإعدادات");
    await qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    await qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const enhance = async (key: string) => {
    const path = form[key];
    if (!path) return;
    setAiKey(key);
    try {
      const res = await enhanceProductImage({
        data: { path, mode: key === "logo" ? "logo" : "product" },
      });
      const optimized = await webpifyStoredImage(res.path, "branding");
      setForm((prev) => ({ ...prev, [key]: optimized }));
      toast.success("تم تحسين الصورة، اضغط حفظ التغييرات");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر التحسين");
    } finally {
      setAiKey(null);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <div className="grid gap-3 rounded-3xl border border-border bg-card p-5 shadow-soft sm:grid-cols-2">
        {fields.map((f) => (
          <label
            key={f.key as string}
            className={f.type === "textarea" ? "sm:col-span-2 block" : "block"}
          >
            <span className="text-xs font-bold">{f.label}</span>
            {f.type === "textarea" ? (
              <textarea
                rows={4}
                value={form[f.key as string] ?? ""}
                onChange={(e) => setForm({ ...form, [f.key as string]: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            ) : f.type === "image" ? (
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {form[f.key as string] ? (
                  <SmartImage
                    paths={[form[f.key as string] as string]}
                    fallback={fallbackFor()}
                    alt={f.label}
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                ) : null}
                <label className="flex cursor-pointer items-center gap-1 rounded-lg gradient-gold px-3 py-2 text-[11px] font-bold text-primary-foreground">
                  <Upload className="h-3.5 w-3.5" />
                  {form[f.key as string] ? "تغيير الصورة" : "اختيار صورة"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setBusy(true);
                      try {
                        const folder = f.key === "logo" ? "branding" : "settings";
                        const path = await uploadImage(file, folder);
                        const optimized = await webpifyStoredImage(path, folder);
                        setForm((prev) => ({ ...prev, [f.key as string]: optimized }));
                        toast.success("تم رفع الصورة وتحويلها إلى صيغة WebP بنجاح");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "تعذر رفع الصورة");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="hidden"
                  />
                </label>
                {form[f.key as string] ? (
                  <span
                    dir="ltr"
                    className="max-w-[12rem] truncate text-[10px] text-muted-foreground"
                  >
                    {form[f.key as string]}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">لا توجد صورة حالياً</span>
                )}
                {form[f.key as string] && (
                  <>
                    <button
                      type="button"
                      disabled={aiKey !== null || busy}
                      onClick={() => enhance(f.key as string)}
                      className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1 text-[11px] font-bold text-primary disabled:opacity-60"
                    >
                      {aiKey === f.key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" />
                      )}
                      تحسين بالذكاء الاصطناعي
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, [f.key as string]: "" }))}
                      className="rounded-lg bg-destructive/10 px-3 py-1 text-[11px] font-bold text-destructive"
                    >
                      إزالة
                    </button>
                  </>
                )}
              </div>
            ) : f.type === "boolean" ? (
              <label className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form[f.key as string] === "true"}
                  onChange={(e) =>
                    setForm({ ...form, [f.key as string]: e.target.checked ? "true" : "false" })
                  }
                />
                <span className="text-xs font-bold">
                  {form[f.key as string] === "true" ? "مفعّل" : "معطّل"}
                </span>
              </label>
            ) : f.type === "select" ? (
              <select
                value={form[f.key as string] ?? ""}
                onChange={(e) => setForm({ ...form, [f.key as string]: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                dir={f.type === "ltr" ? "ltr" : undefined}
                value={form[f.key as string] ?? ""}
                onChange={(e) => setForm({ ...form, [f.key as string]: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
            {f.hint && (
              <span className="mt-1 block text-[11px] text-muted-foreground">{f.hint}</span>
            )}
          </label>
        ))}
        <div className="sm:col-span-2">
          <button
            onClick={save}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {busy ? "جاري الحفظ…" : "حفظ التغييرات"}
          </button>
          {status && (
            <p
              role="status"
              className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${
                status.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
              }`}
            >
              {status.msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
