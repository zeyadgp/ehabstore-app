import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import { useBanners, type Banner } from "@/lib/banners";
import { categoryTreeIds, useCategories, type Category } from "@/lib/store";

/**
 * بانرات القسم: نفس هوية البانر الحالية لكن على شكل Carousel.
 * إن لم توجد بانرات للقسم نعرض غلاف القسم كما كان تماماً.
 */
export function CategoryBanner({ category, count }: { category: Category; count: number }) {
  const { data: all } = useBanners();
  const { data: categories = [] } = useCategories();
  // بانرات القسم + بانرات كل أقسامه الفرعية (بأي عمق) + بانر إعلاني عام تدور في نفس المكان.
  const treeIds = categoryTreeIds(categories, category.id);
  const own = all.filter((b) => b.category_id && treeIds.includes(b.category_id));
  const ads = all.filter(
    (b) => !b.category_id && (b.placement === "content" || b.placement === "hero"),
  );
  const banners = [...own, ...ads];
  const [i, setI] = useState(0);
  const paused = useRef(false);
  const resume = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchX = useRef<number | null>(null);

  /** إيقاف مؤقت بعد تدخل المستخدم ثم استئناف الدوران اللانهائي تلقائياً. */
  const holdThenResume = () => {
    paused.current = true;
    if (resume.current) clearTimeout(resume.current);
    resume.current = setTimeout(() => {
      paused.current = false;
    }, 8000);
  };

  useEffect(() => {
    setI(0);
  }, [category.id, banners.length]);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      if (!paused.current) setI((v) => (v + 1) % banners.length);
    }, 5500);
    return () => clearInterval(t);
  }, [banners.length]);

  const header = (b: Banner | null) => {
    const bannerTitle =
      b?.title || `${category.icon ? `${category.icon} ` : ""}${category.name}`;
    const bannerDesc =
      b?.subtitle || category.description || `${count} منتج متاح الآن في هذا القسم`;
    const url = b?.cta_url || "";
    const ctaCls =
      "inline-flex w-fit items-center gap-2 rounded-2xl gradient-gold px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-lift transition-opacity hover:opacity-90 sm:px-6 sm:py-3 sm:text-sm";
    return (
      <div
        key={b?.id ?? "cover"}
        className="relative aspect-[4/3] w-full animate-fade-in bg-muted sm:aspect-[16/7] lg:aspect-[21/8]"
      >
        <SmartImage
          paths={
            b?.image
              ? [b.image]
              : category.cover_image
                ? [category.cover_image]
                : category.image
                  ? [category.image]
                  : []
          }
          fallback={fallbackFor(category.slug)}
          alt={bannerTitle}
          eager
          wrapperClassName="absolute inset-0"
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-background/95 via-background/70 to-transparent sm:bg-gradient-to-l sm:from-background/95 sm:via-background/70 sm:to-transparent" />
        <div className={`relative z-10 flex h-full flex-col justify-end gap-2 p-4 sm:max-w-lg sm:justify-center sm:gap-3 sm:p-10 ${banners.length > 1 ? "pb-8" : ""}`}>
          {b?.badge && (
            <span className="w-fit rounded-full border border-primary/30 bg-card/90 px-3 py-1 text-[10px] font-bold text-primary backdrop-blur-sm">
              {b.badge}
            </span>
          )}
          {b ? (
            <h2 className="text-lg font-extrabold leading-tight text-foreground sm:text-3xl">{bannerTitle}</h2>
          ) : (
            <h1 className="text-lg font-extrabold leading-tight text-foreground sm:text-3xl">{bannerTitle}</h1>
          )}
          <p className="line-clamp-3 whitespace-pre-line text-xs leading-6 text-muted-foreground sm:line-clamp-none sm:text-sm sm:leading-7">
            {bannerDesc}
          </p>
          {b?.cta_label && url &&
            (url.startsWith("http") ? (
              <a href={url} target="_blank" rel="noreferrer" className={ctaCls}>
                {b.cta_label} <ArrowLeft className="h-4 w-4 shrink-0" />
              </a>
            ) : (
              <Link to={url} className={ctaCls}>
                {b.cta_label} <ArrowLeft className="h-4 w-4 shrink-0" />
              </Link>
            ))}
        </div>
      </div>
    );
  };

  if (banners.length === 0) {
    return (
      <header className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        {header(null)}
      </header>
    );
  }

  const active = banners[Math.min(i, banners.length - 1)]!;
  const step = (d: number) => {
    holdThenResume();
    setI((v) => (v + d + banners.length) % banners.length);
  };

  return (
    <header
      className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onTouchStart={(e) => {
        holdThenResume();
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        if (start != null && end != null && Math.abs(end - start) > 40) step(end > start ? -1 : 1);
        touchX.current = null;
      }}
    >
      <h1 className="sr-only">{category.name}</h1>
      <div className="relative">
        {header(active)}
        {banners.length > 1 && (
          <>
            <button
              type="button"
              aria-label="السابق"
              onClick={() => step(-1)}
              className="absolute top-1/2 start-2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-card/85 text-foreground shadow-soft backdrop-blur sm:flex"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="التالي"
              onClick={() => step(1)}
              className="absolute top-1/2 end-2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-card/85 text-foreground shadow-soft backdrop-blur sm:flex"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5">
              {banners.map((b, idx) => (
                <button
                  key={b.id}
                  type="button"
                  aria-label={`بانر ${idx + 1}`}
                  onClick={() => {
                    holdThenResume();
                    setI(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === i ? "w-6 gradient-gold" : "w-1.5 bg-border/80"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
