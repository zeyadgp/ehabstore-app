import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Check, ShoppingBag, Heart, Layers, Tag } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import { useCurrency } from "@/lib/currency";
import { useCart } from "@/lib/cart";
import { priceOf, useCategories, type Product } from "@/lib/store";
import { toast } from "sonner";

interface ProductBundleSectionProps {
  currentProduct: Product;
  candidateProducts: Product[];
}

export function ProductBundleSection({
  currentProduct,
  candidateProducts,
}: ProductBundleSectionProps) {
  const { format, unitFor } = useCurrency();
  const cart = useCart();
  const { data: categories = [] } = useCategories();

  // تصفية منتجين إضافيين متوفرين في المخزون لإكمال الروتين الثلاثي
  const bundleItems = candidateProducts
    .filter((p) => p.id !== currentProduct.id && p.status && p.stock > 0)
    .slice(0, 2);

  const allItems = [currentProduct, ...bundleItems];
  const [selectedIds, setSelectedIds] = useState<string[]>(allItems.map((p) => p.id));

  if (bundleItems.length === 0) return null;

  // تحديد تصنيف المنتج لتخصيص العبارات ديناميكياً
  const currentCategory = categories.find((c) => c.id === currentProduct.category_id);
  const isSkinCare = Boolean(
    currentCategory?.name?.includes("بشرة") ||
    currentCategory?.slug?.includes("skin") ||
    currentProduct.name?.includes("بشرة") ||
    currentProduct.name?.includes("سيروم") ||
    currentProduct.name?.includes("غسول") ||
    currentProduct.name?.includes("مرطب") ||
    currentProduct.name?.includes("تونر"),
  );

  const subtitle = isSkinCare
    ? "للبشرة الأكثر نضارة .. في خطوة واحدة"
    : "لعناية متكاملة وتوفير مضاعف .. في خطوة واحدة";

  const romanticFooter = isSkinCare
    ? "♡ بشرة أجمل .. مع الروتين الكامل ♡"
    : "♡ إطلالة متألقة .. مع الروتين الكامل ♡";

  const toggleSelect = (id: string) => {
    if (id === currentProduct.id) return; // المنتج الأساسي يبقى محدداً
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectedProducts = allItems.filter((p) => selectedIds.includes(p.id));
  const rawTotal = selectedProducts.reduce((sum, p) => sum + unitFor(p.id, priceOf(p)), 0);

  // خصم حزمة تشجيعي 10% عند تفعيل روتين متعدد المنتجات
  const bundleDiscountRate = selectedProducts.length >= 2 ? 0.1 : 0;
  const discountedTotal = Math.round(rawTotal * (1 - bundleDiscountRate));
  const savings = rawTotal - discountedTotal;

  const handleAddBundleToCart = () => {
    if (selectedProducts.length === 0) return;
    selectedProducts.forEach((p) => {
      cart.add(
        {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: priceOf(p),
          image: p.images?.[0] ?? null,
        },
        1,
      );
    });
    toast.success(`تمت إضافة المجموعة كاملة (${selectedProducts.length} منتجات) إلى السلة بنجاح!`);
  };

  return (
    <section className="mt-14 rounded-3xl border border-primary/20 bg-linear-to-b from-primary/5 via-card to-card p-5 sm:p-7 shadow-soft md:p-8">
      {/* 1. ترويسة القسم العلوية (Header) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl gradient-gold text-primary-foreground shadow-2xs">
              <Layers className="h-4 w-4" />
            </span>
            <h2 className="font-display text-lg sm:text-xl font-black text-foreground">
              اشتري الروتين كامل
            </h2>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm font-medium text-muted-foreground">{subtitle}</p>
        </div>

        {bundleDiscountRate > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-black text-primary shadow-2xs">
              <Tag className="h-3.5 w-3.5" />
              <span>وفرت {format(savings)} مع الروتين</span>
            </span>
          </div>
        )}
      </div>

      {/* 2. بطاقات المنتجات الأفقية المترابطة بإشارات + */}
      <div className="mt-6 overflow-x-auto pb-3 pt-1 scrollbar-none">
        <div className="flex items-center justify-start md:justify-center gap-2.5 sm:gap-4 min-w-max px-1">
          {allItems.map((prod, idx) => {
            const isSelected = selectedIds.includes(prod.id);
            const isBase = prod.id === currentProduct.id;

            return (
              <div key={prod.id} className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                <div
                  onClick={() => toggleSelect(prod.id)}
                  className={`group relative flex w-36 sm:w-44 flex-col items-center rounded-2xl border p-3 text-center transition-all duration-200 cursor-pointer select-none ${
                    isSelected
                      ? "border-primary bg-card shadow-soft ring-2 ring-primary/20"
                      : "border-border bg-card/60 opacity-60 hover:opacity-100 hover:border-primary/50"
                  }`}
                >
                  {/* زر اختيار علوي دائري (Circular Checkbox) */}
                  <div
                    className={`absolute top-2 start-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-xs transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background/90 text-transparent"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </div>

                  {/* صورة مربعة مع حواف rounded-xl */}
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
                    <SmartImage
                      paths={prod.images ?? []}
                      fallback={fallbackFor(prod.slug)}
                      alt={prod.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {isBase && (
                      <span className="absolute bottom-1.5 inset-x-1.5 rounded-md bg-black/65 py-0.5 text-[9px] font-bold text-white backdrop-blur-xs">
                        المنتج الأساسي
                      </span>
                    )}
                  </div>

                  {/* اسم المنتج */}
                  <Link
                    to="/product/$slug"
                    params={{ slug: prod.slug }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2.5 line-clamp-2 text-xs font-bold text-foreground hover:text-primary transition-colors h-8"
                    title={prod.name}
                  >
                    {prod.name}
                  </Link>

                  {/* سعر المنتج */}
                  <div className="mt-1.5 font-display text-xs sm:text-sm font-black text-primary">
                    {format(unitFor(prod.id, priceOf(prod)))}
                  </div>
                </div>

                {/* علامة + بين البطاقات */}
                {idx < allItems.length - 1 && (
                  <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full gradient-gold text-primary-foreground shadow-2xs font-black">
                    <Plus className="h-4 w-4 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. كرت الحساب والشراء السفلي (Bundle Action Summary Card) */}
      <div className="mt-6 rounded-3xl border border-primary/20 bg-card/90 backdrop-blur-xs p-5 sm:p-6 shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          {/* الجانب الأيمن: ختم التوفير وتفاصيل السعر */}
          <div className="flex items-center gap-4">
            {/* شارة التوفير الجانبية: ختم دائري أنيق يحمل عبارة "وفّر أكثر" */}
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full gradient-gold text-primary-foreground shadow-soft text-center select-none ring-4 ring-primary/10">
              <span className="text-[11px] font-black leading-tight">وفّر</span>
              <span className="text-[10px] font-extrabold leading-tight">أكثر</span>
            </div>

            {/* تفاصيل السعر */}
            <div>
              <p className="text-xs font-bold text-muted-foreground">
                سعر المنتجات المحددة ({selectedProducts.length}):
              </p>
              <div className="mt-1 flex items-baseline gap-2.5">
                <span className="font-display text-2xl sm:text-3xl font-black tabular-nums text-primary">
                  {format(discountedTotal)}
                </span>
                {bundleDiscountRate > 0 && (
                  <span className="text-sm font-bold tabular-nums text-muted-foreground line-through opacity-70">
                    {format(rawTotal)}
                  </span>
                )}
              </div>
              {bundleDiscountRate > 0 ? (
                <p className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  ✓ تم تطبيق خصم الباقة المتكاملة (10%)
                </p>
              ) : (
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  حدد منتجين أو أكثر للاستفادة من خصم الروتين المتكامل (10%)
                </p>
              )}
            </div>
          </div>

          {/* الجانب الأيسر: زر الإضافة للسلة */}
          <div className="md:w-72 shrink-0">
            <button
              type="button"
              onClick={handleAddBundleToCart}
              disabled={selectedProducts.length === 0}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl gradient-gold py-3.5 px-6 text-sm font-extrabold text-primary-foreground shadow-soft transition-all duration-200 hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>إضافة المجموعة كاملة للسلة</span>
            </button>
          </div>
        </div>

        {/* تذييل رومانسي/جمالي في الأسفل */}
        <div className="mt-5 border-t border-border/60 pt-3 text-center">
          <p className="text-xs font-bold text-primary/80 tracking-wide flex items-center justify-center gap-1.5">
            <Heart className="h-3 w-3 fill-primary/40 text-primary" />
            <span>{romanticFooter}</span>
            <Heart className="h-3 w-3 fill-primary/40 text-primary" />
          </p>
        </div>
      </div>
    </section>
  );
}
