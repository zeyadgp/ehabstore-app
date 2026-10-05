import { useState, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Save,
  RotateCcw,
  Search,
  Filter,
  Percent,
  TrendingUp,
  AlertTriangle,
  Package,
  Layers,
  CheckCircle2,
  Download,
  Upload,
} from "lucide-react";
import { useAllProducts, useAdminCategories, useAdminCurrency } from "@/lib/admin";
import { useProductCosts } from "@/lib/suppliers";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "@/components/SmartImage";

export const Route = createFileRoute("/admin/bulk-editor")({
  component: AdminBulkEditorPage,
});

type RowEdit = {
  price: number;
  discount_price: number | null;
  stock: number;
  status: boolean;
  cost_price: number;
};

function AdminBulkEditorPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading: productsLoading } = useAllProducts();
  const { data: categories = [] } = useAdminCategories();
  const { costs, saveProductCosts } = useProductCosts();
  const { label: currency } = useAdminCurrency();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterStock, setFilterStock] = useState<"all" | "low" | "out">("all");
  const [isSaving, setIsSaving] = useState(false);

  // Local modifications state map: productId -> RowEdit
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});

  // Batch adjustment percentage
  const [batchPercent, setBatchPercent] = useState<number>(5);

  const getRowValue = (id: string, field: keyof RowEdit, originalVal: any) => {
    if (edits[id] && edits[id][field] !== undefined) {
      return edits[id][field];
    }
    return originalVal;
  };

  const handleFieldChange = (
    id: string,
    field: keyof RowEdit,
    value: any,
    originalProduct: any,
  ) => {
    setEdits((prev) => {
      const current = prev[id] || {
        price: Number(originalProduct.price || 0),
        discount_price: originalProduct.discount_price
          ? Number(originalProduct.discount_price)
          : null,
        stock: Number(originalProduct.stock || 0),
        status: Boolean(originalProduct.status),
        cost_price: costs[id]?.cost_price ?? Math.round(Number(originalProduct.price || 0) * 0.65),
      };

      return {
        ...prev,
        [id]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));

      const matchesCategory = selectedCategory === "all" || p.category_id === selectedCategory;

      const stock = edits[p.id]?.stock ?? p.stock;
      const matchesStock =
        filterStock === "all" ||
        (filterStock === "low" && stock > 0 && stock <= 5) ||
        (filterStock === "out" && stock <= 0);

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, search, selectedCategory, filterStock, edits]);

  // Apply batch percentage to current filtered list
  const applyBatchPercentage = (sign: "+" | "-") => {
    const factor = sign === "+" ? 1 + batchPercent / 100 : 1 - batchPercent / 100;
    const newEdits = { ...edits };

    filteredProducts.forEach((p) => {
      const currentPrice = getRowValue(p.id, "price", Number(p.price || 0));
      const newPrice = Math.round(currentPrice * factor);

      newEdits[p.id] = {
        ...(newEdits[p.id] || {
          price: Number(p.price || 0),
          discount_price: p.discount_price ? Number(p.discount_price) : null,
          stock: Number(p.stock || 0),
          status: Boolean(p.status),
          cost_price: costs[p.id]?.cost_price ?? Math.round(Number(p.price || 0) * 0.65),
        }),
        price: newPrice,
      };
    });

    setEdits(newEdits);
    toast.success(`تم تعديل أسعار ${filteredProducts.length} منتج بنسبة ${sign}${batchPercent}%`);
  };

  // Save all modifications
  const handleSaveAll = async () => {
    const editEntries = Object.entries(edits);
    if (editEntries.length === 0) {
      toast.info("لا توجد تعديلات معلقة للحفظ");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update products table in Supabase
      const productPromises = editEntries.map(([id, values]) => {
        return supabase
          .from("products")
          .update({
            price: values.price,
            discount_price: values.discount_price,
            stock: values.stock,
            status: values.status,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", id);
      });

      await Promise.all(productPromises);

      // 2. Update costs map
      const updatedCosts = { ...costs };
      editEntries.forEach(([id, values]) => {
        if (values.cost_price !== undefined) {
          updatedCosts[id] = {
            product_id: id,
            cost_price: values.cost_price,
            supplier_id: costs[id]?.supplier_id,
            updated_at: new Date().toISOString(),
          };
        }
      });
      await saveProductCosts(updatedCosts);

      // Refresh cache
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      setEdits({});
      toast.success(`تم حفظ تعديلات ${editEntries.length} منتج بنجاح في قاعدة البيانات`);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء حفظ التعديلات الجماعية");
    } finally {
      setIsSaving(false);
    }
  };

  const pendingCount = Object.keys(edits).length;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    try {
      const headers = [
        "المعرف",
        "رمز SKU",
        "اسم المنتج",
        "سعر البيع",
        "سعر الخصم",
        "سعر التكلفة",
        "المخزون",
      ];
      const rows = products.map((p) => {
        const costVal =
          edits[p.id]?.cost_price !== undefined
            ? edits[p.id]?.cost_price
            : costs[p.id]?.cost_price !== undefined
              ? costs[p.id]?.cost_price
              : "";
        const priceVal = edits[p.id]?.price ?? p.price ?? 0;
        const discountVal =
          edits[p.id]?.discount_price !== undefined
            ? edits[p.id]?.discount_price
            : (p.discount_price ?? "");
        const stockVal = edits[p.id]?.stock ?? p.stock ?? 0;
        return [
          p.id,
          p.sku || "",
          `"${p.name.replace(/"/g, '""')}"`,
          priceVal,
          discountVal ?? "",
          costVal,
          stockVal,
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products-bulk-editor-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير ملف جدول الأسعار والتكاليف بنجاح");
    } catch {
      toast.error("تعذر تصدير ملف CSV");
    }
  };

  const parseCsvLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === "," && !inQuotes) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rawText = await file.text();
      // إزالة علامة BOM إن وُجدت وتطبيع فواصل الأسطر
      const normalized = rawText
        .replace(/^\uFEFF/, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");
      const lines = normalized.split("\n").filter((l) => l.trim());
      if (lines.length <= 1) throw new Error("الملف فارغ أو لا يحتوي على بيانات كافية");

      let importedCount = 0;
      const newEdits = { ...edits };

      const productMapById = new Map(products.map((p) => [p.id, p]));
      const productMapBySku = new Map(
        products.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase().trim(), p]),
      );
      const productMapByName = new Map(products.map((p) => [p.name.toLowerCase().trim(), p]));

      for (let i = 1; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i] ?? "");
        if (parts.length < 3) continue;

        const idOrSku = parts[0]?.trim();
        const skuPart = parts[1]?.trim();
        const namePart = parts[2]?.replace(/^"|"$/g, "").trim();

        const target =
          (idOrSku ? productMapById.get(idOrSku) : null) ||
          (skuPart ? productMapBySku.get(skuPart.toLowerCase()) : null) ||
          (idOrSku ? productMapBySku.get(idOrSku.toLowerCase()) : null) ||
          (namePart ? productMapByName.get(namePart.toLowerCase()) : null);

        if (target) {
          const rawPrice = parts[3]?.replace(/[^\d.]/g, "");
          const rawDiscount = parts[4]?.replace(/[^\d.]/g, "");
          const rawCost = parts[5]?.replace(/[^\d.]/g, "");
          const rawStock = parts[6]?.replace(/[^\d.]/g, "");

          const price =
            rawPrice !== "" && rawPrice !== undefined
              ? Number(rawPrice)
              : Number(target.price || 0);
          const discount =
            rawDiscount !== "" && rawDiscount !== undefined ? Number(rawDiscount) : null;
          const cost =
            rawCost !== "" && rawCost !== undefined
              ? Number(rawCost)
              : (costs[target.id]?.cost_price ?? 0);
          const stock =
            rawStock !== "" && rawStock !== undefined
              ? Math.max(0, Math.floor(Number(rawStock)))
              : Number(target.stock || 0);

          newEdits[target.id] = {
            price: isNaN(price) ? Number(target.price || 0) : Math.max(0, price),
            discount_price: isNaN(discount as number) ? null : discount,
            cost_price: isNaN(cost) ? (costs[target.id]?.cost_price ?? 0) : Math.max(0, cost),
            stock: isNaN(stock) ? Number(target.stock || 0) : stock,
            status: target.status,
          };
          importedCount++;
        }
      }

      if (importedCount === 0)
        throw new Error("لم يتم العثور على منتجات مطابقة للمعرف أو الـ SKU أو الاسم");

      setEdits(newEdits);
      toast.success(`تم بنجاح تحميل تعديلات ${importedCount} منتج للمعاينة! اضغط حفظ لاعتمادها.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل استيراد ملف CSV");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hidden CSV Import Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={handleImportCsv}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              التعديل الجماعي السريع للأسعار والمخزون
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            تعديل فوري ومباشر لأسعار البيع، التكلفة، وكميات المخزون لعدة منتجات دفعة واحدة مع
            استيراد وتصدير Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-xs hover:bg-muted/80 transition"
          >
            <Download className="h-3.5 w-3.5" />
            تصدير CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-xs hover:bg-muted/80 transition"
          >
            <Upload className="h-3.5 w-3.5" />
            استيراد CSV
          </button>

          {pendingCount > 0 && (
            <button
              onClick={() => setEdits({})}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              تراجع ({pendingCount})
            </button>
          )}

          <button
            onClick={handleSaveAll}
            disabled={pendingCount === 0 || isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "جارٍ الحفظ..." : `حفظ التغييرات (${pendingCount})`}
          </button>
        </div>
      </div>

      {/* Batch Adjuster Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-foreground">تعديل نسبة الأسعار جماعياً:</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={100}
              value={batchPercent}
              onChange={(e) => setBatchPercent(Math.max(1, Number(e.target.value)))}
              className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-xs font-bold outline-none"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => applyBatchPercentage("+")}
            className="rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
          >
            زيادة بنسبة +{batchPercent}%
          </button>
          <button
            onClick={() => applyBatchPercentage("-")}
            className="rounded-xl bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
          >
            تخفيض بنسبة -{batchPercent}%
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="البحث باسم المنتج أو رمز SKU..."
            className="w-full rounded-xl border border-border bg-background py-2 pr-9 pl-4 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground outline-none"
          >
            <option value="all">جميع التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterStock}
            onChange={(e) => setFilterStock(e.target.value as any)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground outline-none"
          >
            <option value="all">حالة المخزون (الكل)</option>
            <option value="low">مخزون منخفض (≤ 5)</option>
            <option value="out">مخزون نافد (0)</option>
          </select>
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-border/60 bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">الصورة والمنتج</th>
                <th className="px-4 py-3 font-semibold">التصنيف</th>
                <th className="px-4 py-3 font-semibold text-center">سعر البيع ({currency})</th>
                <th className="px-4 py-3 font-semibold text-center">سعر الخصم ({currency})</th>
                <th className="px-4 py-3 font-semibold text-center">سعر التكلفة ({currency})</th>
                <th className="px-4 py-3 font-semibold text-center">المخزون (قطعة)</th>
                <th className="px-4 py-3 font-semibold text-center">حالة العرض</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {productsLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    جارٍ تحميل المنتجات...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    لا توجد منتجات مطابقة لخيارات الفرز
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isModified = Boolean(edits[p.id]);
                  const price = getRowValue(p.id, "price", Number(p.price || 0));
                  const discountPrice = getRowValue(
                    p.id,
                    "discount_price",
                    p.discount_price ? Number(p.discount_price) : "",
                  );
                  const costPrice = getRowValue(
                    p.id,
                    "cost_price",
                    costs[p.id]?.cost_price ?? Math.round(Number(p.price || 0) * 0.65),
                  );
                  const stock = getRowValue(p.id, "stock", Number(p.stock || 0));
                  const status = getRowValue(p.id, "status", Boolean(p.status));

                  const categoryName = categories.find((c) => c.id === p.category_id)?.name || "—";

                  return (
                    <tr
                      key={p.id}
                      className={`transition ${
                        isModified ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                      }`}
                    >
                      {/* Image & Product info */}
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                            <SmartImage
                              paths={p.images || []}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="line-clamp-1 font-bold text-foreground">{p.name}</div>
                            {p.sku && (
                              <div className="text-[11px] text-muted-foreground" dir="ltr">
                                SKU: {p.sku}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 text-muted-foreground">{categoryName}</td>

                      {/* Price input */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={price}
                          onChange={(e) =>
                            handleFieldChange(p.id, "price", Number(e.target.value), p)
                          }
                          className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-center font-bold text-foreground outline-none focus:border-primary"
                        />
                      </td>

                      {/* Discount price input */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={discountPrice ?? ""}
                          placeholder="—"
                          onChange={(e) =>
                            handleFieldChange(
                              p.id,
                              "discount_price",
                              e.target.value ? Number(e.target.value) : null,
                              p,
                            )
                          }
                          className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-center text-foreground outline-none focus:border-primary"
                        />
                      </td>

                      {/* Cost price input */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={costPrice}
                          onChange={(e) =>
                            handleFieldChange(p.id, "cost_price", Number(e.target.value), p)
                          }
                          className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-center text-rose-600 dark:text-rose-400 font-semibold outline-none focus:border-primary"
                        />
                      </td>

                      {/* Stock input */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={stock}
                          onChange={(e) =>
                            handleFieldChange(p.id, "stock", Number(e.target.value), p)
                          }
                          className={`w-20 rounded-lg border px-2 py-1 text-center font-bold outline-none ${
                            stock <= 0
                              ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              : stock <= 5
                                ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                : "border-border bg-background text-foreground"
                          }`}
                        />
                      </td>

                      {/* Status toggle */}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleFieldChange(p.id, "status", !status, p)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                            status
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {status ? "معروض" : "مخفي"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
