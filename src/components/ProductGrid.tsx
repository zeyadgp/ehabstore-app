import { useEffect, useRef, useState } from "react";
import { ProductCard, type CardStyle } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { useSettings, type Category, type Product } from "@/lib/store";

/** Grid columns and card style are controlled from the admin dashboard. */
export function useGridSettings() {
  const { data: settings } = useSettings();
  const columns = settings?.grid_columns === 3 ? 3 : 2;
  const style: CardStyle = settings?.card_style === "modern" ? "modern" : "classic";
  return { columns, style };
}

const BATCH_SIZE = 16;

export function ProductGrid({
  products,
  categories,
  className = "mt-6",
  paginate = true,
  isLoading = false,
}: {
  products: Product[];
  categories: Category[];
  className?: string;
  /** Renders items progressively on scroll without a manual button. */
  paginate?: boolean;
  isLoading?: boolean;
}) {
  const { columns, style } = useGridSettings();
  const cols = columns === 3 ? "grid-cols-3 lg:grid-cols-5" : "grid-cols-2 lg:grid-cols-4";
  const gap = columns === 3 ? "gap-2.5 sm:gap-4" : "gap-4";
  const [limit, setLimit] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const key = products.length > 0 ? `${products.length}-${products[0]?.id}` : "empty";

  // Reset the window whenever the product list / filter changes.
  useEffect(() => {
    setLimit(BATCH_SIZE);
  }, [key]);

  const hasMore = paginate && products.length > limit;

  // Infinite progressive scroll: loads more items gradually as user scrolls near bottom
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLimit((prev) => Math.min(prev + BATCH_SIZE, products.length));
        }
      },
      { rootMargin: "400px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, products.length]);

  if (isLoading) {
    return <ProductGridSkeleton count={8} columns={columns} />;
  }

  const visible = paginate ? products.slice(0, limit) : products;

  return (
    <>
      <div className={`grid ${cols} ${gap} ${className}`}>
        {visible.map((p, index) => (
          <div
            key={p.id}
            className="animate-in fade-in-50 duration-300 slide-in-from-bottom-2"
            style={{
              animationDelay: `${Math.min((index % BATCH_SIZE) * 30, 250)}ms`,
            }}
          >
            <ProductCard
              product={p}
              categories={categories}
              variant={style}
              compact={columns === 3}
              eager={index < 4}
            />
          </div>
        ))}
      </div>

      {/* Sentinel element for seamless progressive loading on scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="mt-8 flex justify-center py-4" aria-hidden="true">
          <div className="flex items-center gap-2.5 rounded-full border border-border/80 bg-card/90 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-soft">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            <span>جاري تحميل دفعة المنتجات التالية…</span>
          </div>
        </div>
      )}
    </>
  );
}
