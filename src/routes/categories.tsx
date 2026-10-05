import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Search, SlidersHorizontal } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { BrandRing } from "@/components/BrandCarousel";
import { StudioPromoCard } from "@/components/StudioPromoCard";
import { CategoryCardHeader } from "@/components/category/CategoryCardHeader";
import { fallbackFor } from "@/lib/images";
import {
  categoryTreeIds,
  childrenOf,
  rootCategories,
  useCategories,
  useProducts,
  useProductLinks,
} from "@/lib/store";

const title = "أقسام المتجر | إيهاب ستور للعناية والتجميل";
const description =
  "تصفح أقسام إيهاب ستور: العناية بالبشرة، العطور، العناية بالشعر والمكياج مع بحث سريع وفلترة ذكية.";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:image", content: "https://www.ehabstore.app/icon-512.png" },
      { name: "twitter:image", content: "https://www.ehabstore.app/icon-512.png" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app/categories" }],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();
  const { data: products = [] } = useProducts();
  const { data: links = [] } = useProductLinks();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const allRoots = rootCategories(categories);
  const brands = allRoots.filter((c) => c.kind === "brand");
  const roots = allRoots.filter((c) => c.kind !== "brand");
  const q = term.trim();

  const countFor = (id: string) => {
    const ids = categoryTreeIds(categories, id);
    return products.filter(
      (p) =>
        (p.category_id && ids.includes(p.category_id)) ||
        (p.brand_id && ids.includes(p.brand_id)) ||
        links.some((l) => l.product_id === p.id && ids.includes(l.category_id)),
    ).length;
  };

  const catHits = q ? categories.filter((c) => c.name.includes(q)).slice(0, 6) : [];
  const productHits = q ? products.filter((p) => p.name.includes(q)).slice(0, 6) : [];

  const goSearch = () => navigate({ to: "/products", search: { q: q || undefined } });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-32">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl">
          أقسام المتجر
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          استكشف تشكيلاتنا المتخصصة بالبشرة، العطور، الشعر والمكياج بأعلى جودة.
        </p>
      </div>

      {/* Search + filter */}
      <div className="mt-6 flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value.slice(0, 60))}
            onKeyDown={(e) => e.key === "Enter" && goSearch()}
            placeholder="ابحثي عن منتج، قسم، أو ماركة..."
            aria-label="البحث في الأقسام والماركات"
            className="w-full rounded-2xl border border-border bg-card py-2.5 ps-10 pe-4 text-sm font-medium shadow-soft outline-none transition-all placeholder:text-muted-foreground/80 hover:border-primary/60 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>
        <Link
          to="/products"
          search={{ filter: "1" }}
          aria-label="خيارات التصفية"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-foreground shadow-soft transition-all duration-200 hover:border-primary/60 hover:text-primary hover:shadow-lift active:scale-95"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Link>
      </div>

      {q && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-lift animate-in fade-in-50 duration-150">
          {catHits.length === 0 && productHits.length === 0 && (
            <p className="p-4 text-xs font-medium text-muted-foreground">
              لا توجد نتائج مطابقة لبحثك.
            </p>
          )}
          {catHits.map((c) => (
            <Link
              key={c.id}
              to="/products"
              search={{ category: c.slug }}
              className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 text-sm font-bold text-foreground transition-colors hover:bg-secondary/60"
            >
              <span className="truncate">
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </span>
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-primary">
                {c.kind === "brand" ? "ماركة" : c.parent_id ? "قسم فرعي" : "قسم رئيسي"}
              </span>
            </Link>
          ))}
          {productHits.map((p) => (
            <Link
              key={p.id}
              to="/product/$slug"
              params={{ slug: p.id }}
              className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm transition-colors last:border-0 hover:bg-secondary/60"
            >
              <SmartImage
                paths={p.images}
                fallback={fallbackFor(categories.find((c) => c.id === p.category_id)?.slug)}
                alt={p.name}
                className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-soft"
              />
              <span className="truncate font-medium text-foreground">{p.name}</span>
            </Link>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && roots.length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center shadow-soft">
          <p className="text-sm font-bold text-foreground">لا توجد أقسام حالياً</p>
          <p className="mt-1 text-xs text-muted-foreground">
            سيتم إدراج التصنيفات فور إضافتها من لوحة الإدارة.
          </p>
        </div>
      )}

      {/* Store-style category cards */}
      {brands.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-base font-extrabold text-foreground">
            تسوق حسب الماركة العالمية
          </h2>
          <BrandRing brands={brands} />
        </section>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3.5 sm:gap-5 lg:grid-cols-3">
        {roots.map((c) => {
          const kids = childrenOf(categories, c.id);
          return (
            <div
              key={c.id}
              className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              style={c.color ? { borderColor: `${c.color}55` } : undefined}
            >
              <Link
                to="/products"
                search={{ category: c.slug }}
                className="relative block aspect-[4/3] overflow-hidden bg-muted"
              >
                <SmartImage
                  paths={c.cover_image ? [c.cover_image] : c.image ? [c.image] : []}
                  fallback={fallbackFor(c.slug)}
                  alt={c.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute bottom-2.5 end-2.5 rounded-full bg-card/90 px-2.5 py-0.5 text-[10px] font-extrabold tabular-nums text-primary shadow-soft backdrop-blur-md">
                  {countFor(c.id)} منتج
                </span>
              </Link>
              <div className="flex flex-1 flex-col justify-between p-3.5">
                <CategoryCardHeader
                  category={c}
                  subtext={c.description ?? `${kids.length} تصنيفات فرعية`}
                />

                {kids.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/50 pt-2.5">
                    {kids.slice(0, 3).map((k) => (
                      <Link
                        key={k.id}
                        to="/products"
                        search={{ category: k.slug }}
                        className="rounded-lg bg-secondary/80 px-2 py-0.5 text-[10px] font-bold text-foreground transition-colors hover:bg-secondary hover:text-primary"
                      >
                        {k.name}
                      </Link>
                    ))}
                    {kids.length > 3 && (
                      <Link
                        to="/products"
                        search={{ category: c.slug }}
                        className="text-[10px] font-extrabold text-primary self-center"
                      >
                        +{kids.length - 3}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8">
        <StudioPromoCard />
      </div>
    </div>
  );
}
