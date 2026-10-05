import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Coupon = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  points_spent: number;
  status: string;
  expires_at: string | null;
  created_at: string;
  loyalty_accounts: { phone: string; customer_name: string | null } | null;
};

const STATUS: Record<string, string> = {
  active: "فعّال",
  used: "مستخدم",
  expired: "منتهي",
  cancelled: "ملغي",
};

function useCoupons() {
  return useQuery({
    queryKey: ["admin", "loyalty-coupons"],
    queryFn: async (): Promise<Coupon[]> => {
      const { data, error } = await supabase
        .from("loyalty_coupons")
        .select(
          "id, code, discount_type, discount_value, points_spent, status, expires_at, created_at, loyalty_accounts(phone, customer_name)",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data as unknown as Coupon[]) ?? [];
    },
  });
}

/** إدارة كوبونات الولاء: بحث، نسخ، إلغاء، حذف. */
export function CouponsManager() {
  const qc = useQueryClient();
  const { data: coupons = [] } = useCoupons();
  const [q, setQ] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "loyalty-coupons"] });

  const cancel = async (c: Coupon) => {
    const { error } = await supabase
      .from("loyalty_coupons")
      .update({ status: "cancelled" })
      .eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم إلغاء الكوبون");
    await refresh();
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`حذف الكوبون ${c.code}؟`)) return;
    const { error } = await supabase.from("loyalty_coupons").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحذف");
    await refresh();
  };

  const term = q.trim().toLowerCase();
  const rows = term
    ? coupons.filter(
        (c) =>
          c.code.toLowerCase().includes(term) ||
          (c.loyalty_accounts?.phone ?? "").includes(term) ||
          (c.loyalty_accounts?.customer_name ?? "").toLowerCase().includes(term),
      )
    : coupons;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-bold">الكوبونات</h2>
        <span className="text-xs text-muted-foreground">{rows.length} كوبون</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالكود أو رقم العميل"
          className="ms-auto w-56 rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
        />
      </div>

      <ul className="mt-3 divide-y divide-border text-sm">
        {rows.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
            <span dir="ltr" className="rounded-lg bg-secondary px-2 py-1 text-xs font-extrabold">
              {c.code}
            </span>
            <span className="text-xs text-muted-foreground">
              {c.loyalty_accounts?.customer_name ?? "عميل"} ·{" "}
              <span dir="ltr">{c.loyalty_accounts?.phone ?? "—"}</span>
            </span>
            <span className="text-xs">
              خصم {Number(c.discount_value)}
              {c.discount_type === "percent" ? "%" : ""} · {c.points_spent} نقطة
            </span>
            <span className="text-[11px] text-muted-foreground">
              {STATUS[c.status] ?? c.status}
              {c.expires_at ? ` · ينتهي ${new Date(c.expires_at).toLocaleDateString("ar")}` : ""}
            </span>
            <div className="ms-auto flex items-center gap-1">
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(c.code);
                  toast.success("تم نسخ الكود");
                }}
                title="نسخ"
                className="rounded-lg bg-secondary p-2"
              >
                <Copy className="h-4 w-4" />
              </button>
              {c.status === "active" && (
                <button
                  onClick={() => void cancel(c)}
                  title="إلغاء"
                  className="rounded-lg bg-secondary p-2 text-primary"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => void remove(c)}
                title="حذف"
                className="rounded-lg bg-destructive/10 p-2 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-4 text-center text-xs text-muted-foreground">لا توجد كوبونات</li>
        )}
      </ul>
    </section>
  );
}
