import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Download,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAllProducts, useAdminCurrency } from "@/lib/admin";
import { formatMoney } from "@/lib/store";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({
    meta: [{ title: "إدارة المخزون | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminInventory,
});

type FilterTab = "all" | "low" | "out" | "available";

function AdminInventory() {
  const qc = useQueryClient();
  const { data: products = [] } = useAllProducts();
  const { label } = useAdminCurrency();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const setStock = async (id: string, stock: number) => {
    const nextStock = Math.max(0, stock);
    setUpdatingId(id);
    const { error } = await supabase.from("products").update({ stock: nextStock }).eq("id", id);
    setUpdatingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["admin", "products"] });
    await qc.invalidateQueries({ queryKey: ["products"] });
    toast.success("تم تحديث المخزون بنجاح");
  };

  const adjustStock = (id: string, current: number, delta: number) => {
    void setStock(id, current + delta);
  };

  const LOW_THRESHOLD = 5;

  const totalStock = products.reduce((s, p) => s + (p.stock || 0), 0);
  const outOfStock = products.filter((p) => p.stock === 0).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= LOW_THRESHOLD).length;
  const inStock = products.filter((p) => p.stock > LOW_THRESHOLD).length;

  const inventoryValue = products.reduce(
    (s, p) =>
      s +
      (p.stock || 0) *
        Number(p.discount_price && p.discount_price > 0 ? p.discount_price : p.price),
    0,
  );

  const list = products
    .filter((p) => {
      if (tab === "low") return p.stock > 0 && p.stock <= LOW_THRESHOLD;
      if (tab === "out") return p.stock === 0;
      if (tab === "available") return p.stock > LOW_THRESHOLD;
      return true;
    })
    .filter((p) => (q ? p.name.toLowerCase().includes(q.toLowerCase()) : true));

  const exportCSV = () => {
    if (products.length === 0) {
      toast.error("لا توجد منتجات لتصديرها");
      return;
    }
    const headers = ["معرف المنتج", "اسم المنتج", "الكمية بالمخزون", "السعر", "حالة المخزون"];
    const rows = products.map((p) => {
      const status = p.stock === 0 ? "نفد" : p.stock <= LOW_THRESHOLD ? "منخفض" : "متوفر";
      return [
        `"${p.id}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        p.stock,
        p.discount_price && p.discount_price > 0 ? p.discount_price : p.price,
        `"${status}"`,
      ];
    });
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير تقرير المخزون (CSV) بنجاح");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl">
            إدارة المخزون والتنبيهات
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            تتبع كميات المنتجات، ضبط المخزون بضغطة زر، وتنبيهات فورية بالمنتجات على وشك النفاد.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-extrabold text-foreground shadow-soft transition-all hover:bg-secondary hover:text-primary active:scale-95"
        >
          <Download className="h-4 w-4" />
          <span>تصدير تقرير المخزون CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard
          icon={Boxes}
          label="إجمالي القطع المتوفرة"
          value={String(totalStock)}
          tone="bg-secondary text-foreground"
        />
        <StatCard
          icon={CheckCircle2}
          label="منتجات مكتفية"
          value={String(inStock)}
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
        />
        <StatCard
          icon={AlertTriangle}
          label="مخزون منخفض (≤ 5)"
          value={String(lowStock)}
          tone="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
        />
        <StatCard
          icon={XCircle}
          label="منتجات نفدت (0)"
          value={String(outOfStock)}
          tone="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث باسم المنتج في المخزون..."
            className="w-full rounded-2xl border border-border bg-background py-2.5 pe-4 ps-10 text-xs font-medium outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card p-1 shadow-soft">
          <TabButton
            active={tab === "all"}
            onClick={() => setTab("all")}
            label="الكل"
            count={products.length}
          />
          <TabButton
            active={tab === "low"}
            onClick={() => setTab("low")}
            label="منخفض (≤ 5)"
            count={lowStock}
            alert={lowStock > 0}
          />
          <TabButton
            active={tab === "out"}
            onClick={() => setTab("out")}
            label="نفد (0)"
            count={outOfStock}
            alert={outOfStock > 0}
          />
          <TabButton
            active={tab === "available"}
            onClick={() => setTab("available")}
            label="متوفر"
            count={inStock}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div className="border-b border-border/60 bg-muted/30 px-6 py-3.5">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" /> قائمة أصناف المخزون ({list.length})
            </span>
            <span>قيمة المخزون الكلية: {formatMoney(inventoryValue, label)}</span>
          </div>
        </div>

        <ul className="divide-y divide-border/60">
          {list.map((p) => {
            const isZero = p.stock === 0;
            const isLow = p.stock > 0 && p.stock <= LOW_THRESHOLD;
            const unitPrice = Number(
              p.discount_price && p.discount_price > 0 ? p.discount_price : p.price,
            );

            return (
              <li
                key={p.id}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  {p.images?.[0] ? (
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="h-11 w-11 shrink-0 rounded-2xl border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary text-muted-foreground">
                      <Boxes className="h-5 w-5 text-primary" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <Link
                      to="/product/$slug"
                      params={{ slug: p.slug }}
                      className="truncate font-bold text-foreground transition-colors hover:text-primary"
                    >
                      {p.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>سعر الوحدة: {formatMoney(unitPrice, label)}</span>
                      <span>·</span>
                      <span>القيمة الإجمالية: {formatMoney(unitPrice * p.stock, label)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                      isZero
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        : isLow
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {isZero ? (
                      <>
                        <XCircle className="h-3 w-3" /> نفد من المخزون
                      </>
                    ) : isLow ? (
                      <>
                        <AlertTriangle className="h-3 w-3" /> مخزون حرج ({p.stock})
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> متوفر
                      </>
                    )}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={p.stock <= 0 || updatingId === p.id}
                      onClick={() => adjustStock(p.id, p.stock, -1)}
                      title="إنقاص قطعة واحدة"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-all hover:bg-secondary active:scale-95 disabled:opacity-40"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>

                    <input
                      type="number"
                      min={0}
                      key={p.stock}
                      defaultValue={String(p.stock)}
                      disabled={updatingId === p.id}
                      onBlur={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        if (val !== p.stock) {
                          void setStock(p.id, val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                      className="h-8 w-16 rounded-xl border border-border bg-background px-2 text-center text-xs font-extrabold text-foreground outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                    />

                    <button
                      type="button"
                      disabled={updatingId === p.id}
                      onClick={() => adjustStock(p.id, p.stock, 1)}
                      title="زيادة قطعة واحدة"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-all hover:bg-secondary active:scale-95"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}

          {list.length === 0 && (
            <li className="p-12 text-center text-xs text-muted-foreground">
              لا توجد منتجات مطابقة لهذا الفلتر أو البحث.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  alert,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  alert?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
        active
          ? "gradient-gold text-primary-foreground shadow-soft"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
          active
            ? "bg-black/20 text-white"
            : alert
              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-4 shadow-soft transition-all hover:border-primary/40 hover:shadow-lift">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <span
        className={`mt-2.5 inline-flex w-fit rounded-xl px-2.5 py-1 text-xs font-extrabold tabular-nums ${tone}`}
      >
        {value}
      </span>
    </div>
  );
}
