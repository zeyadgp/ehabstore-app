import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import type { Currency } from "@/lib/currency";

export const Route = createFileRoute("/admin/currencies")({
  head: () => ({
    meta: [{ title: "العملات | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminCurrencies,
});

type Row = {
  id?: string;
  code: string;
  name: string;
  symbol: string;
  rate: string;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
};

function toRow(c: Currency): Row {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    rate: String(c.rate),
    is_active: c.is_active,
    is_default: c.is_default,
    sort_order: c.sort_order,
  };
}

function AdminCurrencies() {
  const qc = useQueryClient();
  const { can, isViewer, isAddOnly } = useAdmin();
  const canAdd = can("add_currencies") && !isViewer;
  const canEdit = can("manage_currencies") && !isViewer && !isAddOnly;
  const canDelete = can("delete_currencies") && !isViewer && !isAddOnly;

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin", "currencies"],
    queryFn: async (): Promise<Currency[]> => {
      const { data, error } = await supabase.from("currencies").select("*").order("sort_order");
      if (error) throw error;
      return ((data as unknown as Currency[]) ?? []).map((c) => ({ ...c, rate: Number(c.rate) }));
    },
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRows(data.map(toRow));
  }, [data]);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "currencies"] });
    await qc.invalidateQueries({ queryKey: ["currencies"] });
    await qc.invalidateQueries({ queryKey: ["product-prices"] });
  };

  const update = (idx: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        code: "",
        name: "",
        symbol: "",
        rate: "1",
        is_active: true,
        is_default: false,
        sort_order: prev.length + 1,
      },
    ]);

  const saveRow = async (row: Row) => {
    if (!row.code.trim() || !row.name.trim() || !row.symbol.trim()) {
      toast.error("الرمز والاسم والرمز المختصر مطلوبة");
      return;
    }
    setBusy(true);
    const payload = {
      code: row.code.trim().toUpperCase(),
      name: row.name.trim(),
      symbol: row.symbol.trim(),
      rate: Number(row.rate || 1),
      is_active: row.is_active,
      is_default: row.is_default,
      sort_order: Number(row.sort_order || 0),
    };
    const { error } = row.id
      ? await supabase.from("currencies").update(payload).eq("id", row.id)
      : await supabase.from("currencies").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حفظ العملة");
    await refresh();
  };

  const makeDefault = async (row: Row) => {
    if (!row.id) {
      toast.error("احفظ العملة أولاً");
      return;
    }
    setBusy(true);
    await supabase.from("currencies").update({ is_default: false }).neq("id", row.id);
    const { error } = await supabase
      .from("currencies")
      .update({ is_default: true, is_active: true, rate: 1 })
      .eq("id", row.id);
    const { data: settings } = await supabase
      .from("store_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (settings?.id) {
      await supabase
        .from("store_settings")
        .update({ currency: row.code.trim().toUpperCase(), currency_label: row.symbol.trim() })
        .eq("id", settings.id);
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تعيين العملة الأساسية (سعرها = 1)");
    await refresh();
    await qc.invalidateQueries({ queryKey: ["settings"] });
    await qc.invalidateQueries({ queryKey: ["admin", "settings"] });
  };

  const remove = async (row: Row) => {
    if (!row.id) {
      setRows((prev) => prev.filter((r) => r !== row));
      return;
    }
    if (row.is_default) {
      toast.error("لا يمكن حذف العملة الأساسية");
      return;
    }
    if (!confirm(`حذف العملة "${row.name}"؟`)) return;
    const { error } = await supabase.from("currencies").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحذف");
    await refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">العملات وأسعار التحويل</h1>
        {canAdd && (
          <button
            onClick={addRow}
            className="ms-auto flex items-center gap-2 rounded-xl gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> عملة جديدة
          </button>
        )}
      </div>

      <p className="rounded-2xl bg-secondary/60 p-4 text-xs leading-6 text-muted-foreground">
        الأسعار تُدخل في المنتجات بالعملة الأساسية، ويتم تحويلها تلقائياً حسب سعر التحويل هنا. سعر
        التحويل = كم وحدة من هذه العملة تساوي وحدة واحدة من العملة الأساسية. يمكنك أيضاً تحديد سعر
        مخصص لأي منتج من صفحة المنتجات.
      </p>

      <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[760px] text-right text-sm">
          <thead className="bg-secondary/60 text-xs">
            <tr>
              <th className="p-3">الرمز</th>
              <th className="p-3">الاسم</th>
              <th className="p-3">الرمز المختصر</th>
              <th className="p-3">سعر التحويل</th>
              <th className="p-3">الترتيب</th>
              <th className="p-3">مفعّلة</th>
              {(canEdit || canDelete) && <th className="p-3">إجراءات</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, idx) => (
              <tr key={row.id ?? `new-${idx}`}>
                <td className="p-2">
                  <input
                    dir="ltr"
                    disabled={!canEdit && !!row.id}
                    className={cls}
                    value={row.code}
                    onChange={(e) => update(idx, { code: e.target.value })}
                  />
                </td>
                <td className="p-2">
                  <input
                    disabled={!canEdit && !!row.id}
                    className={cls}
                    value={row.name}
                    onChange={(e) => update(idx, { name: e.target.value })}
                  />
                </td>
                <td className="p-2">
                  <input
                    disabled={!canEdit && !!row.id}
                    className={cls}
                    value={row.symbol}
                    onChange={(e) => update(idx, { symbol: e.target.value })}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    disabled={row.is_default || (!canEdit && !!row.id)}
                    className={cls}
                    value={row.rate}
                    onChange={(e) => update(idx, { rate: e.target.value })}
                  />
                </td>
                <td className="p-2 w-20">
                  <input
                    type="number"
                    disabled={!canEdit && !!row.id}
                    className={cls}
                    value={row.sort_order}
                    onChange={(e) => update(idx, { sort_order: Number(e.target.value) })}
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    disabled={!canEdit && !!row.id}
                    className="h-4 w-4 accent-primary"
                    checked={row.is_active}
                    onChange={(e) => update(idx, { is_active: e.target.checked })}
                  />
                </td>
                {(canEdit || canDelete) && (
                  <td className="p-2">
                    <div className="flex gap-2">
                      {canEdit && (
                        <button
                          onClick={() => saveRow(row)}
                          disabled={busy}
                          className="rounded-lg bg-secondary p-2 text-primary disabled:opacity-60"
                          title="حفظ"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => makeDefault(row)}
                          disabled={busy || row.is_default}
                          className={`rounded-lg p-2 ${row.is_default ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}
                          title="تعيين كعملة أساسية"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => remove(row)}
                          className="rounded-lg bg-destructive/10 p-2 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-xs text-muted-foreground">
                  جاري التحميل…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary disabled:opacity-60";
