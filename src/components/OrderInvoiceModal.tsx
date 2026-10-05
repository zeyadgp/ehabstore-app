import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, FileText, Printer, Share2, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { formatMoney, useSettings } from "@/lib/store";
import { whatsappLink } from "@/lib/whatsapp";

export type OrderInvoiceData = {
  order_number: number;
  created_at: string;
  customer_name?: string | null;
  phone?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  status?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  subtotal?: number | null;
  delivery_fee?: number | null;
  discount?: number | null;
  total: number;
  currency_label?: string | null;
  items: Array<{
    product_name: string;
    quantity: number;
    price?: number | null;
    color_name?: string | null;
    size_name?: string | null;
  }>;
};

export function OrderInvoiceModal({
  order,
  onClose,
}: {
  order: OrderInvoiceData;
  onClose: () => void;
}) {
  const { data: settings } = useSettings();
  const [copied, setCopied] = useState(false);
  const currency = order.currency_label || settings?.currency_label || "ر.ي";
  const storeName = settings?.store_name ?? "إيهاب ستور للعناية والتجميل";

  const subtotal =
    order.subtotal ??
    order.items.reduce((acc, it) => acc + (Number(it.price) || 0) * it.quantity, 0);
  const deliveryFee = Number(order.delivery_fee || 0);
  const discount = Number(order.discount || 0);
  const total = Number(order.total);

  const handlePrint = () => {
    window.print();
  };

  const copyInvoiceSummary = async () => {
    const textLines = [
      `🧾 فاتورة طلب إلكترونية #${order.order_number}`,
      `متجر: ${storeName}`,
      `التاريخ: ${new Date(order.created_at).toLocaleDateString("ar-EG")}`,
      order.customer_name ? `العميل: ${order.customer_name}` : null,
      order.phone ? `الهاتف: ${order.phone}` : null,
      order.city ? `العنوان: ${order.city} ${order.address || ""}` : null,
      "---",
      "المنتجات:",
      ...order.items.map(
        (it) =>
          `• ${it.product_name}${it.color_name ? ` (لون: ${it.color_name})` : ""}${it.size_name ? ` (مقاس: ${it.size_name})` : ""} ×${it.quantity} = ${it.price ? formatMoney(it.price * it.quantity, currency) : ""}`,
      ),
      "---",
      `الإجمالي: ${formatMoney(total, currency)}`,
      `رابط المتجر والسلة: ${window.location.origin}/cart`,
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(textLines.join("\n"));
      setCopied(true);
      toast.success("تم نسخ تفاصيل الفاتورة بنجاح");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("تعذر نسخ الفاتورة");
    }
  };

  const shareViaWhatsapp = () => {
    const textLines = [
      `*🧾 فاتورة طلب إلكترونية #${order.order_number}*`,
      `*${storeName}*`,
      `التاريخ: ${new Date(order.created_at).toLocaleDateString("ar-EG")}`,
      order.customer_name ? `العميل: ${order.customer_name}` : null,
      order.phone ? `الهاتف: ${order.phone}` : null,
      order.city ? `المدينة: ${order.city}` : null,
      "",
      `*المنتجات:*`,
      ...order.items.map(
        (it, idx) =>
          `${idx + 1}. ${it.product_name}${it.color_name ? ` [لون: ${it.color_name}]` : ""}${it.size_name ? ` [مقاس: ${it.size_name}]` : ""} × ${it.quantity}${it.price ? ` = ${formatMoney(it.price * it.quantity, currency)}` : ""}`,
      ),
      "",
      `*الإجمالي النهائي:* ${formatMoney(total, currency)}`,
      `🛒 رابط السلة: ${window.location.origin}/cart`,
      `🔗 رابط الطلب: ${window.location.origin}/orders?order=${order.order_number}&phone=${encodeURIComponent(order.phone || "")}`,
    ].filter(Boolean);

    const wa = settings?.whatsapp_number || "";
    window.open(whatsappLink(wa, textLines.join("\n")), "_blank");
  };

  return (
    <div
      id="order-invoice-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in-50"
    >
      <div
        id="order-invoice-card"
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8"
      >
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-display text-sm font-extrabold text-foreground sm:text-base">
              فاتورة الطلب الإلكترونية #{order.order_number}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق الفاتورة"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Buttons (Hidden in Print) */}
        <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary hover:text-primary"
          >
            <Printer className="h-4 w-4" /> طباعة الفاتورة
          </button>
          <button
            onClick={copyInvoiceSummary}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary hover:text-primary"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "تم النسخ" : "نسخ الفاتورة"}
          </button>
          <button
            onClick={shareViaWhatsapp}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white shadow-soft transition-transform hover:opacity-95 active:scale-95"
          >
            <Share2 className="h-4 w-4" /> مشاركة عبر واتساب
          </button>
          <Link
            to="/cart"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-secondary/80 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-secondary"
          >
            <ShoppingBag className="h-4 w-4" /> الذهاب للسلة
          </Link>
        </div>

        {/* Printable Invoice Container */}
        <div id="printable-order-invoice" className="mt-6 space-y-6 text-xs text-foreground">
          {/* Header with Store Branding & Logo */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-5">
            <div>
              <BrandMark size="lg" asLink={false} />
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {settings?.about ?? "متجر العناية والتجميل والعطور الأصلية في اليمن"}
              </p>
              {settings?.phone && (
                <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                  هاتف: {settings.phone}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-end">
              <span className="inline-block rounded-full gradient-gold px-3 py-1 text-[11px] font-extrabold text-primary-foreground shadow-2xs">
                فاتورة طلب رسمية
              </span>
              <p className="mt-2 font-display text-lg font-extrabold text-primary">
                #{order.order_number}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {order.payment_method && (
                <p className="mt-1 text-[11px] font-bold text-foreground">
                  الدفع: {order.payment_method}
                </p>
              )}
            </div>
          </div>

          {/* Customer and Delivery Info */}
          {(order.customer_name || order.phone || order.city) && (
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-secondary/30 p-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-bold text-muted-foreground">بيانات المستلم:</p>
                {order.customer_name && (
                  <p className="mt-1 text-sm font-extrabold text-foreground">
                    {order.customer_name}
                  </p>
                )}
                {order.phone && (
                  <p className="mt-0.5 font-medium text-foreground" dir="ltr">
                    {order.phone}
                  </p>
                )}
              </div>
              <div className="sm:text-end">
                <p className="text-[11px] font-bold text-muted-foreground">وجهة التوصيل:</p>
                {order.city && (
                  <p className="mt-1 font-bold text-foreground">
                    {order.city}
                    {order.district ? ` — ${order.district}` : ""}
                  </p>
                )}
                {order.address && <p className="mt-0.5 text-muted-foreground">{order.address}</p>}
              </div>
            </div>
          )}

          {/* Products Table */}
          <div className="overflow-x-auto rounded-2xl border border-border/80">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-border/80 bg-secondary/50 font-bold text-muted-foreground">
                <tr>
                  <th className="p-3">المنتج والخيارات</th>
                  <th className="p-3 text-center">الكمية</th>
                  <th className="p-3 text-center">سعر الوحدة</th>
                  <th className="p-3 text-start">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 bg-card">
                {order.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-secondary/20">
                    <td className="p-3">
                      <p className="font-bold text-foreground">{it.product_name}</p>
                      {(it.color_name || it.size_name) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                          {it.color_name && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/70 px-2 py-0.5 font-bold text-foreground">
                              اللون: <strong>{it.color_name}</strong>
                            </span>
                          )}
                          {it.size_name && (
                            <span className="rounded-md border border-border bg-secondary/70 px-2 py-0.5 font-bold text-foreground">
                              المقاس: {it.size_name}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold tabular-nums text-foreground">
                      {it.quantity}
                    </td>
                    <td className="p-3 text-center tabular-nums text-muted-foreground">
                      {it.price ? formatMoney(Number(it.price), currency) : "—"}
                    </td>
                    <td className="p-3 text-start font-extrabold tabular-nums text-foreground">
                      {it.price ? formatMoney(Number(it.price) * it.quantity, currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pricing Breakdown */}
          <div className="space-y-2 rounded-2xl border border-border bg-secondary/20 p-4">
            {subtotal > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">المجموع الفرعي:</span>
                <span className="font-bold tabular-nums text-foreground">
                  {formatMoney(subtotal, currency)}
                </span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">رسوم الشحن والتوصيل:</span>
                <span className="font-bold tabular-nums text-foreground">
                  {formatMoney(deliveryFee, currency)}
                </span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                <span>خصم الكوبون:</span>
                <span className="font-bold tabular-nums">- {formatMoney(discount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border/80 pt-2 text-sm font-extrabold">
              <span className="text-foreground">المجموع النهائي المطلوب:</span>
              <span className="font-display tabular-nums text-primary">
                {formatMoney(total, currency)}
              </span>
            </div>
          </div>

          {/* Invoice Footer note */}
          <div className="border-t border-border/60 pt-4 text-center text-[11px] text-muted-foreground">
            <p className="font-bold text-foreground">شكراً لتسوقكِ وثقتكِ بنا 💖</p>
            <p className="mt-0.5">
              لأي استفسار أو تعديل على الطلب، يسعدنا تواصلك عبر واتساب المتجر على الرقم:{" "}
              <span dir="ltr" className="font-bold text-primary">
                {settings?.whatsapp_number ?? "+967 780 187 409"}
              </span>
            </p>
            <div className="mt-3 flex items-center justify-center gap-3 print:hidden">
              <Link
                to="/cart"
                onClick={onClose}
                className="font-bold text-primary underline-offset-4 hover:underline"
              >
                العودة إلى سلة المشتريات
              </Link>
              <span>•</span>
              <Link
                to="/"
                onClick={onClose}
                className="font-bold text-primary underline-offset-4 hover:underline"
              >
                تصفح المتجر الرئيسي
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
