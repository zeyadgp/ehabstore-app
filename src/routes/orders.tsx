import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FileText,
  Home,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  PackageCheck,
  PackageSearch,
  Phone,
  RefreshCw,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { myOrders, trackOrder, type MyOrder, type TrackedOrder } from "@/lib/account.functions";
import { useCustomerProfile, useSessionUser } from "@/lib/account";
import { formatMoney, useSettings } from "@/lib/store";
import { whatsappLink } from "@/lib/whatsapp";
import { deliveryNote, toWesternDigits } from "@/lib/yemen";
import { OrderInvoiceModal, type OrderInvoiceData } from "@/components/OrderInvoiceModal";
import OrderTrackingMap from "@/components/OrderTrackingMap";

const title = "متابعة الطلبات | إيهاب ستور للعناية والتجميل";
const description =
  "تابع مسار شحنتك لحظة بلحظة على الخريطة التفاعلية: التأكيد، التجهيز، الشحن، والتسليم مع عرض الفاتورة الرسمية.";

type OrderSearchParams = {
  order?: string | undefined;
  phone?: string | undefined;
};

export const Route = createFileRoute("/orders")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): OrderSearchParams => ({
    order: typeof search["order"] === "string" ? search["order"] : undefined,
    phone: typeof search["phone"] === "string" ? search["phone"] : undefined,
  }),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:image", content: "https://www.ehabstore.app/icon-512.png" },
      { name: "twitter:image", content: "https://www.ehabstore.app/icon-512.png" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app/orders" }],
  }),
  component: OrdersPage,
});

const STATUS_MAP: Record<
  string,
  { label: string; badgeClass: string; step: number; statusText: string }
> = {
  new: {
    label: "قيد المراجعة",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    step: 0,
    statusText: "تم استلام طلبك وبانتظار التأكيد",
  },
  reviewing: {
    label: "قيد المراجعة",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    step: 0,
    statusText: "يتم تدقيق بيانات الطلب والتواصل معك",
  },
  confirmed: {
    label: "تم التأكيد",
    badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    step: 1,
    statusText: "تم تأكيد طلبك وجاري إدراجه للشحن",
  },
  processing: {
    label: "قيد التجهيز",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    step: 1,
    statusText: "جاري تغليف وتجهيز المنتجات بالمستودع",
  },
  ready: {
    label: "جاهز للتسليم",
    badgeClass: "bg-teal-500/20 text-teal-300 border-teal-500/40",
    step: 1,
    statusText: "الشحنة جاهزة بانتظار مندوب التوصيل",
  },
  shipped: {
    label: "خارج للتوصيل",
    badgeClass:
      "bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.5)]",
    step: 2,
    statusText: "جاري توصيل طلبك الآن حتى باب منزلك",
  },
  delivered: {
    label: "تم التسليم",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    step: 3,
    statusText: "تم تسليم الطلب بنجاح. شكراً لثقتكم!",
  },
  completed: {
    label: "مكتمل بنجاح",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    step: 3,
    statusText: "اكتمل الطلب وسداد قيمته بالكامل",
  },
  cancelled: {
    label: "ملغي",
    badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    step: -1,
    statusText: "تم إلغاء هذا الطلب",
  },
  returned: {
    label: "مرتجع",
    badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    step: -1,
    statusText: "تم تسجيل هذا الطلب كمرتجع",
  },
  no_contact: {
    label: "تعذر التواصل",
    badgeClass: "bg-slate-700 text-slate-300 border-slate-600",
    step: 0,
    statusText: "تعذر الوصول إليك، يرجى مراسلتنا واتساب",
  },
  on_hold: {
    label: "معلّق مؤقتاً",
    badgeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    step: 0,
    statusText: "الطلب معلق بانتظار تأكيد إضافي",
  },
};

function OrdersPage() {
  const { userId } = useSessionUser();
  const { data: profile } = useCustomerProfile(userId);
  const searchParams = Route.useSearch();
  const { data: settings } = useSettings();
  const fetchMine = useServerFn(myOrders);
  const track = useServerFn(trackOrder);

  const [num, setNum] = useState(searchParams.order ? String(searchParams.order) : "");
  const [phone, setPhone] = useState(searchParams.phone ? String(searchParams.phone) : "");
  const [result, setResult] = useState<TrackedOrder | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [copiedOrder, setCopiedOrder] = useState<number | null>(null);
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<OrderInvoiceData | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Load user orders if logged in
  const mine = useQuery({
    queryKey: ["my-orders", userId],
    enabled: !!userId,
    queryFn: () => fetchMine(),
  });

  // Autofill phone from profile if available
  useEffect(() => {
    if (!phone && profile?.phone) {
      setPhone(profile.phone);
    }
  }, [profile?.phone, phone]);

  // Handle URL params automatic search
  useEffect(() => {
    const rawOrder = searchParams.order;
    const queryPhone = searchParams.phone || profile?.phone;

    if (rawOrder && queryPhone) {
      const parsedNum = parseInt(toWesternDigits(rawOrder).replace(/\D/g, ""), 10);
      if (parsedNum > 0) {
        setBusy(true);
        setNum(String(parsedNum));
        setPhone(queryPhone);
        track({ data: { orderNumber: parsedNum, phone: queryPhone } })
          .then((res) => setResult(res))
          .catch(() => setResult(null))
          .finally(() => setBusy(false));
      }
    }
  }, [searchParams.order, searchParams.phone, profile?.phone, track]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = parseInt(toWesternDigits(num).replace(/\D/g, ""), 10);
    const cleanPh = phone.trim();

    if (!cleanNum || cleanNum <= 0) {
      toast.error("يرجى إدخال رقم الطلب بشكل صحيح");
      return;
    }
    if (!cleanPh) {
      toast.error("يرجى إدخال رقم الجوال المسجل في الطلب");
      return;
    }

    setBusy(true);
    setResult(undefined);
    try {
      const res = await track({ data: { orderNumber: cleanNum, phone: cleanPh } });
      setResult(res);
      if (!res) {
        toast.error("لم نتمكن من العثور على الطلب. يرجى التأكد من صحة البيانات.");
      } else {
        toast.success(`تم العثور على الطلب #${res.order_number}`);
      }
    } catch {
      setResult(null);
      toast.error("حدث خطأ أثناء البحث عن الطلب.");
    } finally {
      setBusy(false);
    }
  };

  const copyOrderNumber = (orderNumber: number) => {
    navigator.clipboard.writeText(String(orderNumber));
    setCopiedOrder(orderNumber);
    toast.success(`تم نسخ رقم الطلب #${orderNumber}`);
    setTimeout(() => setCopiedOrder(null), 2500);
  };

  const selectMyOrder = (o: MyOrder) => {
    setResult({
      order_number: o.order_number,
      status: o.status,
      customer_name: o.customer_name ?? null,
      total: o.total,
      delivery_fee: o.delivery_fee ?? 0,
      discount: o.discount ?? 0,
      currency_label: o.currency_label,
      created_at: o.created_at,
      updated_at: o.created_at,
      city: o.city ?? "صنعاء",
      district: o.district ?? null,
      address: o.address ?? null,
      payment_method: o.payment_method ?? null,
      items: o.items,
    });
    setNum(String(o.order_number));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#FCF5F5] text-slate-800 px-4 py-6 md:py-10">
      <div className="mx-auto max-w-xl space-y-6">
        {/* Beautiful Elegant Page Header matching screenshot */}
        <div className="flex items-center justify-between border-b border-[#F0D5D8] pb-4">
          <div className="flex items-center gap-3">
            <Link
              to="/products"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-[#E9D2D6] text-[#823341] hover:bg-[#FFF8F9] transition-all"
            >
              <ArrowRight className="h-5 w-5 rotate-180" />
            </Link>
            <div>
              <h1 className="font-display text-xl font-extrabold text-[#823341]">تتبع طلبك</h1>
              <p className="text-[11px] font-bold text-slate-400">
                متابعة مسار شحنتك لحظة بلحظة مع إيهاب ستور
              </p>
            </div>
          </div>

          <Link
            to="/products"
            className="text-xs font-black text-[#B34D5F] hover:text-[#823341] transition-colors"
          >
            المتجر الرئيسي
          </Link>
        </div>

        {/* 1. Integrated Interactive Wavy Map & Info Component (Blush Pink Theme) */}
        <OrderTrackingMap
          order={
            result
              ? {
                  id: String(result.order_number),
                  status: result.status,
                  cityName: result.city,
                  district: result.district,
                  total: result.total,
                  currency_label: result.currency_label,
                  order_number: result.order_number,
                  customer_name: result.customer_name,
                  items: result.items,
                }
              : undefined
          }
          isDemo={!result}
          storePhone={settings?.phone || "770000000"}
          storeWhatsApp={settings?.whatsapp_number || "967770000000"}
          storeName={settings?.store_name || "إيهاب ستور"}
          onShowDetailsToggle={() => setShowDetails(!showDetails)}
          showDetailsState={showDetails}
        />

        {/* 2. Expanded Detail Card right under the tracker if showDetails is active */}
        {result && showDetails && (
          <div className="bg-white border border-[#F0D5D8] rounded-[28px] p-5 shadow-[0_8px_30px_rgba(179,77,95,0.04)] space-y-4 animate-in fade-in-50 duration-200">
            {/* Delivery address row */}
            <div className="flex items-start gap-2.5 text-slate-600 pb-3 border-b border-[#F5D6DA]">
              <MapPin className="h-4.5 w-4.5 shrink-0 text-[#B34D5F] mt-0.5" />
              <div className="text-xs font-bold text-slate-500">
                <span className="text-[#823341]">عنوان التوصيل: </span>
                <span>
                  {result.city}
                  {result.district ? ` - ${result.district}` : ""}
                  {result.address ? ` (${result.address})` : ""}
                </span>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2.5">
              {result.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#FAF1F1]/40 border border-[#E9D2D6]/80 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[#823341]">{item.product_name}</span>
                    {item.color_name && (
                      <span className="px-2 py-0.5 rounded-lg bg-[#FCECEF] text-[#B34D5F] text-[9px] font-bold">
                        {item.color_name}
                      </span>
                    )}
                    {item.size_name && (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[9px] font-bold">
                        {item.size_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-bold">×{item.quantity}</span>
                    {item.price != null && (
                      <span className="font-extrabold text-[#B34D5F]">
                        {formatMoney(Number(item.price) * item.quantity, result.currency_label)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Price summary */}
            <div className="pt-3 border-t border-[#F5D6DA] space-y-2 text-xs font-bold text-slate-500">
              <div className="flex justify-between">
                <span>رسوم التوصيل الشاملة:</span>
                <span className="text-slate-700">
                  {result.delivery_fee && result.delivery_fee > 0
                    ? formatMoney(result.delivery_fee, result.currency_label)
                    : "مجاناً"}
                </span>
              </div>
              <div className="flex justify-between font-black text-slate-800 text-sm pt-2.5 border-t border-[#F5D6DA]/50">
                <span>المجموع الإجمالي للفاتورة:</span>
                <span className="text-[#B34D5F] text-base font-display">
                  {formatMoney(result.total, result.currency_label)}
                </span>
              </div>
            </div>

            {/* Download PDF button styled with pink aesthetics */}
            <div className="pt-2">
              <button
                type="button"
                id="trigger-invoice-modal-btn"
                onClick={() =>
                  setInvoiceModalOrder({
                    order_number: result.order_number,
                    created_at: result.created_at,
                    status: result.status,
                    customer_name: result.customer_name ?? null,
                    city: result.city,
                    district: result.district,
                    address: result.address ?? null,
                    payment_method: result.payment_method ?? null,
                    delivery_fee: result.delivery_fee ?? null,
                    discount: result.discount ?? null,
                    total: result.total,
                    currency_label: result.currency_label,
                    items: result.items,
                  })
                }
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#FCECEF] border border-[#F0D5D8] py-3 text-xs font-extrabold text-[#B34D5F] hover:bg-[#F9DFE3] transition-all"
              >
                <FileText className="h-4 w-4" />
                <span>تحميل الفاتورة الرسمية (PDF)</span>
              </button>
            </div>
          </div>
        )}

        {/* Small trigger to track another order if we have a result active */}
        {result && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setResult(undefined);
                setNum("");
              }}
              className="text-xs text-[#B34D5F] font-bold hover:text-[#823341] underline underline-offset-4 transition-colors"
            >
              تتبع شحنة أخرى
            </button>
          </div>
        )}

        {/* 3. Search Form (Always visible for non-logged in or when searching) */}
        {!result && (
          <form
            onSubmit={handleSearch}
            className="bg-white border border-[#F0D5D8] rounded-[32px] p-6 shadow-[0_12px_40px_rgba(179,77,95,0.06)] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#F5D6DA] pb-3">
              <p className="flex items-center gap-2 font-display text-sm font-black text-[#823341]">
                <PackageSearch className="h-4.5 w-4.5 text-[#B34D5F]" /> أدخلي بيانات الطلب لتتبع
                شحنتكِ
              </p>
              {userId && profile?.phone && (
                <span className="text-[10px] text-[#B34D5F] font-bold bg-[#FCECEF] px-2.5 py-0.5 rounded-full border border-[#F0D5D8]">
                  تم ملء جوالكِ تلقائياً
                </span>
              )}
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-black text-[#823341]">
                  رقم الطلب <span className="text-[#B34D5F]">*</span>
                </label>
                <input
                  value={num}
                  onChange={(e) => setNum(e.target.value)}
                  inputMode="numeric"
                  required
                  placeholder="مثال: 1042 أو #1042"
                  className="w-full rounded-2xl border border-[#E9D2D6] bg-[#FFF9FA] px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-[#B34D5F] focus:ring-1 focus:ring-[#B34D5F]/30 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black text-[#823341]">
                  رقم الجوال المسجل <span className="text-[#B34D5F]">*</span>
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  required
                  placeholder="مثال: 770000000"
                  className="w-full rounded-2xl border border-[#E9D2D6] bg-[#FFF9FA] px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-[#B34D5F] focus:ring-1 focus:ring-[#B34D5F]/30 placeholder:text-slate-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D48995] to-[#B34D5F] py-3.5 text-xs font-black text-white shadow-lg shadow-pink-500/10 hover:brightness-105 active:scale-98 transition-all disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري البحث عن شحنتكِ...</span>
                </>
              ) : (
                <>
                  <PackageSearch className="h-4 w-4" />
                  <span>تتبع الشحنة الآن</span>
                </>
              )}
            </button>

            {/* Error banner if not found */}
            {result === null && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800 space-y-2 animate-in fade-in-50">
                <div className="flex items-center gap-2 font-black text-rose-900">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  <span>لم يتم العثور على طلب بهذه البيانات</span>
                </div>
                <p className="text-[11px] text-rose-800/80 leading-relaxed font-bold">
                  تأكدي من كتابة رقم الطلب ورقم الهاتف المسجل بشكل مطابق للبيانات المدخلة أثناء
                  الطلب، أو تواصل معنا عبر واتساب للمساعدة الفورية.
                </p>
                {settings?.whatsapp_number && (
                  <a
                    href={whatsappLink(
                      settings.whatsapp_number,
                      `مرحباً ${settings.store_name ?? "إيهاب ستور"}، أواجه مشكلة في تتبع طلبي رقم #${num}`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>مراسلة خدمة العملاء</span>
                  </a>
                )}
              </div>
            )}
          </form>
        )}

        {/* 4. Logged-in Customers Previous Orders List (One-click track) */}
        {userId && (
          <section className="space-y-4 pt-4 border-t border-[#F0D5D8]">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-sm font-black text-[#823341]">
                <ShoppingBag className="h-4 w-4 text-[#B34D5F]" /> طلباتي السابقة
              </h2>
              {mine.data?.length ? (
                <span className="text-xs font-bold text-slate-400 bg-white border border-[#F0D5D8] px-2.5 py-0.5 rounded-full">
                  {mine.data.length} طلبات مسجلة
                </span>
              ) : null}
            </div>

            {mine.isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#B34D5F]" />
              </div>
            )}

            {mine.data?.length === 0 && (
              <div className="rounded-[28px] border border-[#F0D5D8] bg-white p-6 text-center text-xs text-slate-400 space-y-2">
                <ShoppingBag className="mx-auto h-8 w-8 text-[#B34D5F]/40 mb-1" />
                <p className="font-extrabold text-[#823341]">
                  لا توجد طلبات سابقة مسجلة برقم جوالكِ
                </p>
                <p className="text-slate-400 font-bold">
                  عند إتمام أي طلب جديد سيظهر هنا تلقائياً لتتبعه بضغطة زر واحدة.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {mine.data?.map((o) => {
                const sConf = STATUS_MAP[o.status] || {
                  label: o.status,
                  badgeClass: "bg-slate-100 text-slate-500 border-slate-200",
                };
                const isSelected = result?.order_number === o.order_number;

                return (
                  <div
                    key={o.id}
                    onClick={() => selectMyOrder(o)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? "bg-[#FFF2F4] border-[#B34D5F] shadow-[0_6px_20px_rgba(179,77,95,0.08)]"
                        : "bg-white border-[#F0D5D8] hover:border-[#B34D5F] hover:bg-[#FFF9FA]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-black text-[#823341] text-base">
                          طلب #{o.order_number}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          ({new Date(o.created_at).toLocaleDateString("ar-EG")})
                        </span>
                      </div>

                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                          o.status === "shipped"
                            ? "bg-[#B34D5F] text-white border-[#B34D5F]"
                            : o.status === "delivered" || o.status === "completed"
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "bg-[#FCECEF] text-[#B34D5F] border-[#F0D5D8]"
                        }`}
                      >
                        {sConf.label}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400 font-bold">
                      <span>{o.items.length} منتجات</span>
                      <span className="font-extrabold text-[#B34D5F] font-display">
                        {formatMoney(o.total, o.currency_label)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-[#F5D6DA] text-xs">
                      <span className="text-[#B34D5F] font-black flex items-center gap-1">
                        <PackageSearch className="h-3.5 w-3.5" />
                        <span>اضغطي هنا للتتبع المباشر</span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-[#B34D5F] rotate-180" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Invoice Modal */}
        {invoiceModalOrder && (
          <OrderInvoiceModal order={invoiceModalOrder} onClose={() => setInvoiceModalOrder(null)} />
        )}
      </div>
    </div>
  );
}
