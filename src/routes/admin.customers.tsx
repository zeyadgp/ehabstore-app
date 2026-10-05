import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  MessageCircle,
  Search,
  Users,
  ShoppingBag,
  DollarSign,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useOrders, useAdminCurrency } from "@/lib/admin";
import { formatMoney } from "@/lib/store";
import { whatsappLink } from "@/lib/whatsapp";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [{ title: "العملاء | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminCustomers,
});

function AdminCustomers() {
  const { data: orders = [] } = useOrders();
  const { label } = useAdminCurrency();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const map = new Map<
    string,
    { name: string; phone: string; city: string; count: number; total: number; last: string }
  >();
  orders.forEach((o) => {
    const key = o.phone;
    const prev = map.get(key);
    map.set(key, {
      name: o.customer_name,
      phone: o.phone,
      city: o.city,
      count: (prev?.count ?? 0) + 1,
      total: (prev?.total ?? 0) + Number(o.total),
      last: prev?.last && prev.last > o.created_at ? prev.last : o.created_at,
    });
  });
  const allCustomers = [...map.values()].sort((a, b) => b.total - a.total);
  const totalRevenue = allCustomers.reduce((sum, c) => sum + c.total, 0);
  const totalOrders = allCustomers.reduce((sum, c) => sum + c.count, 0);

  const term = debouncedQ.trim().toLowerCase();
  const customers = allCustomers.filter(
    (c) =>
      !term ||
      c.name.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      c.city.toLowerCase().includes(term),
  );

  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(customers.length / pageSize));
  const pagedCustomers = customers.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-6">
      <div className="border-b border-border/60 pb-4">
        <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl">
          إدارة العملاء
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          سجل العملاء التراكمي، إجمالي المشتريات، وتاريخ آخر طلب مع إمكانية التواصل الفوري عبر
          واتساب.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-foreground">إجمالي العملاء</p>
            <p className="font-display text-lg font-extrabold text-foreground tabular-nums">
              {allCustomers.length} عميل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-foreground">إجمالي الطلبات المسجلة</p>
            <p className="font-display text-lg font-extrabold text-foreground tabular-nums">
              {totalOrders} طلب
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-foreground">إجمالي مشتريات العملاء</p>
            <p className="font-display text-lg font-extrabold text-foreground tabular-nums">
              {formatMoney(totalRevenue, label)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالاسم، رقم الهاتف أو المدينة..."
          className="w-full rounded-2xl border border-border bg-background py-2.5 pe-4 ps-10 text-xs font-medium outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[680px] text-right text-xs">
          <thead className="border-b border-border/60 bg-secondary/50 font-extrabold text-muted-foreground">
            <tr>
              <th className="p-3.5">العميل</th>
              <th className="p-3.5">رقم الهاتف</th>
              <th className="p-3.5">المدينة</th>
              <th className="p-3.5 text-center">عدد الطلبات</th>
              <th className="p-3.5">إجمالي الشراء</th>
              <th className="p-3.5">آخر طلب</th>
              <th className="p-3.5 text-center">واتساب</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {pagedCustomers.map((c) => {
              const initials = c.name.trim().slice(0, 2);
              return (
                <tr key={c.phone} className="transition-colors hover:bg-secondary/30">
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary font-extrabold text-primary text-[11px] shadow-soft">
                        {initials}
                      </span>
                      <span className="font-extrabold text-foreground">{c.name}</span>
                    </div>
                  </td>
                  <td className="p-3.5 font-medium text-muted-foreground" dir="ltr">
                    {c.phone}
                  </td>
                  <td className="p-3.5 text-muted-foreground">{c.city}</td>
                  <td className="p-3.5 text-center">
                    <span className="inline-flex rounded-lg bg-secondary px-2.5 py-0.5 font-extrabold text-primary tabular-nums">
                      {c.count}
                    </span>
                  </td>
                  <td className="p-3.5 font-display font-extrabold text-foreground">
                    {formatMoney(c.total, label)}
                  </td>
                  <td className="p-3.5 text-[11px] text-muted-foreground">
                    {new Date(c.last).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="p-3.5 text-center">
                    <a
                      href={whatsappLink(c.phone, `مرحباً ${c.name} 🌸`)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`تواصل مع ${c.name} عبر واتساب`}
                      className="inline-flex items-center justify-center rounded-xl bg-[#25D366] p-2 text-white shadow-soft transition-transform hover:opacity-95 active:scale-95"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center text-xs text-muted-foreground">
                  لا توجد سجلات عملاء مطابقة للبحث
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* شريط ترقيم الصفحات (Pagination Controls) */}
      {customers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xs text-xs">
          <div className="text-muted-foreground font-medium">
            الصفحة <span className="font-bold text-foreground">{page + 1}</span> من{" "}
            <span className="font-bold text-foreground">{totalPages}</span>{" "}
            <span className="text-[11px] text-muted-foreground">
              ({customers.length} عميل إجمالاً)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>السابق</span>
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none"
            >
              <span>التالي</span>
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
