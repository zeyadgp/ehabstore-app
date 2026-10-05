import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X, ArrowLeft, Layers, Tag } from "lucide-react";
import { useProducts, useCategories, formatMoney, priceOf } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { rankProductsBySearch, normalizeArabic } from "@/lib/search";
import { SmartImage } from "@/components/SmartImage";

export function InstantSearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategories();
  const { code: currencyCode, currencies } = useCurrency();

  const activeCurrency = currencies.find((c) => c.code === currencyCode);
  const currencySymbol = activeCurrency?.symbol || "ر.ي";

  // التركيز التلقائي عند الفتح
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // إغلاق بـ Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // نتائج البحث الفورية المعتمدة على خوارزمية التطبيع والفرز العربي
  const results = useMemo(() => {
    if (!query.trim()) return [];
    return rankProductsBySearch(products, query).slice(0, 8);
  }, [products, query]);

  // الأقسام المطابقة للبحث
  const matchedCategories = useMemo(() => {
    if (!query.trim()) return [];
    const normQ = normalizeArabic(query);
    return categories.filter((c) => normalizeArabic(c.name).includes(normQ)).slice(0, 3);
  }, [categories, query]);

  if (!isOpen) return null;

  const handleFullSearch = () => {
    if (!query.trim()) return;
    onClose();
    navigate({
      to: "/products",
      search: { q: query.trim(), sort: "newest" },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 pt-12 backdrop-blur-xs sm:p-4 sm:pt-20 animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="البحث الفوري المعرّب"
      >
        {/* شريط البحث المباشر */}
        <div className="relative flex items-center border-b border-border/80 px-4 py-3.5 sm:px-5">
          <Search className="h-5 w-5 shrink-0 text-primary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFullSearch();
            }}
            placeholder="ابحثي عن منتج، ماركة، غسول، سيروم، كود SKU..."
            className="flex-1 bg-transparent px-3 text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground/60 sm:text-base"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="me-2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="مسح البحث"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/80 bg-secondary/60 px-2.5 py-1 text-xs font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            إغلاق (Esc)
          </button>
        </div>

        {/* جسم النتائج */}
        <div className="max-h-[65vh] overflow-y-auto p-4 sm:p-5">
          {/* اقتراحات سريعة عند خلو البحث */}
          {!query.trim() && (
            <div className="space-y-4">
              <div>
                <div className="mb-2.5 flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  <span>عمليات بحث شائعة:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    "واقي شمس",
                    "سيروم نياسيناميد",
                    "غسول للبشرة",
                    "عطر فرنسي",
                    "مرطب شفايف",
                    "ماسكارا",
                  ].map((keyword) => (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => setQuery(keyword)}
                      className="rounded-xl border border-border/70 bg-secondary/40 px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-primary/50 hover:bg-secondary hover:text-primary"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>

              {categories.length > 0 && (
                <div className="pt-2">
                  <div className="mb-2.5 flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span>تصفح الأقسام المميزة:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {categories.slice(0, 6).map((cat) => (
                      <Link
                        key={cat.id}
                        to="/products"
                        search={{ category: cat.slug, q: "", sort: "newest" }}
                        onClick={onClose}
                        className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/30 p-2.5 transition-colors hover:border-primary/50 hover:bg-secondary"
                      >
                        <span className="text-xs font-bold text-foreground line-clamp-1">
                          {cat.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* الأقسام المطابقة */}
          {matchedCategories.length > 0 && (
            <div className="mb-4 space-y-1.5">
              <div className="text-[11px] font-bold text-muted-foreground">أقسام مطابقة:</div>
              <div className="flex flex-wrap gap-2">
                {matchedCategories.map((c) => (
                  <Link
                    key={c.id}
                    to="/products"
                    search={{ category: c.slug, q: "", sort: "newest" }}
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/20"
                  >
                    <Tag className="h-3 w-3" />
                    <span>{c.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* المنتجات المطابقة */}
          {query.trim() && (
            <div>
              {results.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-bold text-foreground">
                    لا توجد منتجات مطابقة لـ &quot;{query}&quot;
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    جربي كلمات أخرى أو تفقدِي قسم العناية والتجميل في المتجر
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-bold">نتائج المنتجات ({results.length}):</span>
                    <button
                      type="button"
                      onClick={handleFullSearch}
                      className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                    >
                      <span>عرض جميع النتائج</span>
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="divide-y divide-border/60">
                    {results.map((product) => {
                      const finalPrice = priceOf(product);
                      return (
                        <Link
                          key={product.id}
                          to="/product/$slug"
                          params={{ slug: product.slug }}
                          onClick={onClose}
                          className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-secondary/60"
                        >
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-background">
                            <SmartImage
                              paths={product.images}
                              alt={product.name}
                              className="h-full w-full object-cover"
                              width={56}
                              height={56}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="line-clamp-1 text-xs font-extrabold text-foreground sm:text-sm">
                              {product.name}
                            </h4>
                            {product.sku && (
                              <p className="text-[10px] font-medium text-muted-foreground">
                                SKU: {product.sku}
                              </p>
                            )}
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs font-black text-primary">
                                {formatMoney(finalPrice, currencySymbol)}
                              </span>
                              {product.stock <= 0 && (
                                <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                                  نفدت الكمية
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-muted-foreground">
                            <ArrowLeft className="h-4 w-4" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* شريط الإجراء السفلي */}
        {query.trim() && results.length > 0 && (
          <div className="border-t border-border/70 bg-secondary/30 p-3 text-center">
            <button
              type="button"
              onClick={handleFullSearch}
              className="w-full rounded-xl gradient-gold py-2 text-xs font-extrabold text-primary-foreground shadow-soft transition-transform active:scale-98"
            >
              عرض كل نتائج البحث لـ &quot;{query}&quot;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
