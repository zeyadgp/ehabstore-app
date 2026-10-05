import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  Eye,
  Filter,
  Layers,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Heart,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "@/components/SmartImage";
import { Stars } from "@/components/Stars";
import { useAdminReviews, type Review } from "@/lib/reviews";
import { useCategories, useProducts } from "@/lib/store";
import { useAdmin } from "@/hooks/useAdmin";
import { syncProductRatingToMeta } from "@/lib/meta/api";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({
    meta: [
      { title: "إدارة المراجعات والتقييمات | لوحة التحكم" },
      {
        name: "description",
        content: "مراجعة وتأكيد ورفض تقييمات العملاء لمنتجات المتجر مع الربط التلقائي بميتا.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "إدارة المراجعات | لوحة التحكم" },
      { property: "og:description", content: "تأكيد أو رفض تقييمات العملاء وربطها مع ميتا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminReviews,
});

type FilterStatus = "pending" | "approved" | "all";

function AdminReviews() {
  const qc = useQueryClient();
  const { data: list = [], isLoading, isRefetching } = useAdminReviews();
  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategories();
  const { can, isViewer, isAddOnly } = useAdmin();

  const canEdit = can("manage_content") && !isViewer && !isAddOnly;
  const canDelete = can("delete_content") && !isViewer && !isAddOnly;

  const [statusFilter, setStatusFilter] = useState<FilterStatus>("pending");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [syncingAllMeta, setSyncingAllMeta] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const productMap = useMemo(() => {
    const m = new Map<string, (typeof products)[number]>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, (typeof categories)[number]>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const counts = useMemo(() => {
    const pending = list.filter((r) => !r.is_approved).length;
    const approved = list.filter((r) => r.is_approved).length;
    const total = list.length;
    const totalStars = list.reduce((s, r) => s + (Number(r.rating) || 0), 0);
    const avgRating = total > 0 ? (totalStars / total).toFixed(1) : "0.0";
    return { pending, approved, total, avgRating };
  }, [list]);

  const filteredReviews = useMemo(() => {
    return list.filter((r) => {
      // 1. Status Filter
      if (statusFilter === "pending" && r.is_approved) return false;
      if (statusFilter === "approved" && !r.is_approved) return false;

      // 2. Rating Filter
      if (ratingFilter !== "all" && Math.round(r.rating) !== Number(ratingFilter)) return false;

      // 3. Product Filter
      if (productFilter !== "all" && r.product_id !== productFilter) return false;

      // 4. Category Filter
      if (categoryFilter !== "all") {
        const prod = productMap.get(r.product_id);
        if (prod?.category_id !== categoryFilter) return false;
      }

      // 5. Search Query (Customer name, comment, product name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const prod = productMap.get(r.product_id);
        const nameMatch = r.customer_name?.toLowerCase().includes(q);
        const commentMatch = r.comment?.toLowerCase().includes(q);
        const prodMatch = prod?.name?.toLowerCase().includes(q);
        if (!nameMatch && !commentMatch && !prodMatch) return false;
      }

      return true;
    });
  }, [list, statusFilter, ratingFilter, productFilter, categoryFilter, searchQuery, productMap]);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
    await qc.invalidateQueries({ queryKey: ["review-stats"] });
    await qc.invalidateQueries({ queryKey: ["product-reviews"] });
  };

  const setApproved = async (r: Review, approved: boolean) => {
    setBusy(r.id);
    const { error } = await supabase
      .from("product_reviews")
      .update({ is_approved: approved })
      .eq("id", r.id);

    if (error) {
      setBusy(null);
      toast.error(error.message);
      return;
    }

    toast.success(approved ? "تم اعتماد المراجعة بنجاح" : "تم إخفاء المراجعة من المتجر");
    await refresh();

    if (approved) {
      // مزامنة صامتة وتلقائية مع كتالوج ميتا
      const productReviews = list.filter(
        (x) => x.product_id === r.product_id && (x.is_approved || x.id === r.id),
      );
      const total = productReviews.reduce((s, x) => s + Number(x.rating), 0);
      const count = productReviews.length;
      const avg = count > 0 ? total / count : r.rating;
      void syncProductRatingToMeta(r.product_id, avg, count).then((res) => {
        if (res.success) {
          toast.success("تم تحديث تقييم المنتج في كتالوج ميتا (Meta Catalog)", { duration: 2500 });
        }
      });
    }
    setBusy(null);
  };

  const approveAllPending = async () => {
    const pending = filteredReviews.filter((r) => !r.is_approved);
    if (pending.length === 0) {
      toast.info("لا توجد مراجعات بانتظار الاعتماد في القائمة الحالية.");
      return;
    }

    setBusy("all");
    const ids = pending.map((r) => r.id);
    const { error } = await supabase
      .from("product_reviews")
      .update({ is_approved: true })
      .in("id", ids);

    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`تم اعتماد ${ids.length} مراجعة بنجاح`);
    await refresh();

    // Sync affected products to Meta
    const productIds = Array.from(new Set(pending.map((p) => p.product_id)));
    for (const pid of productIds) {
      const pReviews = list.filter((x) => x.product_id === pid);
      const total = pReviews.reduce((s, x) => s + Number(x.rating), 0);
      const count = pReviews.length;
      if (count > 0) {
        void syncProductRatingToMeta(pid, total / count, count);
      }
    }
  };

  const remove = async (r: Review) => {
    if (!confirm(`هل أنت متأكد من حذف مراجعة العميل "${r.customer_name}"؟`)) {
      return;
    }
    setBusy(r.id);
    const { error } = await supabase.from("product_reviews").delete().eq("id", r.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حذف المراجعة نهائياً");
    await refresh();
  };

  const syncAllRatingsToMeta = async () => {
    setSyncingAllMeta(true);
    let successCount = 0;
    try {
      const approvedReviews = list.filter((r) => r.is_approved);
      const grouped: Record<string, { total: number; count: number }> = {};

      for (const r of approvedReviews) {
        const entry = grouped[r.product_id] ?? { total: 0, count: 0 };
        entry.total += Number(r.rating) || 0;
        entry.count += 1;
        grouped[r.product_id] = entry;
      }

      for (const [pid, data] of Object.entries(grouped)) {
        const avg = data.count > 0 ? data.total / data.count : 0;
        const res = await syncProductRatingToMeta(pid, avg, data.count);
        if (res.success) successCount += 1;
      }

      toast.success(`تمت مزامنة تقييمات ${successCount} منتج مع كتالوج ميتا بنجاح`);
    } catch {
      toast.error("حدث خطأ أثناء مزامنة التقييمات مع ميتا");
    } finally {
      setSyncingAllMeta(false);
    }
  };

  const statusTabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: "pending", label: "بانتظار الاعتماد", count: counts.pending },
    { key: "approved", label: "المعتمدة", count: counts.approved },
    { key: "all", label: "كافة المراجعات", count: counts.total },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* رأس الصفحة والإحصائيات */}
      <header className="rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-foreground md:text-2xl">
                إدارة مراجعات العملاء
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> ربط ميتا تلقائي
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">
              مراجعة تقييمات العملاء والتأكد منها قبل ظهورها على المتجر، مع مزامنة فورية لتصنيف
              المنتجات في Meta Catalog.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isRefetching}
              onClick={() => void refresh()}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold transition hover:border-primary active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
              تحديث
            </button>

            {canEdit && (
              <button
                type="button"
                disabled={syncingAllMeta}
                onClick={() => void syncAllRatingsToMeta()}
                className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-primary/10 active:scale-95 disabled:opacity-50"
                title="مزامنة كافة التقييمات المعتمدة مع إعلانات وكتالوج ميتا"
              >
                <Share2
                  className={`h-3.5 w-3.5 ${syncingAllMeta ? "animate-spin text-primary" : ""}`}
                />
                {syncingAllMeta ? "جاري المزامنة…" : "مزامنة الكل مع ميتا"}
              </button>
            )}

            {canEdit && counts.pending > 0 && statusFilter === "pending" && (
              <button
                type="button"
                disabled={busy === "all"}
                onClick={() => void approveAllPending()}
                className="flex items-center gap-1.5 rounded-xl gradient-gold px-4 py-2 text-xs font-extrabold text-primary-foreground shadow-soft transition hover:opacity-95 active:scale-95 disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" /> اعتماد كل المعلق
              </button>
            )}
          </div>
        </div>

        {/* بطاقات الإحصائيات السريعة */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-border bg-background p-3.5 text-center shadow-2xs">
            <p className="text-[11px] font-bold text-muted-foreground">بانتظار المراجعة</p>
            <p className="mt-1 text-2xl font-black text-amber-500">{counts.pending}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-3.5 text-center shadow-2xs">
            <p className="text-[11px] font-bold text-muted-foreground">المراجعات المعتمدة</p>
            <p className="mt-1 text-2xl font-black text-emerald-600">{counts.approved}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-3.5 text-center shadow-2xs">
            <p className="text-[11px] font-bold text-muted-foreground">إجمالي المراجعات</p>
            <p className="mt-1 text-2xl font-black text-foreground">{counts.total}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-3.5 text-center shadow-2xs">
            <p className="text-[11px] font-bold text-muted-foreground">متوسط تقييم المتجر</p>
            <div className="mt-1 flex items-center justify-center gap-1 text-2xl font-black text-primary">
              <span>{counts.avgRating}</span>
              <Heart className="h-5 w-5 fill-primary text-primary" />
            </div>
          </div>
        </div>

        {/* تبويبات الحالة والفلاتر */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {statusTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatusFilter(t.key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
                  statusFilter === t.key
                    ? "gradient-gold text-primary-foreground shadow-soft"
                    : "border border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground"
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                    statusFilter === t.key
                      ? "bg-white/20 text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* شريط البحث السريع */}
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 start-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم العميل أو المنتج أو التعليق..."
              className="w-full rounded-2xl border border-border bg-background py-1.5 ps-9 pe-3 text-xs outline-none focus:border-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 end-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* فلاتر التصنيف والمنتجات والنجوم */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {/* فلترة بالقسم */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setProductFilter("all");
              }}
              className="w-full appearance-none rounded-xl border border-border bg-background py-2 pe-8 ps-3 text-xs font-bold text-foreground outline-none focus:border-primary"
            >
              <option value="all">كافة الأقسام والتصنيفات</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  قسم: {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 end-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* فلترة بالمنتج */}
          <div className="relative">
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-background py-2 pe-8 ps-3 text-xs font-bold text-foreground outline-none focus:border-primary"
            >
              <option value="all">كافة المنتجات</option>
              {products
                .filter((p) => categoryFilter === "all" || p.category_id === categoryFilter)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 end-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* فلترة بالتقييم والنجوم */}
          <div className="relative">
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-background py-2 pe-8 ps-3 text-xs font-bold text-foreground outline-none focus:border-primary"
            >
              <option value="all">كافة التقييمات بالنجوم</option>
              <option value="5">★★★★★ (5 نجوم فقط)</option>
              <option value="4">★★★★☆ (4 نجوم)</option>
              <option value="3">★★★☆☆ (3 نجوم)</option>
              <option value="2">★★☆☆☆ (نجمتان)</option>
              <option value="1">★☆☆☆☆ (نجمة واحدة)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 end-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </header>

      {/* قائمة المراجعات */}
      <section className="space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex gap-4 rounded-3xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-10 w-full animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && filteredReviews.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-soft">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
              <Filter className="h-6 w-6" />
            </div>
            <p className="mt-3 text-base font-bold text-foreground">
              لا توجد مراجعات تطابق الفلاتر المحددة
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              يمكنك تغيير فلتر الحالة أو البحث لعرض باقي المراجعات.
            </p>
            {(statusFilter !== "all" ||
              categoryFilter !== "all" ||
              productFilter !== "all" ||
              ratingFilter !== "all" ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setCategoryFilter("all");
                  setProductFilter("all");
                  setRatingFilter("all");
                  setSearchQuery("");
                }}
                className="mt-4 rounded-xl border border-border px-4 py-2 text-xs font-bold text-primary hover:bg-secondary"
              >
                إعادة ضبط كافة الفلاتر
              </button>
            )}
          </div>
        )}

        {!isLoading &&
          filteredReviews.map((r) => {
            const product = productMap.get(r.product_id);
            const category = product?.category_id ? categoryMap.get(product.category_id) : null;
            const image = product?.images?.[0];

            return (
              <article
                key={r.id}
                className="group flex flex-col gap-4 rounded-3xl border border-border bg-card p-4.5 shadow-soft transition-all duration-200 hover:border-primary/50 sm:flex-row sm:items-start"
              >
                {/* صورة المنتج مع إمكانية التكبير والمعاينة */}
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-muted">
                  {image ? (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(image)}
                      className="h-full w-full cursor-zoom-in"
                      title="معاينة الصورة"
                    >
                      <SmartImage
                        src={image}
                        alt={product?.name ?? ""}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </button>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Heart className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                </div>

                {/* تفاصيل المراجعة والتصنيف */}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-sm text-foreground">
                      {r.customer_name || "عميل"}
                    </span>
                    <Stars value={Number(r.rating)} size="xs" />
                    <span className="text-xs font-black text-primary">
                      {Number(r.rating).toFixed(1)}
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                        r.is_approved
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {r.is_approved ? "✓ معتمدة وظاهرة بالمتجر" : "⏳ بانتظار المراجعة والتأكيد"}
                    </span>

                    {category && (
                      <span className="flex items-center gap-1 rounded-md border border-border bg-secondary/70 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        <Layers className="h-3 w-3 text-primary" />
                        {category.name}
                      </span>
                    )}
                  </div>

                  {/* اسم المنتج والتوثيق */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">
                      {product?.name ?? "منتج غير معروف"}
                    </span>
                    {product?.sku && (
                      <span className="text-[10px] opacity-75 font-mono">({product.sku})</span>
                    )}
                    <span>•</span>
                    <time dateTime={r.created_at} className="text-[11px]">
                      {new Date(r.created_at).toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  </div>

                  {/* نص المراجعة أو التعليق */}
                  {r.comment ? (
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-3 text-xs leading-relaxed text-foreground">
                      "{r.comment}"
                    </div>
                  ) : (
                    <p className="text-[11px] italic text-muted-foreground/80">
                      (تقييم بالنجوم بدون تعليق نصي)
                    </p>
                  )}
                </div>

                {/* أزرار الإجراءات */}
                {(canEdit || canDelete) && (
                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    {canEdit && !r.is_approved && (
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void setApproved(r, true)}
                        className="flex items-center gap-1.5 rounded-xl gradient-gold px-3.5 py-2 text-xs font-extrabold text-primary-foreground shadow-soft transition hover:opacity-95 active:scale-95 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> تأكيد ونشر
                      </button>
                    )}

                    {canEdit && r.is_approved && (
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void setApproved(r, false)}
                        className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground transition hover:border-amber-500 hover:text-amber-500 active:scale-95 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> إخفاء
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void remove(r)}
                        aria-label="حذف المراجعة"
                        title="حذف المراجعة"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-destructive transition hover:border-destructive hover:bg-destructive/10 active:scale-95 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
      </section>

      {/* نافذة معاينة وتكبير الصور */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-[85vh] max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-background p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 end-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black"
            >
              <X className="h-4 w-4" />
            </button>
            <SmartImage
              src={previewImage}
              alt="معاينة الصورة"
              className="max-h-[80vh] w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
