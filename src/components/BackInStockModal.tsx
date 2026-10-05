import { useState } from "react";
import { Bell, Check, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { whatsappLink } from "@/lib/whatsapp";
import { useSettings } from "@/lib/store";

interface BackInStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    slug: string;
    sku?: string | null;
  };
  colorName?: string | null;
  sizeName?: string | null;
}

export function BackInStockModal({
  isOpen,
  onClose,
  product,
  colorName,
  sizeName,
}: BackInStockModalProps) {
  const { data: settings } = useSettings();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone.trim()) {
      toast.error("يرجى إدخال رقم الهاتف أو الواتساب");
      return;
    }

    const currentUrl =
      typeof window !== "undefined"
        ? window.location.href
        : `https://ehabstore.app/product/${product.slug}`;
    const variantParts = [];
    if (colorName) variantParts.push(`اللون: ${colorName}`);
    if (sizeName) variantParts.push(`المقاس: ${sizeName}`);
    const variantStr = variantParts.length > 0 ? ` (${variantParts.join(" - ")})` : "";

    const messageLines = [
      `🔔 *طلب إشعار توفر منتج (Back in Stock)*`,
      `السلام عليكم متجر ${settings?.store_name ?? "إيهاب ستور"}، أود إشعاري فور توفر هذا المنتج مجدداً:`,
      ``,
      `▫️ *المنتج:* ${product.name}${variantStr}`,
      product.sku ? `▫️ *كود المنتج (SKU):* ${product.sku}` : null,
      `▫️ *رابط المنتج:* ${currentUrl}`,
      customerName.trim() ? `▫️ *اسم العميل:* ${customerName.trim()}` : null,
      `▫️ *رقم التواصل:* ${customerPhone.trim()}`,
      ``,
      `شكراً لكم وفي انتظار إشعار التوفر! ✨`,
    ].filter(Boolean) as string[];

    const waNumber = settings?.whatsapp_number ?? "967770000000";
    const link = whatsappLink(waNumber, messageLines.join("\n"));

    setSubmitted(true);
    toast.success("تم تسجيل طلبك! سيتم إشعارك فور توفر كمية جديدة.");
    window.open(link, "_blank", "noopener");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق النافذة"
          className="absolute top-4 end-4 flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-black text-foreground">
              أبلغني عند توفر المنتج
            </h3>
            <p className="text-xs text-muted-foreground">
              المنتج غير متوفر حالياً، سجّل بياناتك لنخطرك فور وصول شحنة جديدة
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border/80 bg-muted/30 p-3 text-xs">
          <p className="font-bold text-foreground">{product.name}</p>
          {(colorName || sizeName) && (
            <p className="mt-1 text-muted-foreground">
              {colorName ? `اللون: ${colorName}` : ""}
              {colorName && sizeName ? " • " : ""}
              {sizeName ? `المقاس: ${sizeName}` : ""}
            </p>
          )}
        </div>

        {submitted ? (
          <div className="mt-6 text-center py-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <Check className="h-7 w-7" />
            </div>
            <h4 className="mt-3 font-display text-base font-bold text-foreground">
              تم تسجيل طلب الإشعار بنجاح!
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              تم تحويلك إلى واتساب لحفظ طلب التنبيه المباشر لدى فريق خدمة العملاء.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-2xl border border-border bg-secondary py-3 text-xs font-bold text-foreground transition-colors hover:bg-secondary/80"
            >
              تم وإغلاق
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="notify-name" className="block text-xs font-bold text-foreground">
                الاسم (اختياري)
              </label>
              <input
                id="notify-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="مثال: محمد أحمد"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground shadow-2xs transition-all focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="notify-phone" className="block text-xs font-bold text-foreground">
                رقم الهاتف / الواتساب <span className="text-destructive">*</span>
              </label>
              <input
                id="notify-phone"
                type="tel"
                required
                dir="ltr"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="770000000"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground text-left shadow-2xs transition-all focus:border-primary focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-xs font-extrabold text-white shadow-soft transition-all hover:bg-emerald-700 active:scale-98"
            >
              <MessageCircle className="h-4 w-4" />
              <span>تسجيل وتأكيد الإشعار عبر واتساب</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
