import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Truck,
  ShieldCheck,
  Search,
  CreditCard,
  MessageCircle,
  UserRound,
  CheckCircle2,
  Heart,
} from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import hero from "@/assets/hero.jpg";
import { ProductGrid } from "@/components/ProductGrid";
import { AdStrip, HeroAds, TrustTicker } from "@/components/AdBanner";
import { SmartImage } from "@/components/SmartImage";
import { BrandCarousel } from "@/components/BrandCarousel";
import { StudioPromoCard } from "@/components/StudioPromoCard";
import { StoreRating } from "@/components/StoreRating";

import { fallbackFor } from "@/lib/images";
import { useQuery } from "@tanstack/react-query";
import {
  settingsQuery,
  categoriesQuery,
  productsQuery,
  testimonialsQuery,
  useCategories,
  useProducts,
  useSettings,
  childrenOf,
  rootCategories,
} from "@/lib/store";

const title = "إيهاب ستور للعناية والتجميل | منتجات أصلية للبشرة والشعر والمكياج";
const description =
  "تسوق أرقى منتجات العناية بالبشرة والشعر والمكياج والعطور من إيهاب ستور. منتجات أصلية 100%، أسعار منافسة، وطلب سريع عبر واتساب.";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    try {
      await Promise.allSettled([
        context.queryClient.ensureQueryData(settingsQuery),
        context.queryClient.ensureQueryData(categoriesQuery),
        context.queryClient.ensureQueryData(productsQuery),
      ]);
    } catch {
      // Graceful fallback if offline
    }
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:image", content: "https://www.ehabstore.app/icon-512.png" },
      { name: "twitter:image", content: "https://www.ehabstore.app/icon-512.png" },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://ehabstore.app" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app" }],
  }),
  component: Index,
});

function Index() {
  const { data: settings } = useSettings();
  const { data: categories = [] } = useCategories();
  const { data: products = [] } = useProducts();
  const { data: testimonials = [] } = useQuery(testimonialsQuery);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const allRoots = rootCategories(categories);
  const roots = allRoots.filter((c) => c.kind !== "brand");
  const brands = allRoots.filter((c) => c.kind === "brand");

  // تُحسب مرة واحدة لكل تحديث للمنتجات — لا تُعاد مع كل حرف يُكتب في البحث.
  const { bestsellers, latest, offers, suggested } = useMemo(() => {
    const best = products.filter((p) => p.is_bestseller).slice(0, 8);
    return {
      bestsellers: best,
      latest: products.slice(0, 8),
      offers: products.filter((p) => p.discount_price && p.discount_price > 0).slice(0, 8),
      suggested: products.filter((p) => p.is_featured && !best.includes(p)).slice(0, 4),
    };
  }, [products]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/products", search: { category: "", q: q.trim(), sort: "newest" } });
  };

  return (
    <div>
      {/* Smart search */}
      <div className="border-b border-border bg-card transition-colors">
        <form
          onSubmit={search}
          className="mx-auto flex max-w-6xl items-center gap-2.5 px-3 py-3 sm:px-4"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-4 w-4 text-primary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحثي عن منتج، قسم، أو ماركة مفضلة..."
              aria-label="بحث في المتجر"
              className="w-full rounded-2xl border border-border bg-background py-2.5 ps-10 pe-4 text-sm font-medium text-foreground outline-none transition-all placeholder:text-muted-foreground/80 hover:border-primary/60 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-2xl gradient-gold px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-soft transition-all duration-200 hover:opacity-95 active:scale-95 sm:text-sm"
          >
            <Search className="h-3.5 w-3.5 sm:hidden" />
            <span>بحث</span>
          </button>
        </form>
      </div>

      <TrustTicker />

      <HeroAds fallbackImage={hero} />

      {/* Hero */}
      <section className="relative overflow-hidden gradient-soft py-10 md:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card px-4 py-1.5 text-xs font-bold text-primary shadow-soft">
              <StoreLogo className="h-4 w-4 text-primary" /> منتجات أصلية 100% ومضمونة
            </span>
            <h1 className="mt-5 font-display text-2xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl">
              {settings?.hero_title ?? (
                <>
                  جمالك يبدأ من <span className="text-gradient-gold">إيهاب ستور</span>
                </>
              )}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {settings?.hero_subtitle ??
                "تشكيلة فاخرة من منتجات العناية بالبشرة والشعر والمكياج والعطور، مختارة بعناية لك بأسعار منافسة وطلب سهل عبر واتساب."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/products"
                className="rounded-xl gradient-gold px-8 py-3 text-sm font-bold text-primary-foreground shadow-soft transition-all duration-200 hover:opacity-95 active:scale-95"
              >
                تسوق الآن
              </Link>
              <Link
                to="/products"
                search={{ category: "offers", q: "", sort: "newest" }}
                className="rounded-xl border border-primary/40 bg-card px-8 py-3 text-sm font-bold text-primary shadow-soft transition-all duration-200 hover:bg-secondary hover:shadow-lift active:scale-95"
              >
                عروض هذا الأسبوع
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick categories */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <SectionTitle title="تسوق حسب التصنيف" subtitle="اختر ما يناسب روتين جمالك اليومي" />
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-4 lg:grid-cols-6">
          {roots.map((c) => (
            <div key={c.id} className="flex flex-col gap-2">
              <Link
                to="/products"
                search={{ category: c.slug, q: "", sort: "newest" }}
                className="group overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift"
              >
                <div className="aspect-square overflow-hidden rounded-xl bg-muted">
                  <SmartImage
                    paths={c.image ? [c.image] : []}
                    fallback={fallbackFor(c.slug)}
                    alt={c.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                <p className="pt-2 text-center text-xs font-bold text-foreground transition-colors group-hover:text-primary sm:text-sm">
                  {c.name}
                </p>
              </Link>
              {childrenOf(categories, c.id).length > 0 && (
                <div className="hidden flex-wrap justify-center gap-1.5 sm:flex">
                  {childrenOf(categories, c.id)
                    .slice(0, 3)
                    .map((sub) => (
                      <Link
                        key={sub.id}
                        to="/products"
                        search={{ category: sub.slug, q: "", sort: "newest" }}
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:border-primary/60 hover:text-primary active:scale-95"
                      >
                        {sub.name}
                      </Link>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-7">
          <StudioPromoCard />
        </div>
      </section>

      {/* Shop by brand — يُبنى تلقائياً من أقسام نوع «ماركة» */}
      {brands.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-4">
          <SectionTitle title="تسوق حسب الماركة" subtitle="ماركات أصلية مختارة بعناية" />
          <BrandCarousel brands={brands} />
        </section>
      )}

      <AdStrip placement="strip" />

      {/* Bestsellers */}
      {bestsellers.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <SectionRow
            title="الأكثر مبيعاً"
            subtitle="اختيارات عميلاتنا المفضلة"
            sort="bestseller"
          />
          <ProductGrid products={bestsellers} categories={categories} className="mt-4" />
        </section>
      )}

      {/* Offers */}
      {offers.length > 0 && (
        <section className="gradient-soft py-8">
          <div className="mx-auto max-w-6xl px-4">
            <SectionRow
              title="عروض وخصومات"
              subtitle="وفّري أكثر على منتجاتك المفضلة"
              category="offers"
            />
            <ProductGrid products={offers} categories={categories} className="mt-4" />
          </div>
        </section>
      )}

      {/* Latest */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <AdStrip placement="content" />
        <SectionRow title="وصل حديثاً" subtitle="أحدث ما أضيف إلى المتجر" />
        <ProductGrid products={latest} categories={categories} className="mt-4" />
      </section>

      {/* Suggested */}
      {suggested.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-8">
          <SectionRow title="منتجات مقترحة لك" subtitle="مختارة بعناية من فريقنا" />
          <ProductGrid products={suggested} categories={categories} className="mt-4" />
        </section>
      )}

      {/* Trust */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "منتجات أصلية 100%", text: "مصادر موثوقة وضمان الجودة" },
            { icon: CreditCard, title: "دفع آمن ومحلي", text: "محافظ وبنوك معتمدة" },
            { icon: Truck, title: "توصيل سريع", text: "لكل المحافظات بعناية فائقة" },
            { icon: MessageCircle, title: "دعم مباشر", text: "خدمة عملاء فورية عبر واتساب" },
          ].map((f) => (
            <div
              key={f.title}
              className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-2xs transition-transform group-hover:scale-105">
                <f.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground transition-colors group-hover:text-primary sm:text-sm">
                  {f.title}
                </p>
                <p className="truncate text-[11px] font-medium text-muted-foreground">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials & Store Rating Box */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <SectionTitle title="آراء وتقييمات العملاء" subtitle="ثقتكم هي رأس مالنا ورضاكم غايتنا" />
        {testimonials.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <figure
                key={t.id}
                className="flex min-h-56 flex-col justify-between rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-primary">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Heart
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < t.rating
                              ? "fill-primary text-primary drop-shadow-xs"
                              : "text-muted-foreground/25"
                          }`}
                        />
                      ))}
                    </div>
                    <span>تقييم موثق ({t.rating} من 5 قلوب)</span>
                  </div>
                  <blockquote className="mt-4 text-sm leading-7 text-muted-foreground">
                    {t.content}
                  </blockquote>
                </div>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-border/60 pt-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full gradient-gold text-primary-foreground shadow-soft">
                    <UserRound className="h-5 w-5 fill-current" />
                  </span>
                  <div>
                    <span className="block text-sm font-extrabold text-foreground">
                      {t.customer_name}
                    </span>
                    <span className="block text-[11px] font-bold text-primary">عميل موثوق ✓</span>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <StoreRating />
      </section>

      {/* About */}
      <section className="mx-auto max-w-4xl px-4 py-12 text-center">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
          <h2 className="font-display text-2xl font-extrabold text-foreground md:text-3xl">
            عن إيهاب ستور
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-muted-foreground md:text-base">
            {settings?.about ??
              "متجر متخصص في أرقى منتجات العناية بالبشرة والشعر والمكياج والعطور، نختار لك الأفضل عالمياً بجودة أصلية مضمونة وخدمة متميزة."}
          </p>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title: t, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-xl font-extrabold text-foreground md:text-3xl">{t}</h2>
      <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
      <span className="mx-auto mt-3 block h-1 w-12 rounded-full gradient-gold" />
    </div>
  );
}

function SectionRow({
  title: t,
  subtitle,
  category = "",
  sort = "newest",
}: {
  title: string;
  subtitle: string;
  category?: string;
  sort?: "newest" | "bestseller";
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-extrabold text-foreground md:text-2xl">{t}</h2>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
      </div>
      <Link
        to="/products"
        search={{ category, q: "", sort }}
        className="shrink-0 rounded-xl border border-primary/40 bg-card px-4 py-2 text-xs font-bold text-primary shadow-soft transition-all duration-200 hover:bg-secondary hover:shadow-lift active:scale-95 sm:text-sm"
      >
        عرض الكل
      </Link>
    </div>
  );
}
