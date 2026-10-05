import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useOrderAlerts } from "@/lib/order-alerts";

/** جرس إشعارات الطلبات الجديدة — داخل لوحة التحكم فقط. */
export function OrderBell() {
  const { unread, count, markRead, markAllRead } = useOrderAlerts();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const openOrder = (id: string) => {
    markRead(id);
    setOpen(false);
    void navigate({ to: "/admin/orders", search: { order: id } });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="إشعارات الطلبات"
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card transition-colors hover:border-primary"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {count > 0 && (
          <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose px-1 text-[11px] font-bold text-primary-foreground">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            aria-label="إغلاق"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute end-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-extrabold">طلبات جديدة ({count})</span>
              {count > 0 && (
                <button onClick={markAllRead} className="text-[11px] font-bold text-primary">
                  تعليم الكل كمقروء
                </button>
              )}
            </div>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto">
              {unread.slice(0, 12).map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => openOrder(o.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right hover:bg-secondary"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold">
                        #{o.order_number} — {o.customer_name}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("ar-EG")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {count === 0 && (
                <li className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                  لا توجد طلبات جديدة
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
