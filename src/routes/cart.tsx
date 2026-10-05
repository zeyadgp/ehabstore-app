import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { FreeShippingBar } from "@/components/FreeShippingBar";
import { useCart } from "@/lib/cart";
import { fallbackFor } from "@/lib/images";
import { useCurrency } from "@/lib/currency";

const title = "سلة المشتريات | إيهاب ستور للعناية والتجميل";
const description = "راجع منتجاتك قبل إتمام الطلب عبر واتساب من إيهاب ستور للعناية والتجميل.";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://ehabstore.app/cart" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app/cart" }],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, remove, setQuantity } = useCart();
  const { unitFor, format, symbol } = useCurrency();
  const total = items.reduce((s, i) => s + unitFor(i.id, i.price) * i.quantity, 0);
  const fmt = (n: number) =>
    `${Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${symbol}`;
  void format;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary text-primary shadow-soft">
          <ShoppingBag className="h-10 w-10" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-extrabold text-foreground md:text-3xl">
          سلتك فارغة حالياً
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          لم تقم بإضافة أي منتج بعد. ابدأ التسوق واختر أفضل منتجات العناية والجمال الأصلية.
        </p>
        <Link
          to="/products"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl gradient-gold px-8 py-3.5 text-sm font-extrabold text-primary-foreground shadow-soft transition-all duration-200 hover:opacity-95 active:scale-95"
        >
          <span>تصفح المنتجات الآن</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="border-b border-border/60 pb-4">
        <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl">
          سلة المشتريات
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          لديكِ {items.reduce((s, i) => s + i.quantity, 0)} منتجات في السلة
        </p>
      </div>

      <div className="mt-6">
        <FreeShippingBar currentAmount={total} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex gap-4 rounded-3xl border border-border bg-card p-4 shadow-soft transition-all duration-200 hover:border-primary/40"
            >
              <Link
                to="/product/$slug"
                params={{ slug: item.slug }}
                className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted shadow-soft sm:h-28 sm:w-28"
              >
                <SmartImage
                  paths={item.image ? [item.image] : []}
                  fallback={fallbackFor()}
                  alt={item.name}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </Link>
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <Link
                    to="/product/$slug"
                    params={{ slug: item.slug }}
                    className="line-clamp-2 font-display text-sm font-bold text-foreground transition-colors hover:text-primary sm:text-base"
                  >
                    {item.name}
                  </Link>
                  {(item.color || item.size) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {item.color && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/80 px-2.5 py-1 text-xs font-bold text-foreground shadow-2xs">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border border-border shadow-xs"
                            style={{ background: item.colorSwatch ?? "hsl(var(--muted))" }}
                            title={`اللون: ${item.color}`}
                          />
                          <span>
                            اللون:{" "}
                            <strong className="font-extrabold text-foreground">{item.color}</strong>
                          </span>
                        </span>
                      )}
                      {item.size && (
                        <span className="rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 font-bold text-foreground">
                          المقاس: {item.size}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="font-display text-base font-extrabold tabular-nums text-primary">
                    {fmt(unitFor(item.id, item.price) * item.quantity)}
                  </span>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-0.5 shadow-soft">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.key, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary active:scale-95"
                        aria-label="إنقاص الكمية"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-extrabold tabular-nums text-foreground">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.key, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary active:scale-95"
                        aria-label="زيادة الكمية"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(item.key)}
                      aria-label="حذف المنتج من السلة"
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="sticky top-20 h-fit rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-base font-extrabold text-foreground">ملخص الطلب</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>عدد المنتجات الإجمالي</span>
              <span className="font-bold tabular-nums text-foreground">
                {items.reduce((s, i) => s + i.quantity, 0)} قطعة
              </span>
            </div>
            <div className="flex justify-between border-t border-border/80 pt-3 text-base font-extrabold">
              <span className="text-foreground">المجموع الكلي</span>
              <span className="font-display tabular-nums text-primary">{fmt(total)}</span>
            </div>
          </div>

          <Link
            to="/checkout"
            className="mt-6 block w-full rounded-2xl gradient-gold py-3.5 text-center text-sm font-extrabold text-primary-foreground shadow-soft transition-all duration-200 hover:opacity-95 active:scale-[0.98]"
          >
            متابعة إتمام الطلب
          </Link>
          <Link
            to="/products"
            className="mt-2.5 block w-full rounded-2xl border border-border bg-background py-3 text-center text-xs font-bold text-foreground transition-all duration-200 hover:border-primary/60 hover:text-primary active:scale-[0.98]"
          >
            متابعة التسوق وإضافة منتجات أخرى
          </Link>
        </aside>
      </div>
    </div>
  );
}
