import { memo, Component, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, Share2, ShoppingCart, Scale } from "lucide-react";
import { toast } from "sonner";
import { SmartImage } from "./SmartImage";
import { Stars } from "./Stars";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { shareProduct, shortRef } from "@/lib/share";
import { fallbackFor, defaultProductImage } from "@/lib/images";
import { priceOf, type Category, type Product } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useReviewStats } from "@/lib/reviews";
import { useProductsWithOptions } from "@/lib/options";
import { useProductBrand } from "@/lib/brands";
import { toggleCompare, useCompare, COMPARE_MAX } from "@/lib/compare";

export type CardStyle = "classic" | "modern";

function ProductCardBase({
  product,
  categories,
  variant = "classic",
  compact = false,
  eager = false,
}: {
  product: Product;
  categories: Category[];
  currencyLabel?: string;
  variant?: CardStyle;
  /** Very tight layout used on phones when the grid shows 3 columns. */
  compact?: boolean;
  /** Eager load high-priority images above the fold for LCP optimization */
  eager?: boolean;
}) {
  const cart = useCart();
  const { formatUnit, format } = useCurrency();
  const { isFavorite, toggle } = useFavorites();
  const { data: stats } = useReviewStats();
  const { data: withOptions } = useProductsWithOptions();
  const hasOptions = withOptions?.has(product.id) ?? false;
  const category = categories.find((c) => c.id === product.category_id);
  const brand = useProductBrand(product, category);
  const finalPrice = priceOf(product);
  const hasDiscount = product.discount_price != null && product.discount_price > 0;
  const discountPct = hasDiscount
    ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100)
    : 0;
  const fav = isFavorite(product.id);
  const compareIds = useCompare();
  const inCompare = compareIds.includes(product.id);
  const stat = stats?.[product.id];

  // Compact styles only bite on phones; from `sm:` up the card looks normal.
  const c = (tight: string, normal: string) => (compact ? tight : normal);

  const addToCart = () => {
    if (hasOptions) {
      // المنتج له ألوان/مقاسات: الاختيار يتم من صفحة المنتج.
      window.location.href = `/product/${product.slug}`;
      return;
    }
    cart.add({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: finalPrice,
      image: product.images?.[0] ?? null,
    });
    toast.success("تمت الإضافة إلى السلة");
  };

  const share = async () => {
    const res = await shareProduct(product.name, shortRef(product));
    if (res === "copied") toast.success("تم نسخ رابط المنتج");
    if (res === "failed") toast.error("تعذرت المشاركة");
  };

  const iconBtn =
    "flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card shadow-soft transition-all duration-200 hover:border-primary hover:scale-105 active:scale-90";

  /** Actions sit in the bottom-start corner: Favorite, Compare, and Share. */
  const imageActions = (
    <div className="absolute bottom-1.5 start-1.5 z-10 flex gap-1">
      <button
        type="button"
        onClick={() => {
          const now = toggle(product.id);
          toast.success(now ? "أُضيف إلى المفضلة" : "أُزيل من المفضلة");
        }}
        aria-label="المفضلة"
        className={iconBtn}
      >
        <Heart
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            fav
              ? "fill-rose text-rose scale-110"
              : "text-muted-foreground group-hover/btn:scale-110"
          }`}
        />
      </button>
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
        title={inCompare ? "إزالة من قائمة المقارنة" : "مقارنة المنتج"}
        className={iconBtn}
      >
        <Scale
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            inCompare
              ? "text-primary scale-110 font-bold"
              : "text-muted-foreground group-hover/btn:scale-110"
          }`}
        />
      </button>
      <button type="button" onClick={share} aria-label="مشاركة المنتج" className={iconBtn}>
        <Share2 className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 hover:rotate-12" />
      </button>
    </div>
  );

  // عرض التقييم فقط عند وجود تقييمات معتمدة بالفعل بدون أي زر تقييم في البطاقة
  const rating = stat?.count ? (
    <div className="flex items-center gap-1 text-start">
      <Stars value={stat.avg} size="xs" />
      <span className="text-[10px] font-bold tabular-nums text-primary">
        {stat.avg.toFixed(1)} ({stat.count})
      </span>
    </div>
  ) : null;

  if (variant === "modern") {
    return (
      <article
        className={`group relative flex flex-col overflow-hidden border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift ${c("rounded-2xl p-2 sm:rounded-3xl sm:p-3", "rounded-3xl p-3")}`}
      >
        {hasDiscount && discountPct > 0 && (
          <span
            className={`absolute top-3 end-3 z-10 rounded-full bg-rose font-extrabold tabular-nums text-white shadow-soft ${c("px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs", "px-2.5 py-1 text-xs")}`}
          >
            %{discountPct} خصم
          </span>
        )}
        <div className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
          <Link to="/product/$slug" params={{ slug: product.id }} className="block h-full w-full">
            <SmartImage
              paths={product.images}
              fallback={fallbackFor(category?.slug)}
              alt={product.name}
              eager={eager}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
            {product.stock <= 0 && (
              <span className="absolute inset-0 flex items-center justify-center bg-background/90 text-xs font-extrabold text-destructive">
                نفدت الكمية
              </span>
            )}
          </Link>
          {imageActions}
        </div>

        <div
          className={`flex flex-1 flex-col ${c("gap-1 px-1 pb-0.5 pt-2 sm:gap-1.5 sm:px-2 sm:pb-1 sm:pt-3", "gap-1.5 px-2 pb-1 pt-3")}`}
        >
          <div className="flex items-center justify-between gap-1">
            {category && (
              <span
                className={`truncate text-muted-foreground ${c("text-[10px] sm:text-xs font-medium", "text-xs font-medium")}`}
              >
                {category.name}
              </span>
            )}
            {brand && (
              <span className="inline-flex items-center gap-1 shrink-0">
                {brand.image && (
                  <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white">
                    <SmartImage
                      paths={[brand.image]}
                      fallback={defaultProductImage}
                      alt={brand.name}
                      className="h-full w-full object-contain"
                    />
                  </span>
                )}
                <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[80px]">
                  {brand.name}
                </span>
              </span>
            )}
          </div>
          <Link
            to="/product/$slug"
            params={{ slug: product.id }}
            className={`line-clamp-2 font-bold text-foreground transition-colors hover:text-primary ${c("text-xs leading-snug sm:text-sm", "text-sm")}`}
          >
            {product.name}
          </Link>
          {rating}

          {/* مؤشر توفر الألوان والخيارات يظهر قبل السعر */}
          {hasOptions && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              ألوان وخيارات متعددة
            </span>
          )}

          <div
            className={`mt-auto flex items-end justify-between gap-2 ${c("pt-1.5 sm:pt-2", "pt-2")}`}
          >
            <div className="flex min-w-0 flex-col">
              <span
                className={`truncate font-extrabold tabular-nums text-primary ${c("text-xs sm:text-base", "text-base")}`}
              >
                {formatUnit(product.id, finalPrice)}
              </span>
              {hasDiscount && (
                <span
                  className={`truncate font-medium tabular-nums text-muted-foreground line-through ${c("text-[10px] sm:text-xs", "text-xs")}`}
                >
                  {format(Number(product.price))}
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={addToCart}
              aria-label="أضف إلى السلة"
              className={`flex shrink-0 items-center justify-center gradient-gold text-primary-foreground shadow-soft transition-all duration-150 hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${c("h-8 w-8 rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl", "h-11 w-11 rounded-2xl")}`}
            >
              <ShoppingCart className={c("h-4 w-4 sm:h-5 sm:w-5", "h-5 w-5")} />
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group relative flex flex-col overflow-hidden border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift ${c("rounded-xl sm:rounded-2xl", "rounded-2xl")}`}
    >
      <div className="relative block aspect-[4/5] overflow-hidden bg-muted">
        <Link to="/product/$slug" params={{ slug: product.id }} className="block h-full w-full">
          <SmartImage
            paths={product.images}
            fallback={fallbackFor(category?.slug)}
            alt={product.name}
            eager={eager}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
          {hasDiscount && discountPct > 0 && (
            <span
              className={`absolute top-2.5 start-2.5 rounded-full bg-rose font-extrabold tabular-nums text-white shadow-soft ${c("px-2 py-0.5 text-[10px] sm:px-3 sm:py-1 sm:text-xs", "px-3 py-1 text-xs")}`}
            >
              %{discountPct} خصم
            </span>
          )}
          {product.stock <= 0 && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/90 text-xs font-extrabold text-destructive">
              نفدت الكمية
            </span>
          )}
        </Link>
        {imageActions}
      </div>

      <div className={`flex flex-1 flex-col ${c("gap-1 p-2 sm:gap-2 sm:p-4", "gap-2 p-4")}`}>
        <div className="flex items-center justify-between gap-1">
          {category && (
            <span
              className={`truncate text-muted-foreground ${c("text-[10px] sm:text-xs font-medium", "text-xs font-medium")}`}
            >
              {category.name}
            </span>
          )}
          {brand && (
            <span className="inline-flex items-center gap-1 shrink-0">
              {brand.image && (
                <span className="relative flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white">
                  <SmartImage
                    paths={[brand.image]}
                    fallback={defaultProductImage}
                    alt={brand.name}
                    className="h-full w-full object-contain"
                  />
                </span>
              )}
              <span className="text-xs font-bold text-muted-foreground truncate max-w-[100px]">
                {brand.name}
              </span>
            </span>
          )}
        </div>
        <Link
          to="/product/$slug"
          params={{ slug: product.id }}
          className={`line-clamp-2 font-bold text-foreground transition-colors hover:text-primary ${c("text-xs leading-snug sm:text-base", "text-base")}`}
        >
          {product.name}
        </Link>
        {rating}

        {/* ظهور توفر الألوان والخيارات قبل السعر */}
        {hasOptions && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
            <span className="h-2 w-2 rounded-full bg-primary" />
            متوفر بدرجات وألوان متعددة
          </span>
        )}

        <div
          className={`mt-auto flex flex-wrap items-baseline gap-x-2 ${c("pt-1.5 sm:pt-2", "pt-2")}`}
        >
          <span
            className={`font-extrabold tabular-nums text-primary ${c("text-xs sm:text-lg", "text-lg")}`}
          >
            {formatUnit(product.id, finalPrice)}
          </span>
          {hasDiscount && (
            <span
              className={`text-muted-foreground line-through tabular-nums font-medium ${c("text-[10px] sm:text-sm", "text-sm")}`}
            >
              {format(Number(product.price))}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={product.stock <= 0}
          onClick={addToCart}
          className={`mt-2 w-full gradient-gold font-bold text-primary-foreground shadow-soft transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${c("rounded-lg px-2 py-2 text-xs sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm", "rounded-xl px-4 py-2.5 text-sm")}`}
        >
          أضف إلى السلة
        </button>
      </div>
    </article>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ProductCardErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn("[ProductCard] Rendering error caught by boundary:", error);
  }

  override render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function ProductCardSafe(props: React.ComponentProps<typeof ProductCardBase>) {
  return (
    <ProductCardErrorBoundary>
      <ProductCardBase {...props} />
    </ProductCardErrorBoundary>
  );
}

/** Cards are pure w.r.t. their props — memo stops full-grid re-renders on filter changes. */
export const ProductCard = memo(ProductCardSafe);
