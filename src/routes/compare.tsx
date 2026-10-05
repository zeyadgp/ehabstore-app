import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2, X, ShoppingBag, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { Stars } from "@/components/Stars";
import { clearCompare, toggleCompare, useCompare, COMPARE_MAX } from "@/lib/compare";
import { useCategories, useProducts, priceOf } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useReviewStats } from "@/lib/reviews";
import { fallbackFor } from "@/lib/images";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/compare")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "مقارنة المنتجات | إيهاب ستور" },
      {
        name: "description",
        content: "قارن بين المنتجات في السعر والخصم والتوفر والتقييم لاختيار الأنسب لك بسهولة.",
      },
      { property: "og:title", content: "مقارنة المنتجات | إيهاب ستور" },
      { property: "og:description", content: "قارن بين المنتجات في السعر والتقييم والتوفر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const ids = useCompare();
  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: stats } = useReviewStats();
  const { format, formatUnit } = useCurrency();
  const cart = useCart();

  const items = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-secondary/80 text-muted-foreground shadow-2xs">
          <ShoppingBag className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          قائمة المقارنة فارغة
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          لم تقم بإضافة أي منتج للمقارنة بعد. يمكنك إضافة حتى {COMPARE_MAX} منتجات للمقارنة بين
          الأسعار والمواصفات بسهولة.
        </p>
        <Link
          to="/products"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl gradient-gold px-6 py-3 text-xs font-extrabold text-primary-foreground shadow-soft transition hover:opacity-95 active:scale-95"
        >
          <span>تصفّح كافة المنتجات</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const handleAddToCart = (p: (typeof items)[number]) => {
    if (!p) return;
    cart.add({
      id: p.id,
      name: p.name,
      slug: p.slug || p.id,
      price: priceOf(p),
      image: p.images?.[0] ?? null,
      sku: p.sku ?? null,
    });
    toast.success(`تمت إضافة «${p.name}» إلى السلة`);
  };

  const rows: { label: string; render: (p: (typeof items)[number]) => React.ReactNode }[] = [
    {
      label: "السعر الحالي",
      render: (p) => (
        <span className="text-sm font-extrabold text-primary">
          {formatUnit(p!.id, priceOf(p!))}
        </span>
      ),
    },
    {
      label: "السعر الأصلي",
      render: (p) =>
        p!.discount_price ? (
          <span className="text-xs text-muted-foreground line-through">
            {format(Number(p!.price))}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      label: "نسبة التوفير",
      render: (p) =>
        p!.discount_price ? (
          <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
            خصم {Math.round((1 - Number(p!.discount_price) / Number(p!.price)) * 100)}%
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      label: "القسم والتصنيف",
      render: (p) => {
        const cat = categories.find((c) => c.id === p!.category_id);
        return <span className="text-xs font-bold text-foreground">{cat?.name ?? "—"}</span>;
      },
    },
    {
      label: "حالة التوفر",
      render: (p) =>
        p!.stock > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>متوفر بالمخزون</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>نفدت الكمية</span>
          </span>
        ),
    },
    {
      label: "تقييم العملاء",
      render: (p) => {
        const s = stats?.[p!.id];
        return s && s.count > 0 ? (
          <div className="flex flex-col items-center justify-center gap-0.5">
            <Stars value={s.avg} />
            <span className="text-[10px] font-bold text-muted-foreground">({s.count} تقييم)</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">لا يوجد تقييم</span>
        );
      },
    },
    {
      label: "رمز المنتج (SKU)",
      render: (p) => (
        <span className="font-mono text-[11px] text-muted-foreground">{p!.sku ?? "—"}</span>
      ),
    },
    {
      label: "شراء سريع",
      render: (p) => (
        <div className="space-y-1.5 px-1">
          <button
            type="button"
            onClick={() => handleAddToCart(p)}
            disabled={p!.stock <= 0}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl gradient-gold py-2 text-[11px] font-extrabold text-primary-foreground shadow-2xs transition hover:opacity-95 active:scale-95 disabled:opacity-50"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>إضافة للسلة</span>
          </button>
          <Link
            to="/product/$slug"
            params={{ slug: p!.slug || p!.id }}
            className="block text-center text-[10px] font-bold text-muted-foreground hover:text-primary transition"
          >
            عرض التفاصيل الكاملة
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <h1 className="font-display text-xl font-extrabold text-foreground sm:text-2xl">
            مقارنة المنتجات
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            مقارنة دقيقة ومباشرة بين {items.length} منتجات لمساعدتك في اتخاذ قرار الشراء الأفضل.
          </p>
        </div>
        <button
          type="button"
          onClick={clearCompare}
          className="flex items-center gap-1.5 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-xs font-bold text-destructive transition hover:bg-destructive/15 active:scale-95"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>مسح كل المقارنات</span>
        </button>
      </div>

      {/* Comparison Grid Container */}
      <div className="mt-6 overflow-x-auto rounded-3xl border border-border bg-card shadow-soft">
        <table className="w-full text-center text-xs">
          <thead>
            <tr className="border-b border-border/70 bg-secondary/30">
              <th className="w-28 sm:w-40 p-4 text-start font-extrabold text-muted-foreground">
                المنتجات المقارنة
              </th>
              {items.map((p) => (
                <th key={p!.id} className="w-52 sm:w-60 min-w-[200px] max-w-[260px] p-4 align-top">
                  <div className="relative mx-auto flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => toggleCompare(p!.id)}
                      aria-label="إزالة من المقارنة"
                      title="إزالة من المقارنة"
                      className="absolute -top-1.5 -end-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-2xs transition hover:border-destructive hover:bg-destructive hover:text-destructive-foreground active:scale-90"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>

                    <Link
                      to="/product/$slug"
                      params={{ slug: p!.slug || p!.id }}
                      className="group flex flex-col items-center"
                    >
                      <div className="relative h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-2xl border border-border bg-secondary/30 p-2 shadow-2xs transition group-hover:border-primary">
                        <SmartImage
                          paths={p!.images}
                          fallback={fallbackFor(
                            categories.find((c) => c.id === p!.category_id)?.slug,
                          )}
                          alt={p!.name}
                          className="h-full w-full rounded-xl object-contain transition-transform group-hover:scale-105"
                        />
                      </div>
                      <span className="mt-2.5 line-clamp-2 max-w-[200px] text-xs font-extrabold text-foreground transition group-hover:text-primary">
                        {p!.name}
                      </span>
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.label} className="transition-colors hover:bg-secondary/20">
                <th className="bg-secondary/40 p-3.5 text-start text-[11px] font-extrabold text-muted-foreground sm:text-xs">
                  {row.label}
                </th>
                {items.map((p) => (
                  <td key={p!.id} className="p-3.5 align-middle">
                    {row.render(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
