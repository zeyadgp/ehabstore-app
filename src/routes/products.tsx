import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { ProductGrid, useGridSettings } from "@/components/ProductGrid";
import { AdStrip } from "@/components/AdBanner";
import { CategoryBanner } from "@/components/CategoryBanner";
import { ExploreMore } from "@/components/ExploreMore";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import {
  childrenOf,
  productMatchesCategory,
  priceOf,
  rootOf,
  useCategories,
  useInfiniteProducts,
  useProductLinks,
  useProductSync,
} from "@/lib/store";
import { useBrands } from "@/lib/brands";
import { useReviewStats } from "@/lib/reviews";
import { useProductColors } from "@/lib/colors";
import { useProductColorLinks } from "@/lib/options";
import { matchesArabicSearch, rankProductsBySearch } from "@/lib/search";

type SortKey = "newest" | "price-asc" | "price-desc" | "bestseller" | "rating";
type ProductSearch = {
  category?: string | undefined;
  q?: string | undefined;
  sort?: SortKey | undefined;
  filter?: string | undefined;
  min?: string | undefined;
  max?: string | undefined;
  stock?: string | undefined;
  deals?: string | undefined;
  family?: string | undefined;
  rating?: string | undefined;
  new?: string | undefined;
};

const title = "جميع المنتجات | إيهاب ستور للعناية والتجميل";
const description =
  "تصفح جميع منتجات العناية بالبشرة والشعر والمكياج والعطور في إيهاب ستور مع فلترة حسب التصنيف والسعر.";

export const Route = createFileRoute("/products")({
  validateSearch: (search: Record<string, unknown>): ProductSearch => {
    const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);
    const flag = (v: unknown) => (v === "1" ? "1" : undefined);
    return {
      category: str(search["category"]),
      q: str(search["q"]),
      sort: (["price-asc", "price-desc", "bestseller", "rating"] as string[]).includes(
        String(search["sort"]),
      )
        ? (search["sort"] as SortKey)
        : undefined,
      filter: flag(search["filter"]),
      min: str(search["min"]),
      max: str(search["max"]),
      stock: flag(search["stock"]),
      deals: flag(search["deals"]),
      rating: str(search["rating"]),
      new: flag(search["new"]),
    };
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:image", content: "https://www.ehabstore.app/icon-512.png" },
      { name: "twitter:image", content: "https://www.ehabstore.app/icon-512.png" },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://ehabstore.app/products" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app/products" }],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const {
    category = "",
    q = "",
    sort = "newest",
    filter = "",
    min = "",
    max = "",
    stock = "",
    deals = "",
    rating = "",
    new: onlyNew = "",
  } = Route.useSearch();
  const navigate = useNavigate({ from: "/products" });
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  useProductSync();
  const { products, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteProducts();
  const { data: links = [] } = useProductLinks();
  const { data: stats = {} } = useReviewStats();
  const { columns } = useGridSettings();
  const [panelOpen, setPanelOpen] = useState(filter === "1");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const BATCH_SIZE = 16;
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // إعادة تعيين عدد المنتجات المعروضة عند تغيير الفلاتر أو البحث أو التصنيف
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [category, q, sort, min, max, stock, deals, rating, onlyNew]);

  // البحث يكتب محلياً أولاً ثم يُحدّث الرابط بعد توقف الكتابة — بلا تعليق أثناء الطباعة.
  const [term, setTerm] = useState(q ?? "");
  useEffect(() => setTerm(q ?? ""), [q]);

  const activeCat = categories.find((c) => c.slug === category);

  // Climb parent_id all the way up so deep sub-categories still highlight their root chip.
  const activeRoot = activeCat ? rootOf(categories, activeCat) : null;
  const ownKids = activeCat ? childrenOf(categories, activeCat.id) : [];
  const siblings = activeCat?.parent_id ? childrenOf(categories, activeCat.parent_id) : [];
  const subCats = ownKids.length > 0 ? ownKids : siblings;
  const subParent =
    activeCat && ownKids.length > 0
      ? activeCat
      : activeCat?.parent_id
        ? (categories.find((c) => c.id === activeCat.parent_id) ?? activeRoot)
        : activeRoot;
  // فلترة وترتيب مُخزّنان: لا يُعاد الحساب على كامل الكتالوج مع كل إعادة رسم.
  const list = useMemo(() => {
    const catById = new Map(categories.map((c) => [c.id, c]));
    const out = products.filter((p) => {
      const matchCat =
        !activeCat || productMatchesCategory(p, activeCat, categories, links, stats, brands);
      if (!matchCat) return false;
      const pCat = p.category_id ? catById.get(p.category_id) : undefined;
      const brand = p.brand_id ? brands.find((b) => b.id === p.brand_id) : undefined;
      const matchQ =
        !q || matchesArabicSearch(q, p.name, p.description, pCat?.name, p.sku, brand?.name);
      const price = priceOf(p);
      const matchMin = !min || price >= Number(min);
      const matchMax = !max || price <= Number(max);
      const matchStock = stock !== "1" || p.stock > 0;
      const matchDeals = deals !== "1" || (p.discount_price != null && p.discount_price > 0);
      const matchRating = !rating || (stats[p.id]?.avg ?? 0) >= Number(rating);
      const matchNew =
        onlyNew !== "1" || Date.now() - new Date(p.created_at).getTime() < 1000 * 60 * 60 * 24 * 30;
      return matchQ && matchMin && matchMax && matchStock && matchDeals && matchRating && matchNew;
    });
    if (sort === "price-asc") return [...out].sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === "price-desc") return [...out].sort((a, b) => priceOf(b) - priceOf(a));
    if (sort === "bestseller")
      return [...out].sort((a, b) => Number(b.is_bestseller) - Number(a.is_bestseller));
    if (sort === "rating")
      return [...out].sort((a, b) => (stats[b.id]?.avg ?? 0) - (stats[a.id]?.avg ?? 0));
    if (q && q.trim() && (!sort || sort === "newest")) {
      return rankProductsBySearch(out, q);
    }
    return out;
  }, [
    products,
    categories,
    brands,
    links,
    stats,
    activeCat,
    q,
    min,
    max,
    stock,
    deals,
    rating,
    onlyNew,
    sort,
  ]);

  // العرض التدريجي: يعتمد على القائمة المفلترة، لذا يأتي بعد تعريفها.
  const hasMoreToDisplay = visibleCount < list.length || hasNextPage;

  useEffect(() => {
    if (!hasMoreToDisplay || isFetchingNextPage) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          if (visibleCount < list.length) {
            setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, list.length));
          } else if (hasNextPage) {
            void fetchNextPage();
          }
        }
      },
      { rootMargin: "450px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreToDisplay, isFetchingNextPage, visibleCount, list.length, hasNextPage, fetchNextPage]);

  const displayedList = useMemo(() => list.slice(0, visibleCount), [list, visibleCount]);

  const update = (patch: Partial<ProductSearch>) =>
    navigate({
      search: (prev: ProductSearch) => {
        const next = { ...prev, ...patch } as Record<string, string | undefined>;
        Object.keys(next).forEach((k) => {
          if (!next[k]) delete next[k];
        });
        return next as ProductSearch;
      },
    });

  // تأخير بسيط قبل تحديث الرابط بنتيجة البحث.
  useEffect(() => {
    if (term === (q ?? "")) return;
    const t = setTimeout(() => update({ q: term }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  // Per-category SEO: title, description, keywords and breadcrumb structured data.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const seoTitle =
      activeCat?.seo_title ??
      (activeCat ? `${activeCat.name} | إيهاب ستور للعناية والتجميل` : title);
    const seoDesc =
      activeCat?.seo_description ??
      (activeCat
        ? `تسوق منتجات ${activeCat.name} الأصلية من إيهاب ستور مع توصيل لكل محافظات اليمن.`
        : description);
    document.title = seoTitle;
    const setMeta = (key: string, attr: "name" | "property", value: string) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
    };
    setMeta("description", "name", seoDesc);
    setMeta("keywords", "name", activeCat?.seo_keywords ?? "إيهاب ستور, العناية والتجميل, اليمن");
    setMeta("og:title", "property", seoTitle);
    setMeta("og:description", "property", seoDesc);
    const url = activeCat
      ? `https://ehabstore.app/products?category=${encodeURIComponent(activeCat.slug)}`
      : "https://ehabstore.app/products";
    setMeta("og:url", "property", url);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);

    const id = "category-jsonld";
    document.getElementById(id)?.remove();
    if (activeCat) {
      // Full ancestor chain (unlimited depth), not just the direct parent.
      const chain: { name: string; slug: string }[] = [];
      let node = activeCat as typeof activeCat | undefined;
      for (let i = 0; i < 20 && node; i += 1) {
        chain.unshift({ name: node.name, slug: node.slug });
        node = node.parent_id ? categories.find((c) => c.id === node!.parent_id) : undefined;
      }
      const crumbs = [{ name: "الرئيسية", slug: "" }, ...chain];
      const script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          item: c.slug ? `/products?category=${c.slug}` : "/",
        })),
      });
      document.head.appendChild(script);
    }
    return () => document.getElementById(id)?.remove();
  }, [activeCat, categories]);

  const activeFilters =
    (min ? 1 : 0) +
    (max ? 1 : 0) +
    (stock === "1" ? 1 : 0) +
    (deals === "1" ? 1 : 0) +
    (rating ? 1 : 0) +
    (onlyNew === "1" ? 1 : 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-4">
      {/* شريط البحث + الترتيب + الفلتر: ثابت أعلى الصفحة أثناء التمرير */}
      <div className="sticky top-0 z-30 -mx-4 flex items-center gap-2.5 border-b border-border/80 bg-background px-4 py-3 transition-colors">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value.slice(0, 80))}
            placeholder="ابحث بالاسم، الماركة، أو الوصف..."
            aria-label="البحث عن منتج"
            className="w-full rounded-2xl border border-border bg-card py-2.5 ps-10 pe-4 text-sm font-medium shadow-soft outline-none transition-all placeholder:text-muted-foreground/80 hover:border-primary/60 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>

        <select
          value={sort}
          onChange={(e) => update({ sort: e.target.value as SortKey })}
          aria-label="الترتيب"
          className="h-11 cursor-pointer shrink-0 rounded-2xl border border-border bg-card px-3 text-xs font-bold text-foreground shadow-soft outline-none transition-all hover:border-primary/60 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <option value="newest">الأحدث وصولاً</option>
          <option value="price-asc">الأقل سعراً</option>
          <option value="price-desc">الأعلى سعراً</option>
          <option value="bestseller">الأكثر طلباً</option>
          <option value="rating">الأعلى تقييماً</option>
        </select>

        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-label="خيارات التصفية والفلاتر"
          className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border px-3.5 text-xs font-bold shadow-soft transition-all duration-200 active:scale-95 ${
            panelOpen || activeFilters > 0
              ? "border-primary bg-secondary text-primary shadow-lift"
              : "border-border bg-card text-foreground hover:border-primary/60 hover:text-primary"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">تصفية</span>
          {activeFilters > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full gradient-gold px-1 text-[10px] font-extrabold tabular-nums text-primary-foreground">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      <div className="mt-4">
        {activeCat ? (
          <CategoryBanner category={activeCat} count={list.length} />
        ) : (
          <>
            <h1 className="text-center text-2xl font-extrabold sm:text-3xl">جميع المنتجات</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {list.length} منتج متاح الآن
            </p>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {/* رقاقات الفلاتر المُطبّقة — يمكن إزالة كل واحدة بضغطة */}
        {(activeFilters > 0 || q) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {q && <FilterChip label={`بحث: ${q}`} onClear={() => update({ q: "" })} />}
            {min && <FilterChip label={`من ${min}`} onClear={() => update({ min: "" })} />}
            {max && <FilterChip label={`إلى ${max}`} onClear={() => update({ max: "" })} />}
            {stock === "1" && (
              <FilterChip label="المتوفر فقط" onClear={() => update({ stock: "" })} />
            )}
            {deals === "1" && <FilterChip label="عليه خصم" onClear={() => update({ deals: "" })} />}
            {rating && (
              <FilterChip label={`★ ${rating} فأعلى`} onClear={() => update({ rating: "" })} />
            )}
            {onlyNew === "1" && (
              <FilterChip label="وصل حديثاً" onClear={() => update({ new: "" })} />
            )}
            <button
              type="button"
              onClick={() =>
                update({ min: "", max: "", stock: "", deals: "", rating: "", new: "", q: "" })
              }
              className="rounded-full px-2.5 py-1 text-xs font-bold text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              مسح الكل
            </button>
          </div>
        )}

        {panelOpen && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <p className="font-display text-sm font-extrabold text-foreground">
                تصفية نتائج البحث
              </p>
              <button
                type="button"
                onClick={() => {
                  setPanelOpen(false);
                  update({ filter: "" });
                }}
                aria-label="إغلاق الفلتر"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold text-foreground">أقل سعر</span>
                <input
                  type="number"
                  min="0"
                  value={min}
                  onChange={(e) => update({ min: e.target.value })}
                  placeholder="0"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-foreground">أعلى سعر</span>
                <input
                  type="number"
                  min="0"
                  value={max}
                  onChange={(e) => update({ max: e.target.value })}
                  placeholder="بدون حد"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="text-xs font-bold text-foreground">التوفر بالمخزون</span>
                <select
                  value={stock === "1" ? "1" : ""}
                  onChange={(e) => {
                    update({ stock: e.target.value });
                    setPanelOpen(false);
                  }}
                  className="mt-1.5 w-full cursor-pointer rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <option value="">جميع المنتجات</option>
                  <option value="1">المتوفر فقط</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-foreground">التقييم</span>
                <select
                  value={rating}
                  onChange={(e) => {
                    update({ rating: e.target.value });
                    setPanelOpen(false);
                  }}
                  className="mt-1.5 w-full cursor-pointer rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <option value="">كل التقييمات</option>
                  <option value="4">★ 4 نجوم فأعلى</option>
                  <option value="3">★ 3 نجوم فأعلى</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-foreground">العروض والخصومات</span>
                <select
                  value={deals === "1" ? "1" : ""}
                  onChange={(e) => {
                    update({ deals: e.target.value });
                    setPanelOpen(false);
                  }}
                  className="mt-1.5 w-full cursor-pointer rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <option value="">جميع المنتجات</option>
                  <option value="1">عليها خصم فقط</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-foreground">تاريخ الوصول</span>
                <select
                  value={onlyNew === "1" ? "1" : ""}
                  onChange={(e) => {
                    update({ new: e.target.value });
                    setPanelOpen(false);
                  }}
                  className="mt-1.5 w-full cursor-pointer rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <option value="">الكل</option>
                  <option value="1">وصل حديثاً</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => {
                update({
                  min: "",
                  max: "",
                  stock: "",
                  deals: "",
                  category: "",
                  q: "",
                  rating: "",
                  new: "",
                });
                setPanelOpen(false);
              }}
              className="mt-5 w-full rounded-xl border border-border bg-background py-2.5 text-xs font-bold text-muted-foreground transition-all duration-200 hover:border-primary/60 hover:text-primary active:scale-[0.99]"
            >
              إعادة ضبط جميع الفلاتر
            </button>
          </div>
        )}
      </div>

      {subCats.length > 0 && (
        <div className="-mx-4 mt-6 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => update({ category: subParent!.slug })}
            className="flex w-16 shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-[11px] font-extrabold shadow-soft transition-all duration-200 ${
                category === subParent!.slug
                  ? "border-primary bg-secondary text-primary ring-2 ring-primary/20"
                  : "border-border bg-card text-muted-foreground hover:border-primary/60"
              }`}
            >
              الكل
            </span>
            <span className="line-clamp-1 text-[10px] font-bold text-foreground">الكل</span>
          </button>
          {subCats.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => update({ category: s.slug })}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95"
            >
              <span
                className={`h-14 w-14 overflow-hidden rounded-full border-2 shadow-soft transition-all duration-200 ${
                  category === s.slug
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/60"
                }`}
              >
                <SmartImage
                  paths={s.image ? [s.image] : []}
                  fallback={fallbackFor(s.slug)}
                  alt={s.name}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="line-clamp-1 text-[10px] font-bold text-foreground">{s.name}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div
          className={`mt-10 grid gap-4 ${columns === 3 ? "grid-cols-3 lg:grid-cols-5" : "grid-cols-2 lg:grid-cols-4"}`}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft"
            >
              <div className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="mt-14 rounded-3xl border border-border bg-card p-10 text-center shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Search className="h-6 w-6" />
          </div>
          <p className="mt-4 font-display text-base font-extrabold text-foreground">
            لا توجد منتجات مطابقة لبحثك
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            جرّب تغيير كلمات البحث أو إزالة بعض معايير التصفية والأسعار لتظهر المنتجات.
          </p>
          <button
            type="button"
            onClick={() =>
              update({
                q: "",
                min: "",
                max: "",
                stock: "",
                deals: "",
                rating: "",
                new: "",
                category: "",
              })
            }
            className="mt-6 rounded-2xl gradient-gold px-7 py-3 text-xs font-extrabold text-primary-foreground shadow-soft transition-all duration-200 hover:opacity-95 active:scale-95"
          >
            إعادة ضبط البحث بالكامل
          </button>
        </div>
      ) : (
        <>
          <ProductGrid products={displayedList} categories={categories} className="mt-8" />
          {hasMoreToDisplay && (
            <div ref={loadMoreRef} className="mt-10 flex items-center justify-center py-6">
              <div className="flex items-center gap-2.5 rounded-full border border-border/60 bg-card/80 px-4 py-2 text-xs font-bold text-muted-foreground shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>
                  جاري تحميل المزيد من المنتجات ({displayedList.length} من {list.length})…
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <ExploreMore categories={categories} active={activeCat} />

      <AdStrip placement="strip" />
    </div>
  );
}
/** رقاقة فلتر مُطبّق مع زر إزالة. */
function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-secondary px-3 py-1 text-xs font-bold text-primary shadow-soft transition-all duration-150 hover:bg-secondary/80">
      <span>{label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`إزالة ${label}`}
        className="flex h-4 w-4 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary active:scale-95"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
