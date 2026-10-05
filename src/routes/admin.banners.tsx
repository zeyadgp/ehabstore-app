import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import { useCategories } from "@/lib/store";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "@/components/SmartImage";
import { uploadImage } from "@/lib/admin";
import { fallbackFor } from "@/lib/images";
import { generateAdImage } from "@/lib/ad-image.functions";
import { webpifyStoredImage } from "@/lib/image-optimize";
import {
  bannerSizes,
  placementLabels,
  useAdminBanners,
  type Banner,
  type BannerPlacement,
} from "@/lib/banners";

export const Route = createFileRoute("/admin/banners")({
  head: () => ({
    meta: [{ title: "البانرات | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminBanners,
});

type Draft = {
  id?: string;
  title: string;
  subtitle: string;
  badge: string;
  image: string;
  cta_label: string;
  cta_url: string;
  placement: BannerPlacement;
  category_id: string;
  sort_order: string;
  is_active: boolean;
};

const empty: Draft = {
  title: "",
  subtitle: "",
  badge: "",
  image: "",
  cta_label: "تسوّق الآن",
  cta_url: "/products",
  placement: "hero",
  category_id: "",
  sort_order: "0",
  is_active: true,
};

const inputCls =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function AdminBanners() {
  const qc = useQueryClient();
  const { data: banners = [], isLoading } = useAdminBanners();
  const { data: categories = [] } = useCategories();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const generate = useServerFn(generateAdImage);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "banners"] });
    await qc.invalidateQueries({ queryKey: ["banners"] });
  };

  const openEdit = (b: Banner) =>
    setDraft({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? "",
      badge: b.badge ?? "",
      image: b.image ?? "",
      cta_label: b.cta_label ?? "",
      cta_url: b.cta_url ?? "",
      placement: (b.placement as BannerPlacement) ?? "hero",
      category_id: b.category_id ?? "",
      sort_order: String(b.sort_order),
      is_active: b.is_active,
    });

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.error("عنوان الإعلان مطلوب");
      return;
    }
    setBusy(true);
    const payload = {
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim() || null,
      badge: draft.badge.trim() || null,
      image: draft.image || null,
      cta_label: draft.cta_label.trim() || null,
      cta_url: draft.cta_url.trim() || null,
      placement: draft.placement,
      category_id: draft.category_id || null,
      sort_order: Number(draft.sort_order || 0),
      is_active: draft.is_active,
    };
    const { error } = draft.id
      ? await supabase.from("banners").update(payload).eq("id", draft.id)
      : await supabase.from("banners").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحفظ");
    setDraft(null);
    await refresh();
  };

  const remove = async (b: Banner) => {
    if (!confirm(`حذف الإعلان "${b.title}"؟`)) return;
    const { error } = await supabase.from("banners").delete().eq("id", b.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحذف");
    await refresh();
  };

  const toggle = async (b: Banner) => {
    const { error } = await supabase
      .from("banners")
      .update({ is_active: !b.is_active })
      .eq("id", b.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  };

  const onUpload = async (file: File | undefined) => {
    if (!file || !draft) return;
    setBusy(true);
    try {
      const path = await uploadImage(file, "banners");
      setDraft({ ...draft, image: path });
      toast.success("تم رفع صورة الإعلان");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الرفع");
    } finally {
      setBusy(false);
    }
  };

  const onGenerate = async () => {
    if (!draft) return;
    const topic = `${draft.title} ${draft.subtitle}`.trim();
    if (!topic) {
      toast.error("اكتبي عنوان الإعلان أولاً");
      return;
    }
    setGenerating(true);
    try {
      const res = await generate({ data: { topic, ratio: bannerSizes[draft.placement].ratio } });
      const optimized = await webpifyStoredImage(res.path, "banners");
      setDraft((prev) => (prev ? { ...prev, image: optimized } : prev));
      toast.success("تم توليد صورة الإعلان، اضغط حفظ");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التوليد");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">الإعلانات والبانرات</h1>
        <button
          onClick={() => setDraft({ ...empty })}
          className="ms-auto flex items-center gap-2 rounded-xl gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> إعلان جديد
        </button>
      </div>

      <div className="grid gap-2 rounded-3xl border border-border bg-secondary/40 p-4 text-[11px] leading-6 text-muted-foreground sm:grid-cols-3">
        {(Object.keys(bannerSizes) as BannerPlacement[]).map((k) => (
          <p key={k}>
            <span className="font-bold text-foreground">{bannerSizes[k].label}:</span> المقاس
            المناسب {bannerSizes[k].size} (نسبة {bannerSizes[k].ratio})
          </p>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {banners.map((b) => (
          <div
            key={b.id}
            className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
          >
            <div className="aspect-[16/6]">
              <SmartImage
                paths={b.image ? [b.image] : []}
                fallback={fallbackFor("offers")}
                alt={b.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="space-y-2 p-4">
              <p className="text-sm font-extrabold">{b.title}</p>
              <p className="text-[11px] text-muted-foreground">{placementLabels[b.placement]}</p>
              {b.subtitle && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{b.subtitle}</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => openEdit(b)}
                  className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-[11px] font-bold text-primary"
                >
                  <Pencil className="h-3.5 w-3.5" /> تعديل
                </button>
                <button
                  onClick={() => toggle(b)}
                  className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-[11px] font-bold text-foreground"
                >
                  {b.is_active ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                  {b.is_active ? "ظاهر" : "مخفي"}
                </button>
                <button
                  onClick={() => remove(b)}
                  className="ms-auto rounded-lg bg-destructive/10 p-2 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && banners.length === 0 && (
          <p className="rounded-3xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground md:col-span-2">
            لا توجد إعلانات بعد — أضف أول إعلان لعرضه في الصفحة الرئيسية.
          </p>
        )}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-4 w-full max-w-2xl rounded-3xl bg-card p-5 shadow-lift">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{draft.id ? "تعديل إعلان" : "إعلان جديد"}</h2>
              <button
                onClick={() => setDraft(null)}
                className="rounded-lg p-1 text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold">عنوان الإعلان</span>
                <input
                  className={inputCls}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold">النص الفرعي</span>
                <textarea
                  rows={2}
                  className={inputCls}
                  value={draft.subtitle}
                  onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold">شارة صغيرة (مثل: عرض محدود)</span>
                <input
                  className={inputCls}
                  value={draft.badge}
                  onChange={(e) => setDraft({ ...draft, badge: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold">مكان الظهور</span>
                <select
                  className={inputCls}
                  value={draft.placement}
                  onChange={(e) =>
                    setDraft({ ...draft, placement: e.target.value as BannerPlacement })
                  }
                >
                  {(Object.keys(placementLabels) as BannerPlacement[]).map((k) => (
                    <option key={k} value={k}>
                      {placementLabels[k]}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  المقاس المناسب: {bannerSizes[draft.placement].size}
                </span>
              </label>
              <label className="block">
                <span className="text-xs font-bold">القسم (اختياري)</span>
                <select
                  className={inputCls}
                  value={draft.category_id}
                  onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}
                >
                  <option value="">عام (كل المتجر)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parent_id ? "— " : ""}
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  عند اختيار قسم، يظهر هذا الإعلان في أعلى صفحة ذلك القسم فقط.
                </span>
              </label>
              <label className="block">
                <span className="text-xs font-bold">نص الزر</span>
                <input
                  className={inputCls}
                  value={draft.cta_label}
                  onChange={(e) => setDraft({ ...draft, cta_label: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold">رابط الزر</span>
                <input
                  dir="ltr"
                  className={inputCls}
                  value={draft.cta_url}
                  onChange={(e) => setDraft({ ...draft, cta_url: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold">الترتيب</span>
                <input
                  type="number"
                  className={inputCls}
                  value={draft.sort_order}
                  onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 pt-6 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                />
                إعلان مفعّل
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-border p-4">
              <p className="text-xs font-bold">صورة الإعلان</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                المقاس المناسب لهذا المكان: {bannerSizes[draft.placement].size} — نسبة{" "}
                {bannerSizes[draft.placement].ratio}.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {draft.image && (
                  <SmartImage
                    paths={[draft.image]}
                    fallback={fallbackFor("offers")}
                    alt="صورة الإعلان"
                    className="h-20 w-32 rounded-xl object-cover"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={busy}
                  onChange={(e) => onUpload(e.target.files?.[0])}
                  className="text-xs"
                />
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={generating}
                  className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-[11px] font-bold text-primary disabled:opacity-60"
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  توليد صورة بالذكاء الاصطناعي (اختياري)
                </button>
                {draft.image && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, image: "" })}
                    className="rounded-lg bg-destructive/10 px-3 py-2 text-[11px] font-bold text-destructive"
                  >
                    إزالة الصورة
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 rounded-xl gradient-gold py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                حفظ
              </button>
              <button
                onClick={() => setDraft(null)}
                className="rounded-xl border border-border px-6 text-sm font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
