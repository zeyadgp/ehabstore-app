import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { trackMetaViewContent } from "@/lib/meta/pixel";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  Share2,
  Truck,
  X,
  MessageCircle,
  Scale,
  Zap,
  Bell,
  FileText,
  FlaskConical,
  ListChecks,
} from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductReviews } from "@/components/ProductReviews";
import { BackInStockModal } from "@/components/BackInStockModal";
import { ProductBundleSection } from "@/components/ProductBundleSection";
import { useCart } from "@/lib/cart";
import { fallbackFor, defaultProductImage } from "@/lib/images";
import { shareProduct, shortRef } from "@/lib/share";
import {
  categoriesQuery,
  fetchProductByRef,
  priceOf,
  productsQuery,
  useCategories,
  useProducts,
  useSettings,
} from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { colorsOf, sizesOf, useProductOptions } from "@/lib/options";
import { swatchClasses } from "@/lib/colors";
import { buildProductMessage, whatsappLink } from "@/lib/whatsapp";
import { useProductBrand } from "@/lib/brands";
import { toggleCompare, useCompare, COMPARE_MAX } from "@/lib/compare";

const productQuery = (slug: string) => {
  let cleanSlug = slug;
  try {
    cleanSlug = decodeURIComponent(slug);
  } catch {
    /* ignore */
  }
  return {
    queryKey: ["product", cleanSlug],
    queryFn: () => fetchProductByRef(cleanSlug),
    staleTime: 60_000,
  };
};

const EMPTY_IMAGES: string[] = [];

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ context, params }) => {
    try {
      const [product] = await Promise.all([
        context.queryClient.ensureQueryData(productQuery(params.slug)),
        context.queryClient.ensureQueryData(categoriesQuery),
        context.queryClient.ensureQueryData(productsQuery),
      ]);
      return product;
    } catch {
      return null;
    }
  },
  head: ({ params, loaderData }) => {
    const p = loaderData ?? null;
    const name = p?.name ?? "تفاصيل المنتج";
    const title = `${name} | إيهاب ستور للعناية والتجميل`;
    const description = (
      p?.description ?? `اطلب ${name} الأصلي من إيهاب ستور مع توصيل سريع لكل محافظات اليمن.`
    )
      .replace(/\s+/g, " ")
      .slice(0, 155);
    const url = `https://ehabstore.app/product/${params.slug}`;
    const image = p?.images?.find((i) => i?.startsWith("http")) ?? null;

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
    ];
    if (image) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
    }

    const scripts = p
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: p.name,
              description,
              ...(image ? { image: [image] } : {}),
              offers: {
                "@type": "Offer",
                url,
                priceCurrency: "YER",
                price: String(priceOf(p)),
                availability:
                  p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              },
            }),
          },
        ]
      : [];

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const loaderProduct = Route.useLoaderData();
  const [qty, setQty] = useState(1);
  const cart = useCart();
  const { data: settings } = useSettings();
  const { formatUnit, format, unitFor, symbol } = useCurrency();
  const { data: categories = [] } = useCategories();
  const { data: all = [] } = useProducts();
  const { data: product = loaderProduct, isLoading } = useQuery({
    ...productQuery(slug),
    initialData: loaderProduct ?? undefined,
  });
  const { data: options = [] } = useProductOptions(product?.id);
  const [colorId, setColorId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [isBackInStockOpen, setIsBackInStockOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [detailsTab, setDetailsTab] = useState<"description" | "ingredients" | "usage">(
    "description",
  );

  const currency = symbol;
  const category = product ? categories.find((c) => c.id === product.category_id) : undefined;
  const brand = useProductBrand(product, category);
  const compareIds = useCompare();
  const inCompare = Boolean(product && compareIds.includes(product.id));

  const colors = colorsOf(options);
  const sizes = sizesOf(options);
  const selColor = colors.find((v) => v.id === colorId) ?? null;
  const selSize = sizes.find((v) => v.id === sizeId) ?? null;
  const availableStock = selSize
    ? selSize.stock
    : selColor && selColor.stock != null
      ? selColor.stock
      : (product?.stock ?? 0);
  const maxQty = Math.max(1, Math.min(99, availableStock));
  const currentQty = Math.max(1, Math.min(maxQty, qty));

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (product?.id) {
      try {
        void trackMetaViewContent({
          id: product.id,
          name: product.name,
          price: priceOf(product),
          currency: symbol || "SAR",
          category: category?.name,
          sku: product.sku,
        });
      } catch {
        /* ignore tracking errors */
      }
    }
  }, [product, category?.name, symbol]);

  if (isLoading && !product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  if (!product || !product.status) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-extrabold">المنتج غير متوفر</h1>
        <p className="mt-3 text-sm text-muted-foreground">ربما تم حذفه أو تغيير رابطه.</p>
        <Link
          to="/products"
          className="mt-6 inline-block rounded-xl gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground"
        >
          تصفح المنتجات
        </Link>
      </div>
    );
  }

  const finalPrice =
    selSize && selSize.price != null && Number(selSize.price) > 0
      ? Number(selSize.price)
      : selColor && selColor.price != null && Number(selColor.price) > 0
        ? Number(selColor.price)
        : priceOf(product);
  const activeImages = (
    selColor && selColor.images?.length ? selColor.images : product.images
  ).slice(0, 5);
  const selectionReady = (colors.length === 0 || !!selColor) && (sizes.length === 0 || !!selSize);
  const swatchCls = swatchClasses({
    enabled: settings?.swatch_enabled !== false,
    shape: (settings?.swatch_shape as "circle" | "square") ?? "circle",
    size: (settings?.swatch_size as "sm" | "md" | "lg") ?? "md",
  });

  const hasDiscount = !selSize && product.discount_price != null && product.discount_price > 0;

  const related = all
    .filter((p) => p.category_id === product.category_id && p.id !== product.id)
    .slice(0, 4);

  const productUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://ehabstore.app/product/${product.slug}`;

  const expressWaLink = whatsappLink(
    settings?.whatsapp_number ?? "+967780187409",
    buildProductMessage({
      storeName: settings?.store_name ?? "إيهاب ستور للعناية والتجميل",
      productName: product.name,
      quantity: currentQty,
      unitPrice: selSize ? Number(finalPrice) : unitFor(product.id, finalPrice),
      currencyLabel: currency,
      color: selColor?.name ?? null,
      size: selSize?.name ?? null,
      sku: selSize?.sku ?? product.sku ?? null,
      productUrl,
    }),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <nav
        aria-label="مسار التنقل"
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        <Link to="/" className="transition-colors hover:text-primary">
          الرئيسية
        </Link>
        <span>/</span>
        <Link to="/products" className="transition-colors hover:text-primary">
          المنتجات
        </Link>
        {category && (
          <>
            <span>/</span>
            <Link
              to="/products"
              search={{ category: category.slug, q: "", sort: "newest" }}
              className="transition-colors hover:text-primary"
            >
              {category.name}
            </Link>
          </>
        )}
        {brand && (
          <>
            <span>/</span>
            <Link
              to="/products"
              search={{ category: brand.slug, q: "", sort: "newest" }}
              className="font-bold text-foreground transition-colors hover:text-primary"
            >
              {brand.name}
            </Link>
          </>
        )}
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery
          images={activeImages ?? EMPTY_IMAGES}
          fallback={fallbackFor(category?.slug)}
          alt={product.name}
        />

        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            {category && (
              <Link
                to="/products"
                search={{ category: category.slug, q: "", sort: "newest" }}
                className="inline-block rounded-full border border-primary/40 bg-secondary px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-secondary/80"
              >
                {category.name}
              </Link>
            )}

            {/* شارة العلامة التجارية في رأس التفاصيل مع الصورة */}
            {brand && (
              <Link
                to="/products"
                search={{ category: brand.slug, q: "", sort: "newest" }}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-bold text-foreground shadow-2xs transition-all hover:border-primary/50 hover:bg-secondary/40"
                title={`عرض منتجات ماركة ${brand.name}`}
              >
                {brand.image ? (
                  <span className="relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-white">
                    <SmartImage
                      paths={[brand.image]}
                      fallback={defaultProductImage}
                      alt={brand.name}
                      className="h-full w-full object-contain"
                    />
                  </span>
                ) : (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-black text-primary">
                    {brand.name.slice(0, 1)}
                  </span>
                )}
                <span className="text-[10px] font-medium text-muted-foreground">ماركة:</span>
                <span className="font-extrabold text-foreground transition-colors group-hover:text-primary">
                  {brand.name}
                </span>
              </Link>
            )}
          </div>

          <div className="mt-3 flex items-start justify-between gap-4">
            <h1 className="font-display text-2xl font-extrabold leading-tight text-foreground md:text-3xl">
              {product.name}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const res = toggleCompare(product.id);
                  if (res.full) {
                    toast.error(`الحد الأقصى للمقارنة ${COMPARE_MAX} منتجات`);
                  } else if (res.added) {
                    toast.success("أُضيف إلى قائمة المقارنة");
                  } else {
                    toast.success("أُزيل من المقارنة");
                  }
                }}
                aria-label="مقارنة المنتج"
                title={inCompare ? "إزالة من المقارنة" : "إضافة إلى قائمة المقارنة"}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold shadow-soft transition-all duration-200 active:scale-95 ${
                  inCompare
                    ? "border-primary bg-primary text-primary-foreground shadow-lift ring-2 ring-primary/20"
                    : "border-border bg-card text-foreground hover:border-primary/60 hover:text-primary hover:shadow-lift"
                }`}
              >
                <Scale className="h-4 w-4" />
                <span>{inCompare ? "في المقارنة" : "مقارنة"}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const res = await shareProduct(product.name, shortRef(product));
                  if (res === "copied") toast.success("تم نسخ رابط المنتج");
                  if (res === "failed") toast.error("تعذرت المشاركة");
                }}
                aria-label="مشاركة المنتج"
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground shadow-soft transition-all duration-200 hover:border-primary/60 hover:text-primary hover:shadow-lift active:scale-95"
              >
                <Share2 className="h-4 w-4" />
                <span>مشاركة</span>
              </button>
            </div>
          </div>

          {/* ألوان ودرجات المنتج (تظهر قبل الماركة) */}
          {colors.length > 0 && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground">
                  اختر الدرجة / اللون{selColor ? `: ` : ""}
                  {selColor && (
                    <span className="font-extrabold text-foreground">{selColor.name}</span>
                  )}
                </p>
                {selColor && (
                  <button
                    type="button"
                    onClick={() => setColorId(null)}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    عرض كل الصور
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {colors.map((v) => {
                  const active = v.id === colorId;
                  const out = v.stock <= 0;
                  const hasColorImage = Boolean(v.images && v.images.length > 0);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={out}
                      onClick={() => setColorId(active ? null : v.id)}
                      aria-pressed={active}
                      aria-label={v.name}
                      title={v.name}
                      className="group flex w-16 flex-col items-center gap-1.5 transition-transform active:scale-95 disabled:opacity-40"
                    >
                      <span
                        className={`relative flex items-center justify-center overflow-hidden border-2 shadow-soft transition-all duration-200 ${swatchCls} ${
                          active
                            ? "border-primary ring-2 ring-primary/40 scale-105 shadow-lift"
                            : "border-border hover:border-primary/60 group-hover:scale-102"
                        }`}
                        style={{ background: v.swatch ?? v.code ?? "hsl(var(--muted))" }}
                      >
                        {hasColorImage ? (
                          <img
                            src={v.images![0]}
                            alt={v.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              // إذا فشلت صورة التدرج نعود لخلفية اللون
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : null}
                        {active && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
                            <Check className="h-4 w-4 text-white drop-shadow-md" strokeWidth={3} />
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-1 text-center text-[10px] font-bold text-foreground">
                        {v.name}
                        {out && <span className="text-muted-foreground"> (نفد)</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* مقاسات وسعات المنتج إن وجدت */}
          {sizes.length > 0 && (
            <div className="mt-3.5">
              <p className="text-xs font-bold text-muted-foreground">
                المقاس / السعة{selSize ? `: ${selSize.name}` : ""}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {sizes.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={v.stock <= 0}
                    onClick={() => setSizeId(v.id === sizeId ? null : v.id)}
                    className={`rounded-xl border px-4 py-2 text-xs font-bold transition-all duration-150 active:scale-95 disabled:opacity-40 ${
                      v.id === sizeId
                        ? "border-primary bg-secondary text-primary shadow-soft ring-1 ring-primary"
                        : "border-border bg-card text-foreground hover:border-primary/60"
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* صورة واسم الماركة التجارية المرتبطة ورابط منتجاتها */}
          {brand && (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-border/80 bg-card p-3 shadow-soft">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  to="/products"
                  search={{ category: brand.slug, q: "", sort: "newest" }}
                  className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white shadow-2xs transition-transform hover:scale-105"
                  title={`تصفح منتجات ${brand.name}`}
                >
                  {brand.image ? (
                    <SmartImage
                      paths={[brand.image]}
                      fallback={defaultProductImage}
                      alt={brand.name}
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-xs font-bold text-primary">{brand.name.slice(0, 2)}</span>
                  )}
                </Link>
                <div className="min-w-0">
                  <span className="block text-[11px] font-medium text-muted-foreground">
                    العلامة التجارية
                  </span>
                  <Link
                    to="/products"
                    search={{ category: brand.slug, q: "", sort: "newest" }}
                    className="block truncate text-sm font-extrabold text-foreground transition-colors hover:text-primary"
                  >
                    {brand.name}
                  </Link>
                </div>
              </div>
              <Link
                to="/products"
                search={{ category: brand.slug, q: "", sort: "newest" }}
                className="shrink-0 text-xs font-bold text-primary hover:underline"
              >
                جميع منتجات الماركة ←
              </Link>
            </div>
          )}

          {/* السعر — يظهر بعد اختيار اللون والمواصفات والماركة */}
          <div className="mt-4 flex flex-wrap items-baseline gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <span className="text-xs font-bold text-muted-foreground">السعر:</span>
            <span className="font-display text-2xl font-extrabold tabular-nums text-primary md:text-3xl">
              {selSize ? format(finalPrice) : formatUnit(product.id, finalPrice)}
            </span>
            {hasDiscount && (
              <span className="text-base font-medium tabular-nums text-muted-foreground line-through">
                {format(Number(product.price))}
              </span>
            )}
            {hasDiscount && (
              <span className="rounded-full bg-rose/10 px-2.5 py-0.5 text-xs font-extrabold text-rose">
                وفر {format(Number(product.price) - finalPrice)}
              </span>
            )}
          </div>


          <div className="mt-5 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${
                availableStock > 0
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${availableStock > 0 ? "bg-emerald-500" : "bg-destructive"}`}
              />
              {availableStock > 0 ? "متوفر بالمخزون" : "نفدت الكمية"}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1 shadow-soft">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, Math.min(maxQty, q) - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-secondary active:scale-95"
                aria-label="إنقاص الكمية"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-sm font-extrabold tabular-nums text-foreground">
                {currentQty}
              </span>
              <button
                type="button"
                disabled={currentQty >= maxQty}
                onClick={() => setQty((q) => Math.min(maxQty, Math.max(1, q) + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-secondary active:scale-95 disabled:opacity-30"
                aria-label="زيادة الكمية"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-primary/30 bg-secondary/60 px-5 py-2.5 shadow-soft">
              <span className="text-xs font-medium text-muted-foreground">الإجمالي: </span>
              <span className="font-display text-base font-extrabold tabular-nums text-primary">
                {selSize
                  ? format(finalPrice * currentQty)
                  : formatUnit(product.id, finalPrice * currentQty)}
              </span>
            </div>
          </div>

          {currentQty >= maxQty && availableStock > 0 && (
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              تم الوصول إلى الحد الأقصى المتاح للطلب
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {availableStock <= 0 ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setIsBackInStockOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-amber-500/30 bg-amber-500/10 py-3.5 text-sm font-extrabold text-amber-700 dark:text-amber-300 shadow-soft transition-all duration-200 hover:bg-amber-500/20 active:scale-[0.98]"
                >
                  <Bell className="h-4.5 w-4.5 animate-bounce" />
                  <span>المنتج غير متوفر حالياً — أبلغني عند توفره</span>
                </button>
                <p className="text-center text-[11px] text-muted-foreground">
                  سنقوم بإرسال إشعار فوري لكِ عبر واتساب بمجرد وصول كمية جديدة.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    disabled={!selectionReady}
                    onClick={() => {
                      cart.add(
                        {
                          id: product.id,
                          name: product.name,
                          slug: product.slug,
                          price: finalPrice,
                          image: activeImages?.[0] ?? null,
                          color: selColor?.name ?? null,
                          colorSwatch: selColor?.swatch ?? selColor?.code ?? null,
                          colorValueId: selColor?.id ?? null,

                          size: selSize?.name ?? null,
                          sizeValueId: selSize?.id ?? null,
                          sku: selSize?.sku ?? product.sku ?? null,
                        },
                        currentQty,
                      );
                      toast.success("تمت إضافة المنتج إلى السلة");
                    }}
                    className="flex-1 rounded-2xl gradient-gold px-6 py-3.5 text-sm font-extrabold text-primary-foreground shadow-soft transition-all duration-200 hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                  >
                    {selectionReady ? "أضف إلى السلة" : "اختر الخيارات أولاً"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectionReady) {
                        toast.error("يرجى اختيار اللون أو المقاس المطلوب أولاً");
                        return;
                      }
                      window.open(expressWaLink, "_blank", "noopener");
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-center text-sm font-extrabold text-white shadow-soft transition-all duration-200 hover:bg-emerald-700 hover:shadow-lift active:scale-[0.98]"
                  >
                    <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />
                    <MessageCircle className="h-4 w-4" />
                    <span>طلب سريع عبر واتساب</span>
                  </button>
                </div>
                <p className="text-center text-[11px] font-medium text-muted-foreground">
                  ⚡ الشراء السريع ينقلك مباشرة إلى محادثة واتساب مع تجهيز كامل تفاصيل طلبك وسعره.
                </p>
              </>
            )}
          </div>
          {/* تفاصيل المنتج في أزرار واضحة مثل تطبيقات التسوق الحديثة. */}
          <div className="mt-6 border-y border-border py-4">
            <div
              className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/60 p-1"
              role="tablist"
              aria-label="معلومات المنتج"
            >
              {(
                [
                  ["description", "الوصف", FileText],
                  ["ingredients", "المكوّنات", FlaskConical],
                  ["usage", "طريقة الاستخدام", ListChecks],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={detailsTab === key}
                  onClick={() => setDetailsTab(key)}
                  className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] font-extrabold transition-all sm:text-xs ${
                    detailsTab === key
                      ? "bg-card text-primary shadow-soft ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              className="min-h-24 px-1 pb-1 pt-4 text-sm leading-7 text-muted-foreground"
            >
              <p className="whitespace-pre-line">
                {detailsTab === "description" &&
                  (product.description ??
                    "منتج أصلي مضمون ومختار بعناية من إيهاب ستور لتعزيز روتين العناية اليومي.")}
                {detailsTab === "ingredients" &&
                  (product.ingredients?.trim() || "لم تُضف مكوّنات هذا المنتج بعد.")}
                {detailsTab === "usage" &&
                  (product.usage_instructions?.trim() || "لم تُضف طريقة استخدام هذا المنتج بعد.")}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold text-foreground">منتج أصلي 100%</p>
                <p className="text-[11px] text-muted-foreground">ضمان الجودة والمصدر المعتمد</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Truck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold text-foreground">توصيل سريع وآمن</p>
                <p className="text-[11px] text-muted-foreground">تغليف محكم وعناية بمنتجك</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* حزمة اشتري معاً / الروتين المتكامل */}
      {hydrated && <ProductBundleSection currentProduct={product} candidateProducts={all} />}

      <ProductReviews productId={product.id} productName={product.name} images={product.images} />

      {hydrated && related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-extrabold">منتجات مشابهة</h2>
          <ProductGrid products={related} categories={categories} className="mt-5" />
        </section>
      )}

      {/* نافذة التنبيه عند التوفر */}
      <BackInStockModal
        isOpen={isBackInStockOpen}
        onClose={() => setIsBackInStockOpen(false)}
        product={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: selSize?.sku ?? product.sku,
        }}
        colorName={selColor?.name ?? null}
        sizeName={selSize?.name ?? null}
      />
    </div>
  );
}
/**
 * معرض صور المنتج: صورة كبيرة + صور مصغّرة أسفلها.
 * الضغط على المصغّرة يبدّل الصورة، والضغط على الكبيرة يفتحها بملء الشاشة.
 */
function ProductGallery({
  images,
  fallback,
  alt,
}: {
  images: string[];
  fallback: string;
  alt: string;
}) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const list = images.slice(0, 5);
  const idx = Math.min(i, Math.max(0, list.length - 1));

  // Switch immediately to the first image when active images array changes (e.g. user selected a color)
  const imagesKey = images.join("|");
  useEffect(() => {
    setI(0);
  }, [imagesKey]);

  const step = (d: number) => setI((v) => (v + d + list.length) % Math.max(1, list.length));

  return (
    <div>
      <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <button
          type="button"
          onClick={() => setZoom(true)}
          aria-label="تكبير الصورة"
          className="block w-full overflow-hidden"
        >
          <SmartImage
            paths={list}
            index={idx}
            fallback={fallback}
            alt={alt}
            eager
            className="aspect-[4/5] w-full object-cover sm:aspect-square"
          />
        </button>
        {list.length > 0 && (
          <span className="pointer-events-none absolute bottom-3 start-3 rounded-full border border-border/70 bg-card/90 px-3 py-1 text-[11px] font-bold text-foreground shadow-soft backdrop-blur-sm">
            {idx + 1} / {list.length}
          </span>
        )}
        {list.length > 1 && (
          <>
            <button
              type="button"
              aria-label="الصورة السابقة"
              onClick={() => step(-1)}
              className="absolute start-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-soft backdrop-blur-sm transition hover:text-primary active:scale-95"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="الصورة التالية"
              onClick={() => step(1)}
              className="absolute end-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-soft backdrop-blur-sm transition hover:text-primary active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {list.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {list.map((img, n) => (
            <button
              key={img + n}
              type="button"
              onClick={() => setI(n)}
              aria-label={`صورة ${n + 1}`}
              className={`aspect-square min-w-0 flex-1 overflow-hidden rounded-xl border-2 transition ${
                n === idx ? "border-primary" : "border-border opacity-70 hover:opacity-100"
              }`}
            >
              <SmartImage
                paths={list}
                index={n}
                fallback={fallback}
                alt={alt}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-fade-in"
          onClick={() => setZoom(false)}
        >
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setZoom(false)}
            className="absolute top-4 end-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <SmartImage
            paths={list}
            index={idx}
            fallback={fallback}
            alt={alt}
            className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain"
          />
          {list.length > 1 && (
            <>
              <button
                type="button"
                aria-label="السابق"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className="absolute top-1/2 start-3 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="التالي"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className="absolute top-1/2 end-3 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5">
                {list.map((img, n) => (
                  <span
                    key={img + n}
                    className={`h-1.5 rounded-full ${n === idx ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
