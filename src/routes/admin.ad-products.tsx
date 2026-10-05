import { useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Filter,
  CheckSquare,
  Square,
  RefreshCw,
  PlusCircle,
  Megaphone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Layers,
  ArrowRight,
  Package,
} from "lucide-react";
import { useProducts, useCategories, priceOf } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import { syncProductsToMeta } from "@/lib/meta/api";
import { getMetaConfig } from "@/lib/meta/storage";

export const Route = createFileRoute("/admin/ad-products")({
  head: () => ({
    meta: [{ title: "منتجات الإعلانات | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdProductsPage,
});

export function AdProductsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { symbol } = useCurrency();
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: metaConfig } = useQuery({
    queryKey: ["meta-settings"],
    queryFn: getMetaConfig,
  });

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [syncFilter, setSyncFilter] = useState<"all" | "synced" | "pending" | "out_of_stock">(
    "all",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // حالة المزامنة للمنتجات (محفوظة محلياً وفي Meta)
  const [syncedMap, setSyncedMap] = useState<Record<string, { synced: boolean; syncedAt: string }>>(
    () => {
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("ehab_meta_synced_map");
          if (stored) return JSON.parse(stored);
        } catch {
          /* ignore */
        }
      }
      return {};
    },
  );

  // تصفية المنتجات
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));

      const matchCategory = selectedCategory === "all" || p.category_id === selectedCategory;

      const isSynced = syncedMap[p.id]?.synced ?? true; // افتراضياً تعتبر المنتجات متزامنة مع الكتالوج
      const inStock = p.stock > 0;

      let matchSync = true;
      if (syncFilter === "synced") matchSync = isSynced && inStock;
      if (syncFilter === "pending") matchSync = !isSynced;
      if (syncFilter === "out_of_stock") matchSync = !inStock;

      return matchSearch && matchCategory && matchSync;
    });
  }, [products, search, selectedCategory, syncFilter, syncedMap]);

  // تحديد الكل أو إلغاء التحديد
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // مزامنة المنتجات مع Meta Catalog
  const syncMutation = useMutation({
    mutationFn: async (targetProducts: typeof products) => {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "https://ehabstore.app";
      return syncProductsToMeta(targetProducts, origin);
    },
    onSuccess: (res, vars) => {
      if (!res.success) {
        toast.error(res.error || "تعذرت المزامنة مع Meta");
        return;
      }
      const updatedMap = { ...syncedMap };
      const now = new Date().toISOString();
      vars.forEach((p) => {
        updatedMap[p.id] = { synced: true, syncedAt: now };
      });
      setSyncedMap(updatedMap);
      if (typeof window !== "undefined") {
        localStorage.setItem("ehab_meta_synced_map", JSON.stringify(updatedMap));
      }
      toast.success(`تمت مزامنة ${vars.length} منتج بنجاح مع Meta Catalog!`);
      qc.invalidateQueries({ queryKey: ["meta-settings"] });
    },
    onError: () => {
      toast.error("فشلت عملية المزامنة، يرجى التحقق من إعدادات الربط.");
    },
  });

  const handleSyncSelected = () => {
    const toSync = products.filter((p) => selectedIds.has(p.id));
    if (toSync.length === 0) {
      toast.info("يرجى تحديد منتجات للمزامنة أولاً");
      return;
    }
    syncMutation.mutate(toSync);
  };

  const handleSyncAll = () => {
    if (products.length === 0) return;
    syncMutation.mutate(products);
  };

  // الانتقال لإنشاء حملة إعلانية بالمنتجات المحددة
  const handleCreateAdForSelected = () => {
    if (selectedIds.size === 0) {
      toast.info("يرجى تحديد منتج واحد على الأقل لإنشاء الإعلان");
      return;
    }
    const idsString = Array.from(selectedIds).join(",");
    void navigate({
      to: "/admin/ads",
      search: {
        tab: "create",
        products: idsString,
      } as any,
    });
  };

  // إحصائيات سريعة
  const totalCount = products.length;
  const inStockCount = products.filter((p) => p.stock > 0).length;
  const outOfStockCount = totalCount - inStockCount;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      {/* الرأس والتعليمات */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">منتجات الإعلانات والكتالوج</h1>
              <p className="text-xs text-muted-foreground">
                إدارة مزامنة منتجات المتجر مع Meta Catalog واختيار المنتجات المراد إطلاق حملات
                إعلانية لها.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            مزامنة الكتالوج بالكامل
          </button>

          <Link
            to="/admin/meta"
            className="inline-flex items-center gap-1.5 rounded-2xl border border-border/80 bg-muted/40 px-3.5 py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            إعدادات الكتالوج و Meta
          </Link>
        </div>
      </div>

      {/* بطاقات الإحصائيات السريعة */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground">إجمالي المنتجات</span>
          <p className="mt-1 text-2xl font-bold text-foreground">{totalCount}</p>
          <span className="text-[11px] text-emerald-600">جاهزة للإعلانات</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground">المتوفر في المخزون</span>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{inStockCount}</p>
          <span className="text-[11px] text-muted-foreground">نشط في Meta Shop</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground">نافد من المخزون</span>
          <p className="mt-1 text-2xl font-bold text-amber-600">{outOfStockCount}</p>
          <span className="text-[11px] text-muted-foreground">يتحدث تلقائياً كـ Out of stock</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground">المنتجات المحددة</span>
          <p className="mt-1 text-2xl font-bold text-primary">{selectedIds.size}</p>
          <span className="text-[11px] text-muted-foreground">جاهزة لإنشاء الإعلان</span>
        </div>
      </div>

      {/* شريط البحث والفلاتر */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="ابحث بالاسم، الكود، أو SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background py-2 pl-4 pr-10 text-xs font-medium outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* فلتر التصنيف */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
          >
            <option value="all">جميع التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* فلتر المزامنة */}
          <select
            value={syncFilter}
            onChange={(e) => setSyncFilter(e.target.value as any)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
          >
            <option value="all">كل الحالات</option>
            <option value="synced">متزامن ومتوفر</option>
            <option value="pending">بانتظار المزامنة</option>
            <option value="out_of_stock">نافد المخزون</option>
          </select>

          {/* زر تحديد كل المعروض */}
          <button
            onClick={toggleSelectAll}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-bold transition hover:bg-muted"
          >
            {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
              <>
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                إلغاء تحديد الكل
              </>
            ) : (
              <>
                <Square className="h-3.5 w-3.5 text-muted-foreground" />
                تحديد الكل ({filteredProducts.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* جدول / قائمة المنتجات */}
      {loadingProducts ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          جاري تحميل المنتجات...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-sm">
          <p className="text-base font-bold text-foreground">لا توجد منتجات مطابقة للبحث</p>
          <p className="mt-1 text-xs text-muted-foreground">
            جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-border bg-muted/40 font-bold text-muted-foreground">
                <tr>
                  <th className="w-12 px-4 py-3 text-center">
                    <button onClick={toggleSelectAll} className="p-1">
                      {selectedIds.size === filteredProducts.length &&
                      filteredProducts.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3">المنتج</th>
                  <th className="px-4 py-3">التصنيف</th>
                  <th className="px-4 py-3">السعر</th>
                  <th className="px-4 py-3">المخزون</th>
                  <th className="px-4 py-3">حالة الكتالوج (Meta)</th>
                  <th className="px-4 py-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredProducts.map((p) => {
                  const isSelected = selectedIds.has(p.id);
                  const isSynced = syncedMap[p.id]?.synced ?? true;
                  const cat = categories.find((c) => c.id === p.category_id);
                  const img = p.images?.[0] || fallbackFor("product");
                  const price = priceOf(p);
                  const hasDiscount = p.discount_price && Number(p.discount_price) > 0;

                  return (
                    <tr
                      key={p.id}
                      className={`transition hover:bg-muted/30 ${
                        isSelected ? "bg-primary/5 font-medium" : ""
                      }`}
                    >
                      {/* مربع التحديد */}
                      <td className="px-4 py-3 text-center">
                        <button type="button" onClick={() => toggleSelect(p.id)} className="p-1">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </td>

                      {/* صورة واسم المنتج */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                            <SmartImage
                              src={img}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-bold text-foreground line-clamp-1">{p.name}</p>
                            <span className="text-[11px] text-muted-foreground">
                              SKU: {p.sku || `EHAB-${p.id.slice(0, 6)}`}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* التصنيف */}
                      <td className="px-4 py-3 text-muted-foreground">{cat?.name || "عام"}</td>

                      {/* السعر والخصم */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">
                            {price} {symbol}
                          </span>
                          {hasDiscount && (
                            <span className="text-[10px] text-muted-foreground line-through">
                              {p.price} {symbol}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* المخزون */}
                      <td className="px-4 py-3">
                        {p.stock > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                            متوفر ({p.stock})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
                            نفد المخزون
                          </span>
                        )}
                      </td>

                      {/* حالة المزامنة مع Meta */}
                      <td className="px-4 py-3">
                        {isSynced ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            متزامن في الكتالوج
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600">
                            <Clock className="h-3 w-3" />
                            بانتظار التحديث
                          </span>
                        )}
                      </td>

                      {/* الإجراء السريع */}
                      <td className="px-4 py-3 text-left">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIds(new Set([p.id]));
                              void navigate({
                                to: "/admin/ads",
                                search: { tab: "create", products: p.id } as any,
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary transition hover:bg-primary/20"
                          >
                            <Megaphone className="h-3 w-3" />
                            إنشاء إعلان
                          </button>

                          <Link
                            to="/product/$slug"
                            params={{ slug: p.slug }}
                            target="_blank"
                            className="rounded-xl border border-border p-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* الشريط العائم السفلي عند تحديد أي منتجات */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-3xl border border-border bg-card/95 px-6 py-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold text-foreground">منتج محدد</span>
          </div>

          <div className="h-5 w-px bg-border" />

          <button
            onClick={handleSyncSelected}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-background px-4 py-2 text-xs font-bold transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            مزامنة مع Meta
          </button>

          <button
            onClick={handleCreateAdForSelected}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            <Megaphone className="h-3.5 w-3.5" />
            إنشاء إعلان للمنتجات المحددة
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
}
