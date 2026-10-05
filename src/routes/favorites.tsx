import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag, Trash2, Heart } from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import { toast } from "sonner";
import { ProductGrid } from "@/components/ProductGrid";
import { SmartImage } from "@/components/SmartImage";
import { AdStrip } from "@/components/AdBanner";
import { useFavorites } from "@/lib/favorites";
import { useCategories, useProducts } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useCart } from "@/lib/cart";
import { fallbackFor } from "@/lib/images";

const title = "قائمة الأمنيات | إيهاب ستور للعناية والتجميل";
const description =
  "قائمة أمنياتك في إيهاب ستور: تابع التخفيضات واحفظ منتجاتك المفضلة وأضفها للسلة بضغطة.";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:image", content: "https://www.ehabstore.app/icon-512.png" },
      { name: "twitter:image", content: "https://www.ehabstore.app/icon-512.png" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app/favorites" }],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { ids, toggle } = useFavorites();
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const { format, formatUnit } = useCurrency();
  const { add } = useCart();
  const [filter, setFilter] = useState<string>("all");

  const list = useMemo(() => products.filter((p) => ids.includes(p.id)), [products, ids]);
  const suggestions = products.filter((p) => !ids.includes(p.id)).slice(0, 8);

  const priceOf = (p: (typeof list)[number]) =>
    p.discount_price != null && Number(p.discount_price) > 0
      ? Number(p.discount_price)
      : Number(p.price);
  const isDeal = (p: (typeof list)[number]) =>
    p.discount_price != null &&
    Number(p.discount_price) > 0 &&
    Number(p.discount_price) < Number(p.price);

  const total = list.reduce((s, p) => s + priceOf(p), 0);
  const savings = list.reduce(
    (s, p) => s + (isDeal(p) ? Number(p.price) - Number(p.discount_price) : 0),
    0,
  );
  const deals = list.filter(isDeal);

  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    list.forEach((p) => {
      if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    });
    return categories
      .filter((c) => counts.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 }));
  }, [list, categories]);

  const shown = useMemo(() => {
    if (filter === "all") return list;
    if (filter === "deals") return deals;
    return list.filter((p) => p.category_id === filter);
  }, [filter, list, deals]);

  const addMany = (items: typeof list) => {
    items.forEach((p) =>
      add({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: priceOf(p),
        image: p.images?.[0] ?? null,
        sku: p.sku ?? null,
      }),
    );
    toast.success(`تمت إضافة ${items.length} منتج إلى السلة`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-8">
      <header className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gradient-gold text-primary-foreground">
          <StoreLogo className="h-6 w-6 text-primary-foreground" />
        </span>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            قائمة الأمنيات
            {list.length > 0 && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-rose">
                {list.length}
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            نظّم روتينك، تابع التخفيضات واحفظ منتجاتك.
          </p>
        </div>
      </header>

      {list.length > 0 && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">
              إجمالي قائمة أمنياتك: <span className="text-primary">{format(total)}</span>
            </p>
            {savings > 0 && (
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                توفير {format(savings)}
              </span>
            )}
          </div>
          {deals.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {deals.length} من منتجاتك عليها تخفيض الآن 🎉
            </p>
          )}
        </div>
      )}

      {list.length > 0 && (
        <div className="mt-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[
            { id: "all", name: "الكل", count: list.length },
            ...(deals.length ? [{ id: "deals", name: "🔥 تخفيضات", count: deals.length }] : []),
            ...chips,
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
                filter === c.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card"
              }`}
            >
              {c.name} ({c.count})
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : list.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {shown.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex gap-3">
                <Link to="/product/$slug" params={{ slug: p.slug }} className="relative shrink-0">
                  <SmartImage
                    paths={p.images}
                    fallback={fallbackFor(p.name)}
                    alt={p.name}
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                  {isDeal(p) && (
                    <span className="absolute -top-1 -right-1 rounded-full bg-rose px-2 py-0.5 text-[10px] font-bold text-white">
                      خصم
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/product/$slug"
                    params={{ slug: p.slug }}
                    className="line-clamp-2 text-sm font-bold hover:text-primary"
                  >
                    {p.name}
                  </Link>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm font-extrabold text-primary">
                      {formatUnit(p.id, priceOf(p))}
                    </span>
                    {isDeal(p) && (
                      <span className="text-xs text-muted-foreground line-through">
                        {format(Number(p.price))}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-label="حذف من قائمة الأمنيات"
                  className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-destructive"
                >
                  <Trash2 className="mx-auto h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => addMany([p])}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-2.5 text-xs font-bold text-background transition hover:opacity-90"
              >
                <ShoppingBag className="h-4 w-4" /> أضف للسلة
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 rounded-3xl border border-dashed border-primary/40 bg-secondary/30 p-10 text-center">
          <Heart className="mx-auto h-8 w-8 text-rose" />
          <p className="mt-3 text-sm font-bold">قائمة أمنياتك فارغة</p>
          <p className="mt-2 text-xs text-muted-foreground">
            اضغط على أيقونة القلب في أي منتج لإضافته هنا.
          </p>
          <Link
            to="/products"
            className="mt-5 inline-block rounded-xl gradient-gold px-7 py-3 text-sm font-bold text-primary-foreground"
          >
            تصفّحي المنتجات
          </Link>
        </div>
      )}

      <AdStrip placement="strip" />

      {suggestions.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-extrabold">قد يعجبكِ أيضاً</h2>
          <ProductGrid products={suggestions} categories={categories} className="mt-4" />
        </section>
      )}

      {shown.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-4xl px-4 md:bottom-4">
          <div className="space-y-2 rounded-2xl bg-background/80 p-2 backdrop-blur">
            <button
              type="button"
              onClick={() => addMany(shown)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-3.5 text-sm font-bold text-background shadow-lg"
            >
              <ShoppingBag className="h-4 w-4" />
              إضافة المنتجات المعروضة إلى السلة ({shown.length}) •{" "}
              {format(shown.reduce((s, p) => s + priceOf(p), 0))}
            </button>
            {deals.length > 0 && filter !== "deals" && (
              <button
                type="button"
                onClick={() => addMany(deals)}
                className="w-full rounded-2xl border border-primary/50 bg-card py-3 text-xs font-bold text-primary"
              >
                إضافة المنتجات المخفضة فقط ({deals.length})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
