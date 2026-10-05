import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import type { Category } from "@/lib/store";

/** شريط ماركات دائري بحركة لا نهائية — يُستخدم في صفحة الأقسام. */
export function BrandRing({ brands }: { brands: Category[] }) {
  if (brands.length === 0) return null;
  const loop = [...brands, ...brands];
  return (
    <div className="marquee-wrap -mx-4 mt-4 overflow-hidden px-4">
      <div className="marquee-track flex gap-4">
        {loop.map((b, i) => (
          <Link
            key={`${b.id}-${i}`}
            to="/products"
            search={{ category: b.slug }}
            className="group flex w-[76px] shrink-0 flex-col items-center gap-1.5 sm:w-[88px]"
          >
            <span className="h-[68px] w-[68px] overflow-hidden rounded-full border border-border bg-muted transition-colors group-hover:border-primary sm:h-20 sm:w-20">
              <SmartImage
                paths={b.image ? [b.image] : b.cover_image ? [b.cover_image] : []}
                fallback={fallbackFor(b.slug)}
                alt={b.name}
                width={80}
                height={80}
                sizes="80px"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </span>
            <span className="line-clamp-2 text-center text-[10px] font-bold leading-tight sm:text-[11px]">
              {b.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** تسوّق حسب الماركة: صور دائرية في صفّين مع تمرير أفقي وتمرير تلقائي خفيف. */
export function BrandCarousel({ brands }: { brands: Category[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const paused = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = setInterval(() => {
      if (paused.current) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      // RTL: قيم التمرير سالبة في معظم المتصفحات
      const dir = el.scrollLeft <= -max + 5 || el.scrollLeft >= max - 5 ? -1 : 1;
      el.scrollBy({ left: dir * (el.dir === "ltr" ? 90 : -90), behavior: "smooth" });
      if (dir === -1) el.scrollTo({ left: 0, behavior: "smooth" });
    }, 3500);
    return () => clearInterval(t);
  }, [brands.length]);

  const nudge = (d: number) => {
    paused.current = true;
    ref.current?.scrollBy({ left: d * 240, behavior: "smooth" });
  };

  // صفّان: نوزّع الماركات على أعمدة، كل عمود يحمل ماركتين.
  const columns: Category[][] = [];
  for (let i = 0; i < brands.length; i += 2) columns.push(brands.slice(i, i + 2));

  return (
    <div className="relative mt-5">
      <div
        ref={ref}
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        onTouchStart={() => (paused.current = true)}
        className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {columns.map((col, i) => (
          <div key={i} className="flex shrink-0 snap-start flex-col gap-4">
            {col.map((b) => (
              <Link
                key={b.id}
                to="/products"
                search={{ category: b.slug }}
                className="group flex w-[76px] flex-col items-center gap-1.5 sm:w-[88px]"
              >
                <span className="h-[68px] w-[68px] overflow-hidden rounded-full border border-border bg-muted transition-colors group-hover:border-primary sm:h-20 sm:w-20">
                  <SmartImage
                    paths={b.image ? [b.image] : b.cover_image ? [b.cover_image] : []}
                    fallback={fallbackFor(b.slug)}
                    alt={b.name}
                    width={80}
                    height={80}
                    sizes="80px"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </span>
                <span className="line-clamp-2 text-center text-[10px] font-bold leading-tight sm:text-[11px]">
                  {b.name}
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="السابق"
        onClick={() => nudge(1)}
        className="absolute top-1/2 -start-2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-soft md:flex"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="التالي"
        onClick={() => nudge(-1)}
        className="absolute top-1/2 -end-2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-soft md:flex"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}
