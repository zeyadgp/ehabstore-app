import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ShoppingCart,
  Phone,
  MessageCircle,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Percent,
  Search,
  Plus,
  Trash2,
  Send,
  Ticket,
  MapPin,
  Package,
  Download,
  Upload,
} from "lucide-react";
import { useAbandonedCarts, AbandonedCart } from "@/lib/abandoned-carts";
import { useAdminCurrency } from "@/lib/admin";

export const Route = createFileRoute("/admin/abandoned-carts")({
  component: AdminAbandonedCartsPage,
});

function AdminAbandonedCartsPage() {
  const { carts, saveCarts, isSaving, isLoading } = useAbandonedCarts();
  const { label: currency } = useAdminCurrency();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);
  const [couponCode, setCouponCode] = useState("EHAB10");

  const handleUpdateStatus = async (
    cartId: string,
    newStatus: AbandonedCart["status"],
    note?: string,
  ) => {
    try {
      const updated = carts.map((c) =>
        c.id === cartId
          ? {
              ...c,
              status: newStatus,
              contacted_at:
                newStatus === "contacted" || newStatus === "recovered"
                  ? new Date().toISOString()
                  : c.contacted_at,
              notes: note !== undefined ? note : c.notes,
            }
          : c,
      );
      await saveCarts(updated);
      toast.success("تم تحديث حالة السلة بنجاح");
    } catch {
      toast.error("تعذر تحديث الحالة");
    }
  };

  const handleDeleteCart = async (cartId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه السلة من السجل؟")) return;
    try {
      const updated = carts.filter((c) => c.id !== cartId);
      await saveCarts(updated);
      toast.success("تم حذف السلة");
    } catch {
      toast.error("تعذر الحذف");
    }
  };

  // KPIs
  const totalValueLost = carts.reduce((acc, c) => acc + Number(c.total || 0), 0);
  const recoveredCarts = carts.filter((c) => c.status === "recovered");
  const recoveredValue = recoveredCarts.reduce((acc, c) => acc + Number(c.total || 0), 0);
  const recoveryRate = carts.length > 0 ? (recoveredCarts.length / carts.length) * 100 : 0;
  const pendingCount = carts.filter((c) => c.status === "pending").length;

  const filteredCarts = carts.filter((c) => {
    const matchesSearch =
      c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.city && c.city.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const generateWhatsappMessage = (cart: AbandonedCart) => {
    const itemsList = cart.items.map((i) => `• ${i.name} (عدد ${i.quantity})`).join("\n");
    return `مرحباً أختي/أخي ${cart.customer_name} 🌸\n\nنود تذكيرك بأنك تركت بعض المنتجات الرائعة في سلة التسوق بمتجر إيهاب ستور:\n${itemsList}\n\nالإجمالي: ${cart.total} ${currency}\n\nولأننا نسعد بخدمتك، أرفقنا لك كود خصم خاص (${couponCode}) بنسبة 10% أو توصيل مخفض لإتمام طلبك الآن:\nhttps://ais-pre-vxmnjzuqffsyakvks4mjal-651022724053.europe-west1.run.app/cart\n\nإذا كنت بحاجة لأي استشارة بخصوص المنتجات، نحن هنا لمساعدتك دائماً!`;
  };

  const handleSendWhatsapp = (cart: AbandonedCart) => {
    const msg = generateWhatsappMessage(cart);
    const cleanPhone = cart.phone.replace(/[^0-9]/g, "");
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;

    window.open(url, "_blank");
    handleUpdateStatus(cart.id, "contacted");
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportCarts = () => {
    try {
      const dataStr = JSON.stringify(carts, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `abandoned-carts-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير سجلات السلات المتروكة بنجاح");
    } catch {
      toast.error("تعذر تصدير البيانات");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed))
        throw new Error("ملف غير صالح، يجب أن يحتوي على مصفوفة سلات متروكة");

      const existingIds = new Set(carts.map((c) => c.id));
      const newItems = parsed.filter((c) => !existingIds.has(c.id));
      const merged = [...carts, ...newItems];

      await saveCarts(merged);
      toast.success(`تم استيراد ${newItems.length} سلة متروكة بنجاح`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل استيراد الملف");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hidden Import Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              استرجاع السلات المتروكة
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            استرجع العملاء الذين بدأوا الشراء ولم يكملوا الطلب عبر رسائل واتساب الذكية وأكواد الخصم.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-xs">
            <Ticket className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">كود الخصم:</span>
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="w-20 font-bold text-foreground outline-none text-center bg-muted/40 rounded px-1"
            />
          </div>

          <button
            onClick={exportCarts}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-xs hover:bg-muted/80 transition"
          >
            <Download className="h-3.5 w-3.5" />
            تصدير
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-xs hover:bg-muted/80 transition"
          >
            <Upload className="h-3.5 w-3.5" />
            استيراد
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              إجمالي السلات المتروكة
            </span>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3 text-2xl font-extrabold text-foreground">{carts.length}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {pendingCount} سلة تحتاج للتواصل الفوري
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              القيمة المعلقة والضائعة
            </span>
            <DollarSign className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-3 text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {totalValueLost.toLocaleString()} {currency}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">فرصة مبيعات إضافية قابلة للاسترجاع</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/40 p-5 shadow-xs dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              المبيعات المسترجعة
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {recoveredValue.toLocaleString()} {currency}
          </div>
          <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            تم استرجاع {recoveredCarts.length} طلبات بنجاح
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">معدل الاسترجاع</span>
            <Percent className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-3 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
            {recoveryRate.toFixed(1)}%
          </div>
          <p className="mt-1 text-xs text-muted-foreground">متوسط استجابة عملاء الواتساب</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="البحث باسم العميل، الهاتف، أو المدينة..."
            className="w-full rounded-xl border border-border bg-background py-2 pr-9 pl-4 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "الكل" },
            { id: "pending", label: "معلقة" },
            { id: "contacted", label: "تم التواصل" },
            { id: "recovered", label: "تم الاسترجاع" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition shrink-0 ${
                filterStatus === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Carts List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          جارٍ تحميل السلات المتروكة...
        </div>
      ) : filteredCarts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-semibold text-foreground">
            لا توجد سلات متروكة في هذا التصنيف
          </p>
          <p className="text-xs text-muted-foreground">
            تظهر هنا السلات التي يتم إدخال بيانات العملاء فيها ولم يكتمل الدفع.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCarts.map((cart) => {
            const timeAgo = Math.round(
              (Date.now() - new Date(cart.created_at).getTime()) / (1000 * 60 * 60),
            );

            return (
              <div
                key={cart.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition hover:border-primary/50 lg:flex-row lg:items-center"
              >
                {/* Customer info and products */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        cart.status === "recovered"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : cart.status === "contacted"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {cart.status === "recovered"
                        ? "تم الاسترجاع بنجاح"
                        : cart.status === "contacted"
                          ? "تم التواصل مع العميل"
                          : "بانتظار التواصل"}
                    </span>

                    <h3 className="font-bold text-foreground text-sm">{cart.customer_name}</h3>

                    <div
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                      dir="ltr"
                    >
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      <span>{cart.phone}</span>
                    </div>

                    {cart.city && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{cart.city}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>منذ {timeAgo} ساعة</span>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {cart.items.map((it, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-lg bg-muted/60 px-2.5 py-1 text-xs text-foreground"
                      >
                        <Package className="h-3 w-3 text-muted-foreground" />
                        {it.name} <span className="text-primary font-bold">×{it.quantity}</span>
                      </span>
                    ))}
                  </div>

                  {cart.notes && (
                    <p className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded-lg">
                      ملاحظة: {cart.notes}
                    </p>
                  )}
                </div>

                {/* Price and actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border/60 pt-3 lg:border-t-0 lg:pt-0 shrink-0">
                  <div className="text-right sm:text-left">
                    <span className="text-[11px] text-muted-foreground">قيمة السلة</span>
                    <div className="text-lg font-black text-foreground">
                      {cart.total.toLocaleString()} {currency}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSendWhatsapp(cart)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      مراسلة عبر واتساب
                    </button>

                    <select
                      value={cart.status}
                      onChange={(e) =>
                        handleUpdateStatus(cart.id, e.target.value as AbandonedCart["status"])
                      }
                      className="rounded-xl border border-border bg-background px-2.5 py-2 text-xs font-medium text-foreground outline-none"
                    >
                      <option value="pending">معلقة</option>
                      <option value="contacted">تم التواصل</option>
                      <option value="recovered">مسترجعة</option>
                      <option value="ignored">تجاهل</option>
                    </select>

                    <button
                      onClick={() => handleDeleteCart(cart.id)}
                      className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="حذف السلة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
