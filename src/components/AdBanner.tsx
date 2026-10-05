import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import { useBanners, type Banner, type BannerPlacement } from "@/lib/banners";

function Cta({ banner }: { banner: Banner }) {
  if (!banner.cta_label) return null;
  const url = banner.cta_url || "/products";
  const cls =
    "inline-flex items-center gap-2 rounded-2xl gradient-gold px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-lift transition-opacity hover:opacity-90 sm:px-6 sm:py-3 sm:text-sm";
  if (url.startsWith("http")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={cls}>
        {banner.cta_label} <ArrowLeft className="h-4 w-4 shrink-0" />
      </a>
    );
  }
  return (
    <Link to={url} className={cls}>
      {banner.cta_label} <ArrowLeft className="h-4 w-4 shrink-0" />
    </Link>
  );
}

function useAdLoop(count: number, delay = 5500) {
  const [i, setI] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    setI(0);
  }, [count]);

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => {
      if (!paused.current) setI((v) => (v + 1) % count);
    }, delay);
    return () => clearInterval(t);
  }, [count, delay]);

  const hoverProps = {
    onMouseEnter: () => {
      paused.current = true;
    },
    onMouseLeave: () => {
      paused.current = false;
    },
  };

  return { i, setI, hoverProps };
}

export function HeroAds({ fallbackImage }: { fallbackImage: string }) {
  const { data: banners } = useBanners("hero");
  const { i, setI, hoverProps } = useAdLoop(banners.length, 6000);

  if (banners.length === 0) return null;
  const active = Math.min(i, banners.length - 1);

  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto w-full max-w-6xl px-3 pt-3 sm:px-4 sm:pt-4">
        <div
          {...hoverProps}
          className="relative overflow-hidden rounded-3xl border border-border shadow-lift sm:rounded-[2rem]"
        >
          <div className="relative aspect-[4/3] w-full sm:aspect-[16/7] lg:aspect-[21/8]">
            {banners.map((b, idx) => (
              <div
                key={b.id}
                aria-hidden={idx !== active}
                className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                  idx === active ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <SmartImage
                  paths={b.image ? [b.image] : []}
                  fallback={fallbackImage || fallbackFor()}
                  alt={b.title}
                  eager={idx === 0}
                  wrapperClassName="absolute inset-0"
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-background/95 via-background/75 to-background/20 sm:bg-gradient-to-l sm:from-background/95 sm:via-background/75 sm:to-transparent" />
                <div className="relative z-10 flex h-full flex-col justify-center gap-2 p-4 sm:max-w-lg sm:gap-3 sm:p-10">
                  {b.badge && (
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-card/90 px-3 py-1 text-[10px] font-bold text-primary backdrop-blur-sm sm:px-4 sm:py-1.5 sm:text-[11px]">
                      <StoreLogo className="h-3.5 w-3.5 text-primary" /> {b.badge}
                    </span>
                  )}
                  <h2 className="text-lg font-extrabold leading-tight text-foreground sm:text-3xl lg:text-4xl">
                    {b.title}
                  </h2>
                  {b.subtitle && (
                    <p className="line-clamp-2 max-w-md text-[11px] leading-6 text-muted-foreground sm:line-clamp-none sm:text-sm sm:leading-7">
                      {b.subtitle}
                    </p>
                  )}
                  <div className="pt-0.5 sm:pt-1">
                    <Cta banner={b} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {banners.length > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            {banners.map((x, idx) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setI(idx)}
                aria-label={`إعلان ${idx + 1}`}
                className={`h-2 rounded-full transition-all ${
                  idx === active ? "w-7 gradient-gold" : "w-2 bg-border hover:bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function AdStrip({ placement }: { placement: BannerPlacement }) {
  const { data: banners } = useBanners(placement);
  const { i, setI, hoverProps } = useAdLoop(banners.length, placement === "content" ? 5000 : 6500);
  if (banners.length === 0) return null;
  const active = Math.min(i, banners.length - 1);

  return (
    <section className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-4 sm:py-6">
      <div
        {...hoverProps}
        className="group relative overflow-hidden rounded-3xl border border-border shadow-soft"
      >
        <div
          className={
            placement === "content"
              ? "relative aspect-[4/3] w-full sm:aspect-[16/7]"
              : "relative aspect-[16/9] w-full sm:aspect-[16/6]"
          }
        >
          {banners.map((b, idx) => (
            <article
              key={b.id}
              aria-hidden={idx !== active}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                idx === active ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <SmartImage
                paths={b.image ? [b.image] : []}
                fallback={fallbackFor("offers")}
                alt={b.title}
                wrapperClassName="absolute inset-0"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-background/95 via-background/70 to-background/20 sm:bg-gradient-to-l sm:from-background/95 sm:via-background/70 sm:to-transparent" />
              <div className="absolute inset-0 z-10 flex flex-col justify-center gap-1.5 p-4 sm:gap-2 sm:p-8">
                {b.badge && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-card/90 px-3 py-1 text-[10px] font-bold text-primary backdrop-blur-sm">
                    {b.badge}
                  </span>
                )}
                <h3 className="max-w-sm text-base font-extrabold text-foreground sm:text-2xl">
                  {b.title}
                </h3>
                {b.subtitle && (
                  <p className="line-clamp-2 max-w-sm text-[11px] leading-6 text-muted-foreground sm:text-sm">
                    {b.subtitle}
                  </p>
                )}
                {b.cta_label && (
                  <div className="pt-0.5 sm:pt-1">
                    <Cta banner={b} />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        {banners.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((x, idx) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setI(idx)}
                aria-label={`إعلان ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === active ? "w-6 gradient-gold shadow-sm" : "w-1.5 bg-border/80 hover:bg-border"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function TrustTicker() {
  const { data: banners } = useBanners("ticker");
  if (banners.length === 0) return null;
  const items = [...banners, ...banners];
  return (
    <div className="border-y border-border bg-secondary/50">
      <div className="marquee-wrap flex overflow-hidden py-2">
        <div className="marquee-track flex shrink-0 items-center gap-8 whitespace-nowrap px-4">
          {items.map((b, i) => (
            <span
              key={`${b.id}-${i}`}
              className="flex items-center gap-2 text-[11px] font-bold text-foreground sm:text-xs"
            >
              <StoreLogo className="h-3.5 w-3.5 text-primary" />
              {b.title}
              {b.badge && (
                <span className="rounded-full border border-primary/30 bg-card/90 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {b.badge}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
