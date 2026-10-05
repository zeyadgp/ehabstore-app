import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { generateCategoryImage } from "@/lib/category-image.functions";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "@/components/SmartImage";
import { uploadImage, useAdminCategories } from "@/lib/admin";
import { fallbackFor } from "@/lib/images";
import {
  childrenOf,
  descendantIds,
  rootCategories,
  slugify,
  type Category,
  type CategoryKind,
  type SmartRule,
} from "@/lib/store";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({
    meta: [{ title: "الأقسام | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminCategories,
});

const inputCls =
  "w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-medium outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

const KIND_LABELS: Record<CategoryKind, string> = {
  standard: "قسم عادي",
  group: "مجموعة منتجات",
  smart: "قسم ذكي",
  brand: "علامة تجارية",
};

const SMART_LABELS: Record<string, string> = {
  bestseller: "الأكثر مبيعًا",
  featured: "الأعلى تقييمًا",
  new: "المنتجات الجديدة",
  deals: "العروض",
  price: "حسب نطاق السعر",
};

function AdminCategories() {
  const qc = useQueryClient();
  const { data: categories = [] } = useAdminCategories();
  const [name, setName] = useState("");
  const [tab, setTab] = useState<CategoryKind>("standard");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const [subFor, setSubFor] = useState<string | null>(null);
  const [subName, setSubName] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [aiFor, setAiFor] = useState<string | null>(null);
  const genImage = useServerFn(generateCategoryImage);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    parent: "",
    order: "0",
    desc: "",
    icon: "",
    color: "",
    kind: "standard" as CategoryKind,
    smartType: "new",
    smartMin: "",
    smartMax: "",
    active: true,
    seoTitle: "",
    seoDesc: "",
    seoKeys: "",
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    await qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const create = async (value: string, parent: string | null) => {
    if (!value.trim()) {
      toast.error("اسم التصنيف مطلوب");
      return false;
    }
    setBusy(true);
    const kind: CategoryKind = parent ? "standard" : tab;
    const { error } = await supabase.from("categories").insert({
      name: value.trim(),
      slug: slugify(value),
      sort_order: categories.filter((c) => (c.parent_id ?? null) === parent).length,
      parent_id: parent,
      kind,
      smart_rule: kind === "smart" ? { type: "new" } : null,
      seo_title: `${value.trim()} | إيهاب ستور للعناية والتجميل`,
      seo_description: `تسوق أفضل منتجات ${value.trim()} الأصلية بأسعار مناسبة مع توصيل لكل محافظات اليمن.`,
      seo_keywords: `${value.trim()}, إيهاب ستور, العناية والتجميل, اليمن`,
    });

    setBusy(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("تمت الإضافة");
    await refresh();
    return true;
  };

  const update = async (c: Category, patch: Record<string, unknown>) => {
    const { error } = await supabase
      .from("categories")

      .update(patch as any)
      .eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await refresh();
    return true;
  };

  const remove = async (c: Category) => {
    if (childrenOf(categories, c.id).length > 0) {
      toast.error("احذفي التصنيفات الفرعية أولاً");
      return;
    }
    if (!confirm(`حذف التصنيف "${c.name}"؟`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحذف");
    await refresh();
  };

  const changeImage = async (
    c: Category,
    file: File | undefined,
    field: "image" | "cover_image" = "image",
  ) => {
    if (!file) return;
    try {
      const path = await uploadImage(file, "categories");
      await update(c, { [field]: path });
      toast.success("تم تحديث الصورة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الرفع");
    }
  };

  /** توليد صورة للقسم بالذكاء الاصطناعي بهوية المتجر (اختياري). */
  const aiImage = async (c: Category, field: "image" | "cover_image" = "image") => {
    setAiFor(c.id + field);
    try {
      const res = await genImage({
        data: { id: c.id, kind: field === "cover_image" ? "cover" : "icon" },
      });
      await refresh();
      toast.success(res.skipped ? "الصورة موجودة مسبقاً" : "تم توليد الصورة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التوليد");
    } finally {
      setAiFor(null);
    }
  };

  /** يولّد صورة لكل قسم لا يملك صورة — بلا حد لعدد الأقسام، ويتابع عند أي تعثّر. */
  const generateMissing = async () => {
    const targets = categories.filter((c) => !c.image);
    if (targets.length === 0) {
      toast.info("كل الأقسام لديها صور");
      return;
    }
    setAiFor("bulk");
    let done = 0;
    let failed = 0;
    for (const c of targets) {
      let okOne = false;
      for (let attempt = 0; attempt < 3 && !okOne; attempt += 1) {
        try {
          await genImage({ data: { id: c.id, kind: "icon" } });
          okOne = true;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (attempt === 2) {
            failed += 1;
            toast.error(`${c.name}: ${msg || "تعذر التوليد"}`);
          } else {
            // انتظار قصير ثم إعادة المحاولة (مثلاً عند ازدحام الخدمة).
            await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
          }
        }
      }
      if (okOne) done += 1;
    }
    setAiFor(null);
    await refresh();
    if (done) toast.success(`تم توليد ${done} صورة${failed ? ` (تعذّر ${failed})` : ""}`);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      parent: c.parent_id ?? "",
      order: String(c.sort_order),
      desc: c.description ?? "",
      icon: c.icon ?? "",
      color: c.color ?? "",
      kind: (c.kind ?? "standard") as CategoryKind,
      smartType: c.smart_rule?.type ?? "new",
      smartMin: c.smart_rule?.min != null ? String(c.smart_rule.min) : "",
      smartMax: c.smart_rule?.max != null ? String(c.smart_rule.max) : "",
      active: c.is_active !== false,
      seoTitle: c.seo_title ?? `${c.name} | إيهاب ستور للعناية والتجميل`,
      seoDesc:
        c.seo_description ?? `تسوق أفضل منتجات ${c.name} الأصلية مع توصيل لكل محافظات اليمن.`,
      seoKeys: c.seo_keywords ?? `${c.name}, إيهاب ستور, العناية والتجميل, اليمن`,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!form.name.trim()) {
      toast.error("اسم التصنيف مطلوب");
      return;
    }
    const rule: SmartRule | null =
      form.kind === "smart"
        ? {
            type: form.smartType as NonNullable<SmartRule["type"]>,
            min: form.smartMin ? Number(form.smartMin) : null,
            max: form.smartMax ? Number(form.smartMax) : null,
          }
        : null;
    const ok = await update(editing, {
      name: form.name.trim(),
      slug: (form.slug.trim() || slugify(form.name)).toLowerCase(),
      parent_id: form.parent || null,
      sort_order: Number(form.order || 0),
      description: form.desc.trim() || null,
      icon: form.icon.trim() || null,
      color: form.color.trim() || null,
      kind: form.kind,
      smart_rule: rule,
      is_active: form.active,
      seo_title: form.seoTitle.trim() || null,
      seo_description: form.seoDesc.trim() || null,
      seo_keywords: form.seoKeys.trim() || null,
    });
    if (ok) {
      toast.success("تم التعديل");
      setEditing(null);
    }
  };

  /** Drag & drop: dropping a category on another reorders it within the same parent, or moves it inside. */
  const onDrop = async (target: Category, inside: boolean) => {
    const source = categories.find((c) => c.id === dragId);
    setDragId(null);
    if (!source || source.id === target.id) return;
    if (descendantIds(categories, source.id).includes(target.id)) {
      toast.error("لا يمكن نقل القسم داخل أحد فروعه");
      return;
    }
    if (inside) {
      await update(source, {
        parent_id: target.id,
        sort_order: childrenOf(categories, target.id).length,
      });
      toast.success(`تم نقل «${source.name}» تحت «${target.name}»`);
      return;
    }
    await update(source, { parent_id: target.parent_id, sort_order: target.sort_order });
    const siblings = childrenOf(categories, target.parent_id ?? "").length;
    await supabase
      .from("categories")
      .update({ sort_order: target.sort_order + 1 })
      .eq("id", target.id);
    void siblings;
    await refresh();
    toast.success("تم تغيير الترتيب");
  };

  const parentOptions = (current?: Category) => {
    const blocked = current ? descendantIds(categories, current.id) : [];
    return categories.filter((c) => !blocked.includes(c.id));
  };

  const Row = ({ c, depth }: { c: Category; depth: number }) => {
    const kids = childrenOf(categories, c.id);
    const isOpen = !collapsed[c.id];
    return (
      <div style={{ marginInlineStart: depth ? 20 : 0 }}>
        <div
          draggable
          onDragStart={() => setDragId(c.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.stopPropagation();
            void onDrop(c, e.shiftKey);
          }}
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft transition-all duration-150 hover:border-primary/40 hover:shadow-lift"
          style={
            c.color ? { borderInlineStartWidth: 4, borderInlineStartColor: c.color } : undefined
          }
        >
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground transition-colors hover:text-foreground" />
          {kids.length > 0 ? (
            <button
              onClick={() => setCollapsed((s) => ({ ...s, [c.id]: isOpen }))}
              aria-label="طي أو توسيع"
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-6" />
          )}
          <SmartImage
            paths={c.image ? [c.image] : []}
            fallback={fallbackFor(c.slug)}
            alt={c.name}
            className="h-12 w-12 shrink-0 rounded-xl object-cover shadow-soft"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-extrabold text-foreground">
              {c.icon ? `${c.icon} ` : ""}
              {c.name}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              <span className="font-bold text-foreground/80">
                {KIND_LABELS[(c.kind ?? "standard") as CategoryKind]}
              </span>
              {c.kind === "smart" && c.smart_rule?.type
                ? ` • ${SMART_LABELS[c.smart_rule.type] ?? ""}`
                : ""}
              {` • ${kids.length} فرعي • الترتيب ${c.sort_order}`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              to="/products"
              search={{ category: c.id } as never}
              target="_blank"
              title="عرض منتجات القسم في المتجر"
              className="rounded-xl bg-secondary p-2 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/products?category=${c.id}`;
                navigator.clipboard.writeText(url);
                toast.success(`تم نسخ رابط «${c.name}»`);
              }}
              title="نسخ رابط القسم المباشر"
              className="rounded-xl bg-secondary p-2 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-primary"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => update(c, { is_active: !(c.is_active !== false) })}
              title={c.is_active !== false ? "إخفاء" : "إظهار"}
              className="rounded-xl bg-secondary p-2 text-foreground transition-colors hover:bg-secondary/80"
            >
              {c.is_active !== false ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={() => openEdit(c)}
              title="تعديل"
              className="rounded-xl bg-secondary p-2 text-primary transition-colors hover:bg-secondary/80"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => remove(c)}
              title="حذف"
              className="rounded-xl bg-destructive/10 p-2 text-destructive transition-colors hover:bg-destructive/20"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <label
              title="تغيير الصورة"
              className="cursor-pointer rounded-xl bg-secondary p-2 text-foreground transition-colors hover:bg-secondary/80"
            >
              <ImagePlus className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => changeImage(c, e.target.files?.[0])}
              />
            </label>
            <button
              onClick={() => void aiImage(c)}
              disabled={aiFor === c.id + "image"}
              title="توليد صورة بالذكاء الاصطناعي"
              className="rounded-xl bg-secondary p-2 text-primary transition-colors hover:bg-secondary/80 disabled:opacity-60"
            >
              <Wand2 className={`h-4 w-4 ${aiFor === c.id + "image" ? "animate-pulse" : ""}`} />
            </button>
            <button
              onClick={() => {
                setSubFor(c.id);
                setSubName("");
              }}
              title="إضافة قسم فرعي"
              className="rounded-xl bg-secondary p-2 text-primary transition-colors hover:bg-secondary/80"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {subFor === c.id && (
          <div className="mt-2 flex flex-wrap gap-2" style={{ marginInlineStart: 20 }}>
            <input
              autoFocus
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder={`قسم فرعي جديد تحت: ${c.name}`}
              className={`min-w-40 flex-1 ${inputCls}`}
            />
            <button
              onClick={async () => {
                if (await create(subName, c.id)) {
                  setSubName("");
                  setSubFor(null);
                }
              }}
              disabled={busy}
              className="rounded-2xl gradient-gold px-5 py-2 text-xs font-extrabold text-primary-foreground shadow-soft transition-all hover:opacity-95 disabled:opacity-60"
            >
              حفظ
            </button>
            <button
              onClick={() => setSubFor(null)}
              className="rounded-2xl border border-border bg-background px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-secondary"
            >
              إلغاء
            </button>
          </div>
        )}

        {isOpen && kids.length > 0 && (
          <div className="mt-2 space-y-2 border-s-2 border-primary/20 ps-3">
            {kids.map((k) => (
              <Row key={k.id} c={k} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const TABS: { key: CategoryKind; label: string }[] = [
    { key: "standard", label: "الأقسام الرئيسية" },
    { key: "brand", label: "الماركات التجارية" },
    { key: "smart", label: "الأقسام الذكية" },
  ];
  const term = q.trim().toLowerCase();
  const roots = rootCategories(categories)
    .filter((c) => {
      const kind = (c.kind ?? "standard") as CategoryKind;
      return tab === "standard" ? kind === "standard" || kind === "group" : kind === tab;
    })
    .filter((c) => !term || c.name.toLowerCase().includes(term));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl">
            إدارة الكتالوج والأقسام
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            تنظيم شجرة الأقسام، الماركات، والأقسام الذكية مع دعم السحب والإفلات وتوليد الصور بالذكاء
            الاصطناعي.
          </p>
        </div>
        <Link
          to="/categories"
          target="_blank"
          className="flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground shadow-soft"
          title="فتح صفحة تصفح الأقسام في المتجر"
        >
          <ExternalLink className="h-4 w-4" />
          <span>صفحة الأقسام بالمتجر</span>
        </Link>
      </div>

      <div className="flex gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-soft">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all duration-200 ${
              tab === t.key
                ? "gradient-gold text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2.5 rounded-3xl border border-border bg-card p-4 shadow-soft">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث في الأقسام والماركات…"
          className={`min-w-32 flex-1 ${inputCls}`}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            tab === "brand"
              ? "اسم ماركة جديدة..."
              : tab === "smart"
                ? "اسم قسم ذكي جديد..."
                : "اسم قسم رئيسي جديد..."
          }
          className={`min-w-44 flex-1 ${inputCls}`}
        />
        <button
          onClick={async () => {
            if (await create(name, null)) setName("");
          }}
          disabled={busy}
          className="flex items-center gap-2 rounded-2xl gradient-gold px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-soft transition-all hover:opacity-95 active:scale-95 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />{" "}
          {tab === "brand" ? "إضافة ماركة" : tab === "smart" ? "إضافة قسم ذكي" : "إضافة قسم رئيسي"}
        </button>

        <button
          onClick={() => void generateMissing()}
          disabled={aiFor === "bulk"}
          className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-extrabold text-primary transition-all hover:border-primary/60 hover:bg-secondary disabled:opacity-60"
        >
          <Wand2 className={`h-4 w-4 ${aiFor === "bulk" ? "animate-pulse" : ""}`} />
          توليد صور الأقسام الناقصة
        </button>
      </div>

      <div className="space-y-3">
        {roots.map((c) => (
          <Row key={c.id} c={c} depth={0} />
        ))}
        {roots.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center shadow-soft">
            <p className="text-xs font-bold text-foreground">لا توجد أقسام مسجلة في هذا التبويب</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              أضف قسماً جديداً باستخدام النموذج أعلاه.
            </p>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-50 duration-200">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-lift">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="font-display text-lg font-extrabold text-foreground">
                تعديل بيانات القسم
              </h2>
              <button
                onClick={() => setEditing(null)}
                aria-label="إغلاق النافذة"
                className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-bold">الاسم</span>
                <input
                  className={`mt-1 ${inputCls}`}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold">الرابط (slug)</span>
                <input
                  className={`mt-1 ${inputCls}`}
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold">يتبع لـ</span>
                <select
                  className={`mt-1 ${inputCls}`}
                  value={form.parent}
                  onChange={(e) => setForm({ ...form, parent: e.target.value })}
                >
                  <option value="">قسم رئيسي</option>
                  {parentOptions(editing).map((r) => (
                    <option key={r.id} value={r.id}>
                      تحت: {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold">نوع القسم</span>
                <select
                  className={`mt-1 ${inputCls}`}
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value as CategoryKind })}
                >
                  {Object.entries(KIND_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {form.kind === "smart" && (
                <div className="space-y-3 rounded-2xl bg-secondary/40 p-3">
                  <label className="block">
                    <span className="text-xs font-bold">شرط القسم الذكي</span>
                    <select
                      className={`mt-1 ${inputCls}`}
                      value={form.smartType}
                      onChange={(e) => setForm({ ...form, smartType: e.target.value })}
                    >
                      {Object.entries(SMART_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  {form.smartType === "price" && (
                    <div className="flex gap-2">
                      <input
                        className={inputCls}
                        placeholder="أقل سعر"
                        value={form.smartMin}
                        onChange={(e) => setForm({ ...form, smartMin: e.target.value })}
                      />
                      <input
                        className={inputCls}
                        placeholder="أعلى سعر"
                        value={form.smartMax}
                        onChange={(e) => setForm({ ...form, smartMax: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}
              <label className="block">
                <span className="text-xs font-bold">الوصف</span>
                <textarea
                  rows={3}
                  className={`mt-1 ${inputCls}`}
                  value={form.desc}
                  onChange={(e) => setForm({ ...form, desc: e.target.value })}
                />
              </label>
              <div className="flex gap-2">
                <label className="block flex-1">
                  <span className="text-xs font-bold">أيقونة (رمز)</span>
                  <input
                    className={`mt-1 ${inputCls}`}
                    placeholder="مثال: ✨"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["🏷️", "🔥", "💸", "🎁", "✨", "💄", "🧴", "🌸", "💇‍♀️", "🔌"].map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setForm({ ...form, icon: ic })}
                        aria-label={`اختيار الأيقونة ${ic}`}
                        className={`rounded-lg border px-2 py-1 text-base ${form.icon === ic ? "border-primary bg-secondary" : "border-border"}`}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="block flex-1">
                  <span className="text-xs font-bold">لون القسم</span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="color"
                      aria-label="لون"
                      className="h-10 w-12 rounded-xl border border-border bg-background"
                      value={form.color || "#D4AF37"}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder="#D4AF37"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                    />
                  </div>
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-secondary/40 p-3">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span className="text-xs font-bold">القسم مفعّل ويظهر في المتجر</span>
              </label>
              <label className="block">
                <span className="text-xs font-bold">الترتيب</span>
                <input
                  type="number"
                  className={`mt-1 ${inputCls}`}
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: e.target.value })}
                />
              </label>
              <div className="flex gap-2">
                <label className="flex flex-1 cursor-pointer items-center justify-between rounded-xl border border-dashed border-border p-3 text-xs font-bold text-primary">
                  صورة الغلاف
                  <ImagePlus className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => changeImage(editing, e.target.files?.[0], "cover_image")}
                  />
                </label>
                <button
                  onClick={() => void aiImage(editing, "cover_image")}
                  disabled={aiFor === editing.id + "cover_image"}
                  title="توليد غلاف بالذكاء الاصطناعي"
                  className="rounded-xl border border-border px-3 text-primary disabled:opacity-60"
                >
                  <Wand2
                    className={`h-4 w-4 ${aiFor === editing.id + "cover_image" ? "animate-pulse" : ""}`}
                  />
                </button>
              </div>
              <div className="space-y-3 rounded-2xl bg-secondary/40 p-3">
                <p className="text-xs font-extrabold">تحسين الظهور (SEO)</p>
                <input
                  className={inputCls}
                  placeholder="عنوان الصفحة"
                  value={form.seoTitle}
                  onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                />
                <textarea
                  rows={2}
                  className={inputCls}
                  placeholder="وصف الصفحة"
                  value={form.seoDesc}
                  onChange={(e) => setForm({ ...form, seoDesc: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="الكلمات المفتاحية"
                  value={form.seoKeys}
                  onChange={(e) => setForm({ ...form, seoKeys: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={saveEdit}
                className="flex-1 rounded-xl gradient-gold py-3 text-sm font-bold text-primary-foreground"
              >
                حفظ
              </button>
              <button
                onClick={() => setEditing(null)}
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
