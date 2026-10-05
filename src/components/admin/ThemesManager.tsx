import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Download,
  Eye,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import { generateThemeIcon } from "@/lib/theme-icon.functions";
import { NAV_LABELS } from "@/lib/nav-items";
import { webpifyStoredImage } from "@/lib/image-optimize";
import {
  DEFAULT_NAV,
  applyThemeVars,
  cacheTheme,
  useActiveTheme,
  useThemes,
  type NavKey,
  type Theme,
} from "@/lib/theme";

const ALL_KEYS: NavKey[] = [
  "home",
  "search",
  "categories",
  "cart",
  "account",
  "favorites",
  "products",
  "contact",
];

const POSITIONS: { value: Theme["nav_position"]; label: string }[] = [
  { value: "bottom", label: "شريط سفلي ثابت" },
  { value: "floating", label: "شريط عائم" },
  { value: "top", label: "شريط علوي ثابت" },
];

const STYLES: { value: Theme["nav_style"]; label: string }[] = [
  { value: "pill", label: "أزرار مربعة ناعمة" },
  { value: "round", label: "أزرار دائرية" },
  { value: "flat", label: "أزرار مسطحة" },
];

/** Ready-made professional identities used when creating a new theme. */
const PALETTES = [
  {
    label: "نسائية وردية",
    primary_color: "#C9758B",
    accent_color: "#E8B4B8",
    background_color: "#FFF7F6",
    foreground_color: "#33202A",
    card_color: "#FFFFFF",
    radius: "1.25rem",
    nav_style: "round" as const,
  },
  {
    label: "رجالية كلاسيكية",
    primary_color: "#1F3A5F",
    accent_color: "#8A9BB0",
    background_color: "#F4F6F9",
    foreground_color: "#111A26",
    card_color: "#FFFFFF",
    radius: "0.375rem",
    nav_style: "flat" as const,
  },
  {
    label: "زمردية فاخرة",
    primary_color: "#0F6B58",
    accent_color: "#C9A227",
    background_color: "#F5FAF7",
    foreground_color: "#10231D",
    card_color: "#FFFFFF",
    radius: "0.75rem",
    nav_style: "pill" as const,
  },
  {
    label: "بنفسجية عصرية",
    primary_color: "#6D4AA6",
    accent_color: "#D9B8F2",
    background_color: "#FAF7FF",
    foreground_color: "#241735",
    card_color: "#FFFFFF",
    radius: "1.25rem",
    nav_style: "round" as const,
  },
  {
    label: "رجالية ليلية",
    primary_color: "#C9A227",
    accent_color: "#5B6B7C",
    background_color: "#12161C",
    foreground_color: "#F2F4F7",
    card_color: "#1A2028",
    radius: "0.75rem",
    nav_style: "pill" as const,
  },
];

/** Small full-store mockup: header, banner, product cards and nav icons. */
function ThemeMock({ t }: { t: Theme }) {
  return (
    <div
      dir="rtl"
      className="overflow-hidden rounded-2xl border border-border"
      style={{ backgroundColor: t.background_color, color: t.foreground_color }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-[10px] font-bold"
        style={{ backgroundColor: t.card_color, borderBottom: `1px solid ${t.accent_color}` }}
      >
        <span style={{ color: t.primary_color }}>إيهاب ستور</span>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: t.accent_color }}
            />
          ))}
        </span>
      </div>
      <div
        className="mx-3 mt-3 h-10 rounded-xl"
        style={{ background: `linear-gradient(135deg, ${t.primary_color}, ${t.accent_color})` }}
      />
      <div className="grid grid-cols-3 gap-2 p-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="p-1.5"
            style={{
              backgroundColor: t.card_color,
              borderRadius: t.radius,
              border: `1px solid ${t.accent_color}`,
            }}
          >
            <div
              className="h-8 w-full rounded-md"
              style={{ backgroundColor: t.accent_color, opacity: 0.45 }}
            />
            <div
              className="mt-1 h-1.5 w-10 rounded-full"
              style={{ backgroundColor: t.foreground_color, opacity: 0.5 }}
            />
            <div
              className="mt-1 h-1.5 w-6 rounded-full"
              style={{ backgroundColor: t.primary_color }}
            />
          </div>
        ))}
      </div>
      <div
        className="flex items-center justify-around px-3 py-2"
        style={{ backgroundColor: t.card_color, borderTop: `1px solid ${t.accent_color}` }}
      >
        {t.nav_items.map((k) => (
          <span key={k} className="flex flex-col items-center gap-0.5">
            <span
              className="h-5 w-5"
              style={{
                backgroundColor: t.primary_color,
                borderRadius:
                  t.nav_style === "round" ? "999px" : t.nav_style === "flat" ? "4px" : "8px",
              }}
            />
            {t.show_labels && (
              <span className="text-[7px]" style={{ color: t.foreground_color }}>
                {NAV_LABELS[k]}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

const colorFields: { key: keyof Theme; label: string }[] = [
  { key: "primary_color", label: "اللون الأساسي" },
  { key: "accent_color", label: "اللون الثانوي" },
  { key: "background_color", label: "لون الخلفية" },
  { key: "foreground_color", label: "لون النص" },
  { key: "card_color", label: "لون البطاقات" },
];

/** Full theme system: create, pick default, recolor and reorder the nav icons. */
export function ThemesManager() {
  const qc = useQueryClient();
  const { data: themes = [], isLoading } = useThemes();
  const activeTheme = useActiveTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Theme | null>(null);
  const [iconId, setIconId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** The values shown in the editor: draft while previewing, saved values otherwise. */
  const view = (t: Theme) => (preview && preview.id === t.id ? preview : t);

  const startPreview = (t: Theme) => {
    setPreview({ ...t });
    applyThemeVars(t);
  };

  const cancelPreview = () => {
    setPreview(null);
    if (activeTheme) applyThemeVars(activeTheme);
  };

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["themes"] });
  };

  // حماية صارمة: ضمان وجود ثيم أساسي واحد فقط لا غير ومنع تكرار الثيمات الأساسية
  useEffect(() => {
    if (!themes || themes.length === 0) return;
    const defaults = themes.filter((t) => t.is_default);
    if (defaults.length > 1) {
      // إذا وجد أكثر من ثيم أساسي، نحتفظ بالأول فقط ونلغي البقية في قاعدة البيانات والكاش فوراً
      const keep = defaults[0]!;
      void (async () => {
        await supabase
          .from("themes")
          .update({ is_default: false } as never)
          .neq("id", keep.id);
        qc.setQueryData<Theme[]>(["themes"], (old) =>
          (old ?? []).map((t) => ({ ...t, is_default: t.id === keep.id })),
        );
      })();
    } else if (defaults.length === 0) {
      // إذا لم يكن هناك أي ثيم أساسي، نجعل الثيم الأول أو "ذهبي فاخر" هو الأساسي
      const first = themes.find((t) => t.name === "ذهبي فاخر") ?? themes[0];
      if (first) {
        void (async () => {
          await supabase
            .from("themes")
            .update({ is_default: true } as never)
            .eq("id", first.id);
          qc.setQueryData<Theme[]>(["themes"], (old) =>
            (old ?? []).map((t) => ({ ...t, is_default: t.id === first.id })),
          );
        })();
      }
    }
  }, [themes, qc]);

  const patch = async (theme: Theme, values: Partial<Theme>) => {
    const next = { ...theme, ...values } as Theme;
    // Instant feedback: repaint the storefront before the round-trip finishes.
    if (theme.is_default) {
      applyThemeVars(next);
      cacheTheme(next);
    }
    qc.setQueryData<Theme[]>(["themes"], (old) =>
      (old ?? []).map((t) => (t.id === theme.id ? next : t)),
    );
    setBusy(true);
    const { error } = await supabase
      .from("themes")
      .update(values as never)
      .eq("id", theme.id);
    setBusy(false);
    if (error) {
      toast.error(`فشل الحفظ: ${error.message}`);
      await refresh();
      return;
    }
    toast.success("تم حفظ المظهر");
    await refresh();
  };

  /** In preview mode changes stay local (and live on screen) until "تطبيق". */
  const setField = (theme: Theme, values: Partial<Theme>) => {
    if (preview && preview.id === theme.id) {
      const next = { ...preview, ...values } as Theme;
      setPreview(next);
      applyThemeVars(next);
      return;
    }
    void patch(theme, values);
  };

  const applyPreview = async (theme: Theme) => {
    if (!preview) return;
    const { id, created_at, updated_at, ...values } = preview as Theme & {
      created_at?: string;
      updated_at?: string;
    };
    void id;
    void created_at;
    void updated_at;
    await patch(theme, values as Partial<Theme>);
    setPreview(null);
  };

  const makeDefault = async (theme: Theme) => {
    // Repaint immediately, then persist.
    applyThemeVars(theme);
    cacheTheme(theme);
    qc.setQueryData<Theme[]>(["themes"], (old) =>
      (old ?? []).map((t) => ({ ...t, is_default: t.id === theme.id })),
    );
    setBusy(true);
    const a = await supabase
      .from("themes")
      .update({ is_default: false } as never)
      .neq("id", theme.id);
    const b = await supabase
      .from("themes")
      .update({ is_default: true } as never)
      .eq("id", theme.id);
    setBusy(false);
    if (a.error || b.error) {
      toast.error(`فشل التفعيل: ${(a.error ?? b.error)?.message}`);
      await refresh();
      return;
    }
    toast.success(`تم تفعيل مظهر: ${theme.name}`);
    await refresh();
  };

  /** New themes get a complete, professional identity (palette + AI icon) automatically. */
  const addTheme = async () => {
    const name = prompt("اسم المظهر الجديد");
    if (!name?.trim()) return;
    const used = new Set(themes.map((t) => t.primary_color.toLowerCase()));
    const palette =
      PALETTES.find((p) => !used.has(p.primary_color.toLowerCase())) ??
      (PALETTES[themes.length % PALETTES.length] as (typeof PALETTES)[number]);
    setBusy(true);
    const { data, error } = await supabase
      .from("themes")
      .insert({
        name: name.trim(),
        sort_order: themes.length,
        nav_items: DEFAULT_NAV,
        primary_color: palette.primary_color,
        accent_color: palette.accent_color,
        background_color: palette.background_color,
        foreground_color: palette.foreground_color,
        card_color: palette.card_color,
        radius: palette.radius,
        nav_style: palette.nav_style,
        nav_position: "bottom",
        show_labels: true,
      } as never)
      .select()
      .single();
    setBusy(false);
    if (error) {
      toast.error(`تعذر الإنشاء: ${error.message}`);
      return;
    }
    toast.success(`تم إنشاء المظهر بهوية ${palette.label}`);
    await refresh();
    if (data) void makeIcon({ ...(data as unknown as Theme), nav_items: DEFAULT_NAV });
  };

  const removeTheme = async (theme: Theme) => {
    if (theme.is_default) {
      toast.error("لا يمكن حذف المظهر المفعّل");
      return;
    }
    if (!confirm(`حذف المظهر "${theme.name}"؟`)) return;
    const { error } = await supabase.from("themes").delete().eq("id", theme.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحذف");
    await refresh();
  };

  const move = (theme: Theme, index: number, dir: -1 | 1) => {
    const items = [...theme.nav_items];
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[index] as NavKey;
    const b = items[target] as NavKey;
    items[index] = b;
    items[target] = a;
    void patch(theme, { nav_items: items });
  };

  const toggleKey = (theme: Theme, key: NavKey) => {
    const has = theme.nav_items.includes(key);
    if (has && theme.nav_items.length <= 3) {
      toast.error("يجب إبقاء 3 أزرار على الأقل");
      return;
    }
    const items = has ? theme.nav_items.filter((k) => k !== key) : [...theme.nav_items, key];
    if (items.length > 5) {
      toast.error("الحد الأقصى 5 أزرار");
      return;
    }
    void patch(theme, { nav_items: items });
  };

  /** Downloads all theme settings as a JSON file. */
  const exportThemes = () => {
    const blob = new Blob([JSON.stringify(themes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `themes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير إعدادات الثيمات");
  };

  const importThemes = async (file: File) => {
    setBusy(true);
    try {
      const rows = JSON.parse(await file.text());
      if (!Array.isArray(rows)) throw new Error("ملف غير صالح");
      const clean = (rows as Theme[]).map((r, i) => ({
        ...r,
        name: r.name || `مظهر ${i + 1}`,
        is_default: false,
        nav_items: r.nav_items ?? DEFAULT_NAV,
        sort_order: r.sort_order ?? i,
      }));
      const { error } = await supabase.from("themes").upsert(clean as never);
      if (error) throw error;
      toast.success("تم استيراد الثيمات");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الاستيراد");
    } finally {
      setBusy(false);
    }
  };

  /** One-time AI icon per theme, stored on the row. */
  const makeIcon = async (theme: Theme) => {
    setIconId(theme.id);
    try {
      const res = await generateThemeIcon({
        data: {
          name: theme.name,
          primary: theme.primary_color,
          accent: theme.accent_color,
          background: theme.background_color,
        },
      });
      const optimized = await webpifyStoredImage(res.path, "themes");
      await patch(theme, { thumbnail: optimized });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر توليد الأيقونة");
    } finally {
      setIconId(null);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">الثيمات وأزرار التنقل</h2>
          <p className="text-xs text-muted-foreground">
            اختر المظهر الافتراضي، غيّر الألوان وأماكن الأزرار وترتيب الأيقونات.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportThemes}
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold"
          >
            <Download className="h-4 w-4" /> تصدير الثيمات
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-60"
          >
            <Upload className="h-4 w-4" /> استيراد
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void importThemes(f);
            }}
          />
          <button
            onClick={addTheme}
            className="flex items-center gap-2 rounded-xl gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> مظهر جديد
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {themes.map((t) => (
          <div key={t.id} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
            <div className="flex flex-wrap items-center gap-3">
              {/* Live thumbnail: AI icon when available, otherwise a mini mockup of the palette. */}
              {t.thumbnail ? (
                <SmartImage
                  paths={[t.thumbnail]}
                  fallback={fallbackFor()}
                  alt={t.name}
                  className="h-14 w-14 rounded-2xl border border-border object-cover"
                />
              ) : (
                <div
                  className="flex h-14 w-14 flex-col justify-between overflow-hidden rounded-2xl border border-border p-1.5"
                  style={{ backgroundColor: view(t).background_color }}
                >
                  <span
                    className="h-2 w-8 rounded-full"
                    style={{ backgroundColor: view(t).primary_color }}
                  />
                  <span
                    className="h-5 w-full rounded-md"
                    style={{
                      backgroundColor: view(t).card_color,
                      border: `1px solid ${view(t).accent_color}`,
                    }}
                  />
                  <span
                    className="h-1.5 w-6 rounded-full"
                    style={{ backgroundColor: view(t).accent_color }}
                  />
                </div>
              )}
              <div className="flex gap-1">
                {[t.primary_color, t.accent_color, t.background_color, t.card_color].map((c, i) => (
                  <span
                    key={i}
                    className="h-7 w-7 rounded-lg border border-border"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm font-extrabold">{t.name}</p>
              {!t.thumbnail && (
                <button
                  onClick={() => makeIcon(t)}
                  disabled={iconId !== null}
                  aria-label="توليد أيقونة للثيم"
                  className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1 text-[11px] font-bold text-primary disabled:opacity-60"
                >
                  {iconId === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  أيقونة AI
                </button>
              )}
              {t.is_default ? (
                <span className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                  <Check className="h-3.5 w-3.5" /> الثيم الأساسي (المفعّل)
                </span>
              ) : (
                <button
                  onClick={() => makeDefault(t)}
                  disabled={busy}
                  className="rounded-lg bg-secondary px-3 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
                >
                  تعيين كثيم أساسي
                </button>
              )}
              <button
                onClick={() => setOpenId(openId === t.id ? null : t.id)}
                className="rounded-lg border border-border px-3 py-1 text-[11px] font-bold"
              >
                {openId === t.id ? "إغلاق" : "تخصيص"}
              </button>
              {preview?.id === t.id ? (
                <>
                  <button
                    onClick={() => applyPreview(t)}
                    disabled={busy}
                    className="rounded-lg gradient-gold px-3 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-60"
                  >
                    تطبيق
                  </button>
                  <button
                    onClick={cancelPreview}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-[11px] font-bold"
                  >
                    <X className="h-3.5 w-3.5" /> إلغاء المعاينة
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    startPreview(t);
                    setOpenId(t.id);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1 text-[11px] font-bold text-primary"
                >
                  <Eye className="h-3.5 w-3.5" /> معاينة
                </button>
              )}
              {t.is_default ? (
                <span
                  className="rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary"
                  title="ثيم النظام الحالي المفعّل (محمي من الحذف أثناء تفعيله)"
                >
                  ثيم النظام الحالي
                </span>
              ) : (
                <button
                  onClick={() => removeTheme(t)}
                  aria-label="حذف المظهر"
                  title="حذف هذا الثيم"
                  className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {openId === t.id && (
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                <div>
                  <p className="mb-2 text-xs font-bold">معاينة مصغّرة للمتجر بالكامل</p>
                  <ThemeMock t={view(t)} />
                </div>
                <label className="block">
                  <span className="text-xs font-bold">اسم المظهر</span>
                  <input
                    defaultValue={t.name}
                    onBlur={(e) =>
                      e.target.value.trim() &&
                      e.target.value !== t.name &&
                      setField(t, { name: e.target.value.trim() })
                    }
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-3">
                  {colorFields.map((f) => (
                    <label key={f.key as string} className="block">
                      <span className="text-xs font-bold">{f.label}</span>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="color"
                          value={String(view(t)[f.key] ?? "#000000")}
                          onChange={(e) =>
                            setField(t, { [f.key]: e.target.value } as Partial<Theme>)
                          }
                          className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-background"
                        />
                        <input
                          dir="ltr"
                          key={`${t.id}-${f.key as string}`}
                          defaultValue={String(view(t)[f.key] ?? "")}
                          placeholder="#E8B4B8"
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) || v === "")
                              setField(t, { [f.key]: v } as Partial<Theme>);
                          }}
                          className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
                        />
                      </div>
                    </label>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-xs font-bold">مكان أزرار التنقل</span>
                    <select
                      value={view(t).nav_position}
                      onChange={(e) =>
                        setField(t, { nav_position: e.target.value as Theme["nav_position"] })
                      }
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      {POSITIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold">شكل الأزرار</span>
                    <select
                      value={view(t).nav_style}
                      onChange={(e) =>
                        setField(t, { nav_style: e.target.value as Theme["nav_style"] })
                      }
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      {STYLES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold">استدارة العناصر</span>
                    <select
                      value={view(t).radius}
                      onChange={(e) => setField(t, { radius: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="0.375rem">حادة</option>
                      <option value="0.75rem">متوسطة</option>
                      <option value="1.25rem">دائرية</option>
                    </select>
                  </label>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={view(t).show_labels}
                    onChange={(e) => setField(t, { show_labels: e.target.checked })}
                  />
                  إظهار أسماء الأزرار تحت الأيقونات
                </label>

                <div>
                  <p className="text-xs font-bold">ترتيب الأيقونات (من 3 إلى 5 أزرار)</p>
                  <div className="mt-2 space-y-2">
                    {t.nav_items.map((k, i) => (
                      <div
                        key={k}
                        className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2"
                      >
                        <span className="flex-1 text-xs font-bold">{NAV_LABELS[k]}</span>
                        <button
                          onClick={() => move(t, i, -1)}
                          aria-label="تحريك لليمين"
                          className="rounded-lg bg-background p-1.5"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => move(t, i, 1)}
                          aria-label="تحريك لليسار"
                          className="rounded-lg bg-background p-1.5"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleKey(t, k)}
                          aria-label="إزالة"
                          className="rounded-lg bg-destructive/10 p-1.5 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ALL_KEYS.filter((k) => !t.nav_items.includes(k)).map((k) => (
                      <button
                        key={k}
                        onClick={() => toggleKey(t, k)}
                        className="rounded-lg border border-dashed border-border px-3 py-1 text-[11px] font-bold text-primary hover:border-primary"
                      >
                        + {NAV_LABELS[k]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
