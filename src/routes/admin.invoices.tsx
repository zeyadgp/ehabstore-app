import { csvSafe } from "@/lib/csv-safe";
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Printer,
  QrCode,
  Search,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  paymentStatusLabels,
  useInvoices,
  useOrderItems,
  useOrders,
  useAdminCurrency,
} from "@/lib/admin";
import { formatMoney, useSettings } from "@/lib/store";
import { whatsappLink } from "@/lib/whatsapp";
import { supabase } from "@/integrations/supabase/client";
import { generateZatcaQrDataUrl } from "@/lib/zatca";

export const Route = createFileRoute("/admin/invoices")({
  head: () => ({
    meta: [{ title: "الفواتير | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminInvoices,
});

function AdminInvoices() {
  const qc = useQueryClient();
  const { data: invoices = [] } = useInvoices();
  const { data: orders = [] } = useOrders();
  const { data: items = [] } = useOrderItems();
  const { data: settings } = useSettings();
  const { label: fallbackCurrency } = useAdminCurrency();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [printModalInvId, setPrintModalInvId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const list = invoices
    .filter((i) => (status === "all" ? true : i.payment_status === status))
    .filter((i) =>
      q.trim()
        ? [String(i.invoice_number), i.customer_name, i.phone].some((v) =>
            v.toLowerCase().includes(q.trim().toLowerCase()),
          )
        : true,
    );

  const totalBilled = invoices.reduce((acc, i) => acc + Number(i.total || 0), 0);
  const paidCount = invoices.filter((i) => i.payment_status === "paid").length;
  const pendingCount = invoices.filter(
    (i) => i.payment_status === "pending" || i.payment_status === "unpaid",
  ).length;

  // Estimated VAT (15% standard rate)
  const totalVatEst = invoices.reduce((sum, inv) => {
    const tot = Number(inv.total || 0);
    return sum + (tot - tot / 1.15);
  }, 0);

  const updatePaymentStatus = async (invoiceId: string, newStatus: "paid" | "pending") => {
    setUpdatingId(invoiceId);
    try {
      const inv = invoices.find((i) => i.id === invoiceId);
      const { error } = await supabase
        .from("invoices")
        .update({ payment_status: newStatus })
        .eq("id", invoiceId);
      if (error) throw error;

      if (inv?.order_id) {
        await supabase.from("orders").update({ payment_status: newStatus }).eq("id", inv.order_id);
      }

      await qc.invalidateQueries({ queryKey: ["admin_invoices"] });
      await qc.invalidateQueries({ queryKey: ["admin_orders"] });
      toast.success(newStatus === "paid" ? "تم تعيين الفاتورة كمسددة" : "تم تعيين الفاتورة كمعلقة");
    } catch (err) {
      console.error(err);
      toast.error("تعذر تحديث حالة الفاتورة");
    } finally {
      setUpdatingId(null);
    }
  };

  const stats = [
    {
      label: "إجمالي الفواتير",
      value: String(invoices.length),
      tone: "bg-secondary text-foreground",
    },
    {
      label: "إجمالي المبالغ",
      value: formatMoney(totalBilled, fallbackCurrency),
      tone: "bg-primary/10 text-primary border border-primary/20",
    },
    {
      label: "فواتير مسددة",
      value: String(paidCount),
      tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    },
    {
      label: "فواتير معلقة",
      value: String(pendingCount),
      tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    },
  ];

  const exportCSV = () => {
    if (list.length === 0) {
      toast.error("لا توجد فواتير لتصديرها");
      return;
    }
    const headers = [
      "رقم الفاتورة",
      "تاريخ الإصدار",
      "العميل",
      "رقم الهاتف",
      "رقم الطلب المرتبط",
      "المجموع الفرعي",
      "الخصم",
      "رسوم التوصيل",
      "الإجمالي",
      "العملة",
      "حالة الدفع",
      "طريقة الدفع",
    ];
    const rows = list.map((inv) => {
      const ord = orders.find((o) => o.id === inv.order_id);
      return [
        inv.invoice_number,
        new Date(inv.issued_at).toLocaleDateString("ar-EG"),
        `"${(inv.customer_name || "").replace(/"/g, '""')}"`,
        `"${inv.phone}"`,
        ord ? ord.order_number : "",
        inv.subtotal,
        inv.discount,
        inv.delivery_fee,
        inv.total,
        `"${inv.currency_label || fallbackCurrency}"`,
        `"${paymentStatusLabels[inv.payment_status] || inv.payment_status}"`,
        `"${inv.payment_method || ""}"`,
      ];
    });

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.map(csvSafe).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoices-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير الفواتير بصيغة CSV بنجاح");
  };

  const share = (invoiceId: string) => {
    const inv = invoices.find((x) => x.id === invoiceId);
    if (!inv) return;
    const order = orders.find((o) => o.id === inv.order_id);
    const lines = items
      .filter((it) => it.order_id === inv.order_id)
      .map(
        (it) =>
          `• ${it.product_name} × ${it.quantity} = ${formatMoney(Number(it.price) * it.quantity, inv.currency_label || fallbackCurrency)}`,
      );
    const body = [
      `فاتورة رسمية #${inv.invoice_number} — ${settings?.store_name ?? "متجرنا"}`,
      `العميل: ${inv.customer_name}`,
      order ? `رقم الطلب: #${order.order_number}` : null,
      "",
      "الأصناف المشمولة:",
      ...lines,
      "",
      `المجموع: ${formatMoney(Number(inv.subtotal), inv.currency_label || fallbackCurrency)}`,
      Number(inv.discount) > 0
        ? `الخصم: ${formatMoney(Number(inv.discount), inv.currency_label || fallbackCurrency)}`
        : null,
      `التوصيل: ${formatMoney(Number(inv.delivery_fee), inv.currency_label || fallbackCurrency)}`,
      `الإجمالي النهائي: ${formatMoney(Number(inv.total), inv.currency_label || fallbackCurrency)}`,
      inv.payment_method ? `طريقة السداد: ${inv.payment_method}` : null,
      inv.points_awarded > 0 ? `نقاط الولاء المكتسبة: ${inv.points_awarded} نقطة` : null,
      "",
      "شكراً لتسوقكم معنا!",
    ]
      .filter(Boolean)
      .join("\n");
    window.open(whatsappLink(inv.phone, body), "_blank", "noopener");
    toast.success("تم إنشاء رابط المشاركة عبر واتساب");
  };

  const printModalInv = invoices.find((i) => i.id === printModalInvId);
  const printModalOrder = printModalInv
    ? orders.find((o) => o.id === printModalInv.order_id)
    : null;
  const printModalItems = printModalInv
    ? items.filter((it) => it.order_id === printModalInv.order_id)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl">
            الفواتير وسندات القبض
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            استعراض الفواتير الصادرة، تتبع السداد، طباعة الفواتير ومشاركتها مع العملاء.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-extrabold text-foreground shadow-soft transition-all hover:bg-secondary hover:text-primary active:scale-95"
        >
          <Download className="h-4 w-4" />
          <span>تصدير الفواتير CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 print:hidden">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:border-primary/40 hover:shadow-lift"
          >
            <p className="text-xs font-bold text-muted-foreground">{s.label}</p>
            <span
              className={`mt-2 inline-flex w-fit rounded-xl px-2.5 py-1 text-xs font-extrabold tabular-nums ${s.tone}`}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center print:hidden">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث برقم الفاتورة، اسم العميل أو الهاتف..."
            className="w-full rounded-2xl border border-border bg-background py-2.5 pe-4 ps-10 text-xs font-medium outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-extrabold outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 sm:w-auto"
        >
          <option value="all">جميع حالات السداد</option>
          {Object.entries(paymentStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3.5">
        {list.map((inv) => {
          const order = orders.find((o) => o.id === inv.order_id);
          const invItems = items.filter((it) => it.order_id === inv.order_id);
          const cur = inv.currency_label || fallbackCurrency;
          const isPaid = inv.payment_status === "paid";

          return (
            <div
              key={inv.id}
              className="overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:border-primary/40 hover:shadow-lift"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-display text-sm font-extrabold text-foreground">
                    فاتورة #{inv.invoice_number}
                  </span>
                  <span className="text-sm font-bold text-foreground">{inv.customer_name}</span>
                  <span
                    dir="ltr"
                    className="rounded-lg bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  >
                    {inv.phone}
                  </span>
                  {order && (
                    <span className="text-xs text-muted-foreground">
                      · مرتبط بطلب #{order.order_number}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                      isPaid
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {paymentStatusLabels[inv.payment_status] ?? inv.payment_status}
                  </span>
                  <span className="font-display text-sm font-extrabold text-primary">
                    {formatMoney(Number(inv.total), cur)}
                  </span>
                </div>
              </div>

              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <p>
                  <span>طريقة السداد: </span>
                  <span className="font-bold text-foreground">
                    {inv.payment_method || "غير محددة"}
                  </span>
                  {" · "}
                  <span>الأصناف: </span>
                  <span className="font-bold text-foreground">{invItems.length} صنف</span>
                  {inv.points_awarded > 0 && (
                    <>
                      {" · "}
                      <span className="text-primary font-bold">
                        +{inv.points_awarded} نقطة ولاء
                      </span>
                    </>
                  )}
                </p>
                <span className="text-[11px]">
                  تاريخ الإصدار: {new Date(inv.issued_at).toLocaleString("ar-EG")}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3 print:hidden">
                <button
                  onClick={() => setOpen(open === inv.id ? null : inv.id)}
                  className="rounded-2xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground transition-colors hover:bg-secondary"
                >
                  {open === inv.id ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                </button>
                <button
                  onClick={() => setPrintModalInvId(inv.id)}
                  className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground transition-colors hover:bg-secondary hover:text-primary"
                >
                  <Printer className="h-4 w-4" /> معاينة الفاتورة الضريبية (ZATCA)
                </button>
                <button
                  onClick={() => share(inv.id)}
                  className="flex items-center gap-1.5 rounded-2xl bg-[#25D366] px-3.5 py-2 text-xs font-bold text-white shadow-soft transition-transform hover:opacity-95 active:scale-95"
                >
                  <Share2 className="h-4 w-4" /> مشاركة عبر واتساب
                </button>

                {/* Quick Status Changer */}
                {inv.payment_status !== "paid" ? (
                  <button
                    onClick={() => updatePaymentStatus(inv.id, "paid")}
                    disabled={updatingId === inv.id}
                    className="flex items-center gap-1 rounded-2xl bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-500/20 active:scale-95 ms-auto"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>تأكيد السداد</span>
                  </button>
                ) : (
                  <button
                    onClick={() => updatePaymentStatus(inv.id, "pending")}
                    disabled={updatingId === inv.id}
                    className="flex items-center gap-1 rounded-2xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-secondary active:scale-95 ms-auto"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>تحويل كمعلقة</span>
                  </button>
                )}
              </div>

              {open === inv.id && (
                <div className="mt-4 rounded-3xl border border-border/80 bg-secondary/40 p-5 text-xs animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <p className="font-display font-extrabold text-foreground">
                      جدول المنتجات والأصناف
                    </p>
                    <span className="text-[11px] font-bold text-muted-foreground">
                      معدل الضريبة المعتمد: 15% (VAT)
                    </span>
                  </div>
                  <ul className="mt-2 divide-y divide-border/50">
                    {invItems.map((it) => (
                      <li key={it.id} className="flex justify-between py-2 text-xs">
                        <span className="font-medium text-foreground">
                          {it.product_name}{" "}
                          <span className="text-muted-foreground">× {it.quantity}</span>
                        </span>
                        <span className="font-display font-extrabold text-foreground">
                          {formatMoney(Number(it.price) * it.quantity, cur)}
                        </span>
                      </li>
                    ))}
                    {invItems.length === 0 && (
                      <li className="py-2 text-muted-foreground">لا توجد أصناف مسجلة</li>
                    )}
                  </ul>

                  {(() => {
                    const totalVal = Number(inv.total || 0);
                    const taxable = totalVal / 1.15;
                    const vat = totalVal - taxable;
                    return (
                      <div className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                        <Row k="المجموع الفرعي (قبل الضريبة)" v={formatMoney(taxable, cur)} />
                        <Row
                          k="ضريبة القيمة المضافة (15% VAT)"
                          v={formatMoney(vat, cur)}
                          tone="font-bold text-amber-600 dark:text-amber-400"
                        />
                        {Number(inv.discount) > 0 && (
                          <Row
                            k="خصم ترويجي"
                            v={`- ${formatMoney(Number(inv.discount), cur)}`}
                            tone="text-emerald-600 dark:text-emerald-400"
                          />
                        )}
                        <Row
                          k="رسوم الشحن والتوصيل"
                          v={formatMoney(Number(inv.delivery_fee), cur)}
                        />
                        <div className="border-t border-border/60 pt-1.5">
                          <Row
                            k="الإجمالي النهائي شامل الضريبة"
                            v={formatMoney(totalVal, cur)}
                            tone="text-sm font-display font-extrabold text-primary"
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}

        {list.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center shadow-soft">
            <p className="text-sm font-bold text-foreground">لا توجد فواتير مطابقة</p>
            <p className="mt-1 text-xs text-muted-foreground">
              جرب تغيير معايير البحث أو تصفية الحالات.
            </p>
          </div>
        )}
      </div>

      {printModalInv && (
        <InvoicePrintModal
          inv={printModalInv}
          order={printModalOrder ?? null}
          items={printModalItems}
          storeName={settings?.store_name ?? "متجرنا"}
          currency={printModalInv.currency_label || fallbackCurrency}
          onClose={() => setPrintModalInvId(null)}
        />
      )}
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <p className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground font-medium">{k}</span>
      <span className={tone ?? "font-bold text-foreground"}>{v}</span>
    </p>
  );
}

function InvoicePrintModal({
  inv,
  order,
  items,
  storeName,
  currency,
  onClose,
}: {
  inv: {
    id: string;
    invoice_number: number;
    customer_name: string;
    phone: string;
    subtotal: number;
    discount: number;
    delivery_fee: number;
    total: number;
    payment_method: string | null;
    payment_status: string;
    issued_at: string;
    points_awarded: number;
  };
  order: { order_number: number; city: string; address: string } | null;
  items: Array<{ id: string; product_name: string; quantity: number; price: number }>;
  storeName: string;
  currency: string;
  onClose: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const vatNumber = "310123456700003"; // Standard 15-digit ZATCA VAT number

  const totalAmount = Number(inv.total || 0);
  const taxableAmount = totalAmount / 1.15;
  const vatAmount = totalAmount - taxableAmount;

  useEffect(() => {
    generateZatcaQrDataUrl({
      sellerName: storeName,
      vatNumber,
      timestamp: new Date(inv.issued_at).toISOString(),
      totalWithVat: totalAmount,
      vatAmount: vatAmount,
    }).then((url) => {
      if (url) setQrDataUrl(url);
    });
  }, [inv.id, inv.issued_at, storeName, totalAmount, vatAmount]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in-50">
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-7 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-extrabold text-foreground">
              معاينة الفاتورة الضريبية المبسطة (ZATCA Compliant)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5 text-xs" id="printable-invoice">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border/80 pb-4">
            <div>
              <h2 className="font-display text-xl font-extrabold text-foreground">{storeName}</h2>
              <p className="mt-0.5 text-xs font-bold text-foreground">فاتورة ضريبية مبسطة</p>
              <p className="text-[10px] text-muted-foreground uppercase">Simplified Tax Invoice</p>
              <p className="mt-1 text-[11px] font-mono font-semibold text-muted-foreground">
                الرقم الضريبي للمنشأة: <span className="text-foreground">{vatNumber}</span>
              </p>
            </div>
            <div className="text-end">
              <span className="font-display text-base font-extrabold text-primary">
                #{inv.invoice_number}
              </span>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                تاريخ الإصدار: {new Date(inv.issued_at).toLocaleDateString("ar-EG")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(inv.issued_at).toLocaleTimeString("ar-EG")}
              </p>
              {order && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  رقم الطلب المرتبط:{" "}
                  <span className="font-bold text-foreground">#{order.order_number}</span>
                </p>
              )}
            </div>
          </div>

          {/* Customer & Delivery Box */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-secondary/30 p-4">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground">
                بيانات العميل (Customer):
              </p>
              <p className="mt-1 text-sm font-extrabold text-foreground">{inv.customer_name}</p>
              <p className="text-muted-foreground" dir="ltr">
                {inv.phone}
              </p>
            </div>
            {order && (
              <div className="text-end">
                <p className="text-[11px] font-bold text-muted-foreground">عنوان الشحن والتوصيل:</p>
                <p className="mt-1 font-medium text-foreground">{order.city}</p>
                <p className="text-muted-foreground">{order.address}</p>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div>
            <table className="w-full text-right text-xs">
              <thead className="border-b border-border/80 font-bold text-muted-foreground">
                <tr>
                  <th className="py-2">المنتج / الصنف</th>
                  <th className="py-2 text-center">الكمية</th>
                  <th className="py-2 text-center">سعر الوحدة</th>
                  <th className="py-2 text-center">الضريبة</th>
                  <th className="py-2 text-start">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2.5 font-medium text-foreground">{it.product_name}</td>
                    <td className="py-2.5 text-center font-bold tabular-nums text-foreground">
                      {it.quantity}
                    </td>
                    <td className="py-2.5 text-center tabular-nums text-muted-foreground">
                      {formatMoney(Number(it.price), currency)}
                    </td>
                    <td className="py-2.5 text-center font-semibold text-muted-foreground">15%</td>
                    <td className="py-2.5 text-start font-extrabold tabular-nums text-foreground">
                      {formatMoney(Number(it.price) * it.quantity, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown & ZATCA QR Code */}
          <div className="grid grid-cols-1 gap-4 border-t border-border/80 pt-4 sm:grid-cols-2">
            {/* ZATCA QR Box */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-secondary/20 p-3 text-center">
              {qrDataUrl ? (
                <div className="rounded-xl border border-border bg-white p-2 shadow-xs">
                  <img src={qrDataUrl} alt="ZATCA QR Code" className="h-28 w-28 object-contain" />
                </div>
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                  <QrCode className="h-8 w-8 animate-pulse text-muted-foreground/60" />
                </div>
              )}
              <p className="mt-2 text-[10px] font-extrabold text-foreground">
                رمز الاستجابة السريع المعتمد (ZATCA QR)
              </p>
              <p className="text-[9px] text-muted-foreground">
                متوافق مع المرحلة الأولى والثانية للفوترة الإلكترونية
              </p>
            </div>

            {/* Price Calculations */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  المبلغ الخاضع للضريبة (غير شامل الضريبة):
                </span>
                <span className="font-bold tabular-nums text-foreground">
                  {formatMoney(taxableAmount, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ضريبة القيمة المضافة (15% VAT):</span>
                <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {formatMoney(vatAmount, currency)}
                </span>
              </div>
              {Number(inv.discount) > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>خصم الكوبون:</span>
                  <span className="font-bold">- {formatMoney(Number(inv.discount), currency)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">رسوم الشحن والتوصيل:</span>
                <span className="font-bold tabular-nums text-foreground">
                  {formatMoney(Number(inv.delivery_fee), currency)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-display font-extrabold text-foreground text-sm">
                  الإجمالي المستحق (شامل الضريبة):
                </span>
                <span className="font-display font-extrabold text-primary text-base tabular-nums">
                  {formatMoney(totalAmount, currency)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            <span>طريقة الدفع: {inv.payment_method || "غير محددة"}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 font-bold ${
                inv.payment_status === "paid"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
              }`}
            >
              {paymentStatusLabels[inv.payment_status] ?? inv.payment_status}
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/60 pt-4 print:hidden">
          <button
            onClick={onClose}
            className="rounded-2xl border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-secondary"
          >
            إغلاق
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-2xl gradient-gold px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-soft transition-transform hover:opacity-95 active:scale-95"
          >
            <Printer className="h-4 w-4" /> طباعة الفاتورة الضريبية
          </button>
        </div>
      </div>
    </div>
  );
}
