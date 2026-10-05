import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Wallet,
  Percent,
  Calendar,
  Download,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Layers,
  Edit3,
  Check,
  Building2,
  PieChart as PieIcon,
} from "lucide-react";
import { useOrders, useOrderItems, useAllProducts, useAdminCurrency } from "@/lib/admin";
import { useProductCosts, useSuppliers } from "@/lib/suppliers";
import { calculateFinancialProfits, ProductProfitItem } from "@/lib/profits";

export const Route = createFileRoute("/admin/profits")({
  component: AdminProfitsPage,
});

type TimeRange = "today" | "7days" | "30days" | "year" | "all";

function AdminProfitsPage() {
  const { data: orders = [], isLoading: ordersLoading } = useOrders();
  const { data: orderItems = [], isLoading: itemsLoading } = useOrderItems();
  const { data: products = [] } = useAllProducts();
  const { costs, saveProductCosts, isSaving: savingCost } = useProductCosts();
  const { suppliers } = useSuppliers();
  const { label: currency } = useAdminCurrency();

  const [timeRange, setTimeRange] = useState<TimeRange>("30days");
  const [searchProduct, setSearchProduct] = useState("");
  const [defaultCostRatio, setDefaultCostRatio] = useState<number>(0.65);
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [editCostVal, setEditCostVal] = useState<string>("");
  const [editSupplierId, setEditSupplierId] = useState<string>("");

  // Filter orders by time range
  const filteredOrders = useMemo(() => {
    if (timeRange === "all") return orders;
    const now = Date.now();
    const cutoff =
      timeRange === "today"
        ? now - 86400000
        : timeRange === "7days"
          ? now - 7 * 86400000
          : timeRange === "30days"
            ? now - 30 * 86400000
            : now - 365 * 86400000;

    return orders.filter((o) => new Date(o.created_at).getTime() >= cutoff);
  }, [orders, timeRange]);

  // Calculate profit figures
  const { summary, productProfits, dailyProfits } = useMemo(() => {
    return calculateFinancialProfits({
      orders: filteredOrders,
      orderItems,
      products,
      costsMap: costs,
      defaultCostRatio,
    });
  }, [filteredOrders, orderItems, products, costs, defaultCostRatio]);

  // Filtered product profit list
  const filteredProductProfits = useMemo(() => {
    if (!searchProduct.trim()) return productProfits;
    return productProfits.filter((p) =>
      p.productName.toLowerCase().includes(searchProduct.toLowerCase()),
    );
  }, [productProfits, searchProduct]);

  const handleOpenEditCost = (item: ProductProfitItem) => {
    setEditingCostId(item.productId);
    const existing = costs[item.productId];
    setEditCostVal(existing ? String(existing.cost_price) : String(Math.round(item.unitCost)));
    setEditSupplierId(existing?.supplier_id || "");
  };

  const handleSaveCost = async (productId: string) => {
    const num = parseFloat(editCostVal);
    if (isNaN(num) || num < 0) {
      toast.error("يرجى إدخال سعر تكلفة صحيح");
      return;
    }

    try {
      const updated = {
        ...costs,
        [productId]: {
          product_id: productId,
          cost_price: num,
          supplier_id: editSupplierId || undefined,
          updated_at: new Date().toISOString(),
        },
      };
      await saveProductCosts(updated);
      setEditingCostId(null);
      toast.success("تم تحديث سعر التكلفة وحساب الأرباح بنجاح");
    } catch {
      toast.error("تعذر حفظ سعر التكلفة");
    }
  };

  // Export CSV Report
  const exportCsv = () => {
    const headers = [
      "المنتج",
      "الكمية المباعة",
      "سعر البيع",
      "سعر التكلفة",
      "إجمالي المبيعات",
      "إجمالي التكلفة",
      "صافي الربح",
      "هامش الربح %",
    ];
    const rows = productProfits.map((p) => [
      `"${p.productName.replace(/"/g, '""')}"`,
      p.quantitySold,
      p.unitPrice,
      p.unitCost,
      p.totalRevenue,
      p.totalCogs,
      p.profit,
      `${p.marginPercent.toFixed(1)}%`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `تقرير-أرباح-إيهاب-ستور-${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              حساب الأرباح والتحليل المالي
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            لوحة قياس صافي الأرباح الحقيقية، تكلفة البضاعة المباعة (COGS)، وهوامش ربحية المنتجات
            وتسوية التحصيل.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time range selector */}
          <div className="flex rounded-xl border border-border bg-card p-1 shadow-xs">
            {(
              [
                { id: "today", label: "اليوم" },
                { id: "7days", label: "7 أيام" },
                { id: "30days", label: "30 يوم" },
                { id: "year", label: "هذا العام" },
                { id: "all", label: "الكل" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  timeRange === t.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            تصدير تقرير CSV
          </button>
        </div>
      </div>

      {/* Main KPI Bento Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">إجمالي المبيعات</span>
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-foreground">
            {summary.totalRevenue.toLocaleString()} {currency}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            من {summary.totalOrdersCount} طلب مكتمل ومؤكد
          </p>
        </div>

        {/* Cost of Goods Sold */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              تكلفة البضاعة (COGS)
            </span>
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {summary.totalCogs.toLocaleString()} {currency}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">تكلفة شراء المنتجات الموردة</p>
        </div>

        {/* Gross / Net Profit */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/40 p-5 shadow-xs dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              صافي الربح الإجمالي
            </span>
            <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            +{summary.grossProfit.toLocaleString()} {currency}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <ArrowUpRight className="h-3.5 w-3.5" />
            هامش ربح {summary.profitMarginPercent}%
          </div>
        </div>

        {/* COD Reconciliation */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              مبالغ الدفع عند الاستلام
            </span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-foreground">
            {summary.codPendingAmount.toLocaleString()} {currency}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>قيد التحصيل مع المناديب</span>
            <span className="text-emerald-600 font-semibold">
              محصّل: {summary.codCollectedAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4">
          <div className="rounded-xl bg-blue-500/10 p-3 text-blue-600 dark:text-blue-400">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">متوسط قيمة الطلب (AOV)</div>
            <div className="text-lg font-bold text-foreground">
              {summary.averageOrderValue.toLocaleString()} {currency}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4">
          <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-600 dark:text-indigo-400">
            <Percent className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">نسبة التكلفة الافتراضية</div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-foreground">
                {(defaultCostRatio * 100).toFixed(0)}%
              </div>
              <button
                onClick={() => {
                  const next = prompt(
                    "أدخل نسبة التكلفة التقديرية (مثلاً 0.60 لـ 60%):",
                    String(defaultCostRatio),
                  );
                  if (next && !isNaN(Number(next))) {
                    setDefaultCostRatio(Math.max(0.1, Math.min(0.95, Number(next))));
                  }
                }}
                className="text-xs text-primary underline"
              >
                تعديل
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4">
          <div className="rounded-xl bg-purple-500/10 p-3 text-purple-600 dark:text-purple-400">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">رسوم التوصيل المحصلة</div>
            <div className="text-lg font-bold text-foreground">
              {summary.deliveryFeesCollected.toLocaleString()} {currency}
            </div>
          </div>
        </div>
      </div>

      {/* Product Profits Breakdown Table */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">أرباح المنتجات وتكاليف الشراء</h2>
            <p className="text-xs text-muted-foreground">
              يمكنك تعيين سعر تكلفة دقيق لكل منتج لحساب الربح بنسبة 100% تطابق دفاتر المحاسبة.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              placeholder="البحث في ربحية المنتجات..."
              className="w-full rounded-xl border border-border bg-background py-1.5 pr-9 pl-3 text-xs outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-border/60 bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">اسم المنتج</th>
                <th className="px-4 py-3 font-semibold text-center">الكمية المباعة</th>
                <th className="px-4 py-3 font-semibold">سعر البيع</th>
                <th className="px-4 py-3 font-semibold">سعر التكلفة</th>
                <th className="px-4 py-3 font-semibold">إجمالي المبيعات</th>
                <th className="px-4 py-3 font-semibold">إجمالي التكلفة</th>
                <th className="px-4 py-3 font-semibold">صافي الربح</th>
                <th className="px-4 py-3 font-semibold text-center">هامش الربح</th>
                <th className="px-4 py-3 font-semibold text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredProductProfits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    لا توجد بيانات مبيعات أو أرباح للفترة المحددة
                  </td>
                </tr>
              ) : (
                filteredProductProfits.map((item) => {
                  const isEditing = editingCostId === item.productId;
                  const hasCustomCost = Boolean(costs[item.productId]);

                  return (
                    <tr key={item.productId} className="transition hover:bg-muted/30">
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="line-clamp-1">{item.productName}</span>
                          {hasCustomCost && (
                            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              تكلفة محددة
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center font-semibold text-foreground">
                        {item.quantitySold}
                      </td>

                      <td className="px-4 py-3.5 text-foreground">
                        {item.unitPrice.toLocaleString()} {currency}
                      </td>

                      <td className="px-4 py-3.5">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editCostVal}
                              onChange={(e) => setEditCostVal(e.target.value)}
                              className="w-20 rounded-lg border border-primary bg-background px-2 py-1 text-xs outline-none"
                              placeholder="سعر التكلفة"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveCost(item.productId)}
                              disabled={savingCost}
                              className="rounded-lg bg-emerald-600 p-1 text-white hover:bg-emerald-700"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className={
                              hasCustomCost
                                ? "font-semibold text-foreground"
                                : "text-muted-foreground"
                            }
                          >
                            {item.unitCost.toLocaleString()} {currency}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-bold text-foreground">
                        {item.totalRevenue.toLocaleString()} {currency}
                      </td>

                      <td className="px-4 py-3.5 text-rose-600 dark:text-rose-400 font-medium">
                        {item.totalCogs.toLocaleString()} {currency}
                      </td>

                      <td className="px-4 py-3.5 font-extrabold text-emerald-600 dark:text-emerald-400">
                        +{item.profit.toLocaleString()} {currency}
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[11px] ${
                            item.marginPercent >= 40
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : item.marginPercent >= 20
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {item.marginPercent.toFixed(1)}%
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleOpenEditCost(item)}
                          className="rounded-lg border border-border p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          title="تعديل سعر التكلفة"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
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
