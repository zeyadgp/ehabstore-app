import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { useCart } from "@/lib/cart";
import { useCurrency } from "@/lib/currency";
import { trackMetaInitiateCheckout, trackMetaPurchase } from "@/lib/meta/pixel";
import { placeOrder } from "@/lib/orders.functions";
import { uploadReceipt } from "@/lib/receipt.functions";
import { compressToDataUrl } from "@/lib/image-compress";
import { usePaymentMethods } from "@/lib/payments";
import { SmartImage } from "@/components/SmartImage";
import { buildWhatsappMessage, whatsappLink } from "@/lib/whatsapp";
import { YEMEN_GOVERNORATES, deliveryNote, districtsFor } from "@/lib/yemen";
import { feeForCity, useDeliveryZones } from "@/lib/delivery";
import { checkCoupon, type CouponCheck } from "@/lib/coupons.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  defaultAddress,
  useCustomerProfile,
  useSessionUser,
  type SavedAddress,
} from "@/lib/account";
import { LocationPicker } from "@/components/LocationPicker";
import { OrderInvoiceModal, type OrderInvoiceData } from "@/components/OrderInvoiceModal";
import { FreeShippingBar, DEFAULT_FREE_SHIPPING_THRESHOLD } from "@/components/FreeShippingBar";
import { CheckCircle2, FileText, Printer, ArrowLeft, MessageCircle, Truck } from "lucide-react";

const title = "إتمام الطلب | إيهاب ستور للعناية والتجميل";
const description = "أدخل بياناتك لإتمام الطلب وإرساله مباشرة عبر واتساب.";

type CheckoutSearchParams = {
  coupon?: string | undefined;
};

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearchParams => ({
    coupon: typeof search["coupon"] === "string" ? search["coupon"] : undefined,
  }),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://ehabstore.app/checkout" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://ehabstore.app/checkout" }],
  }),
  component: CheckoutPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "اكتب اسمك الكامل").max(80),
  phone: z.string().trim().min(9, "رقم جوال يمني غير صحيح").max(20),
  city: z.string().trim().min(2, "اختر المحافظة").max(60),
  district: z.string().trim().max(60).optional(),
  address: z.string().trim().min(5, "اكتب العنوان بالتفصيل").max(200),
  notes: z.string().trim().max(400).optional(),
});

function CheckoutPage() {
  const { userId } = useSessionUser();
  const { data: profile } = useCustomerProfile(userId);
  const { items, clear } = useCart();
  const { code, unitFor, symbol } = useCurrency();
  const fmt = (n: number) =>
    `${Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${symbol}`;
  const subtotal = items.reduce((s, i) => s + unitFor(i.id, i.price) * i.quantity, 0);
  const navigate = useNavigate();
  const submitOrder = useServerFn(placeOrder);
  const sendReceipt = useServerFn(uploadReceipt);
  const { data: methods = [] } = usePaymentMethods();
  const [methodId, setMethodId] = useState<string>("");
  const [receipt, setReceipt] = useState<{ file: File; preview: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    district: "",
    address: "",
    notes: "",
  });
  const [confirmedOrder, setConfirmedOrder] = useState<OrderInvoiceData | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [waOrderLink, setWaOrderLink] = useState<string>("");
  const [coords, setCoords] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  });
  // تعبئة تلقائية من الملف الشخصي والعنوان الافتراضي
  useEffect(() => {
    if (!profile) return;
    const addr = defaultAddress(profile);
    setForm((f) => ({
      ...f,
      name: f.name || profile.full_name || "",
      phone: f.phone || profile.phone || "",
      city: f.city || addr?.city || profile.governorate || "",
      district: f.district || addr?.district || profile.district || "",
      address: f.address || addr?.address || profile.address || "",
    }));
  }, [profile]);

  // تتبع حدث بدء إتمام الطلب في Meta Pixel
  useEffect(() => {
    if (items.length > 0) {
      try {
        void trackMetaInitiateCheckout(
          items.map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            sku: i.sku,
          })),
          subtotal,
          symbol || "SAR",
          { phone: form.phone || undefined },
        );
      } catch {
        /* ignore tracking errors */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchParams = Route.useSearch();
  const [coupon, setCoupon] = useState(searchParams.coupon || "");
  const [couponState, setCouponState] = useState<CouponCheck | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const districts = districtsFor(form.city);
  const { data: zones = [] } = useDeliveryZones();
  const rawDeliveryFee = form.city ? feeForCity(zones, form.city) : 0;
  const isFreeDeliveryQualified = subtotal >= DEFAULT_FREE_SHIPPING_THRESHOLD;
  const deliveryFee = isFreeDeliveryQualified ? 0 : rawDeliveryFee;

  // التحقق التلقائي عند دخول المتجر عبر كود إحالة أو رابط يحمل كود كوبون
  useEffect(() => {
    let codeToUse = searchParams.coupon?.trim().toUpperCase();

    if (!codeToUse && typeof window !== "undefined") {
      const stored = localStorage.getItem("ehab_referred_by");
      if (stored && stored.trim()) {
        codeToUse = stored.trim().toUpperCase();
      }
    }

    if (codeToUse) {
      setCoupon(codeToUse);
      setCouponBusy(true);
      checkCoupon({ data: { code: codeToUse } })
        .then((res) => {
          setCouponState(res);
          if (res.ok) {
            toast.success(res.message);
          }
        })
        .catch(() => setCouponState({ ok: false, message: "تعذّر التحقق من الكود" }))
        .finally(() => setCouponBusy(false));
    }
  }, [searchParams.coupon]);

  const discountAmount =
    couponState?.ok && couponState.discountValue
      ? couponState.discountType === "percent"
        ? Math.round((subtotal * couponState.discountValue) / 100)
        : Math.min(subtotal, couponState.discountValue)
      : 0;

  const total = Math.max(0, subtotal - discountAmount) + deliveryFee;

  if (confirmedOrder) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 md:py-16 text-center">
        <div className="rounded-3xl border border-border bg-card p-8 md:p-10 shadow-soft">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="font-display text-2xl font-black text-foreground md:text-3xl">
            تم استلام وتأكيد طلبك بنجاح!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            رقم الطلب الخاص بك:{" "}
            <span className="font-mono font-extrabold text-primary">
              #{confirmedOrder.order_number}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            تم إرسال تفاصيل الفاتورة مباشرة إلى محادثة واتساب لتأكيد الشحن والتجهيز الفوري.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/orders"
              search={{
                order: String(confirmedOrder.order_number),
                phone: confirmedOrder.phone || undefined,
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl gradient-gold px-6 py-3.5 text-sm font-extrabold text-primary-foreground shadow-soft transition-all hover:opacity-95 active:scale-98"
            >
              <Truck className="h-4 w-4" />
              <span>متابعة حالة الشحنة</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsInvoiceModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-secondary/80 px-6 py-3.5 text-sm font-extrabold text-foreground transition-all hover:border-primary hover:bg-secondary active:scale-98"
            >
              <FileText className="h-4 w-4 text-primary" />
              <span>عرض وطباعة الفاتورة (PDF)</span>
            </button>

            {waOrderLink && (
              <a
                href={waOrderLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-soft transition-all hover:bg-emerald-700 active:scale-98"
              >
                <MessageCircle className="h-4 w-4" />
                <span>فتح محادثة واتساب</span>
              </a>
            )}
          </div>

          <div className="mt-8 border-t border-border/70 pt-6">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
            >
              <span>متابعة التسوق في المتجر</span>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {isInvoiceModalOpen && (
          <OrderInvoiceModal order={confirmedOrder} onClose={() => setIsInvoiceModalOpen(false)} />
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-extrabold">لا توجد منتجات في السلة</h1>
        <Link
          to="/products"
          className="mt-6 inline-block rounded-xl gradient-gold px-7 py-3 text-sm font-bold text-primary-foreground"
        >
          تصفح المنتجات
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        map[String(i.path[0])] = i.message;
      });
      setErrors(map);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const method = methods.find((m) => m.id === methodId) ?? null;
      let receiptPath: string | null = null;
      if (receipt) {
        const dataUrl = await compressToDataUrl(receipt.file, { maxSize: 1400, quality: 0.8 });
        const res = await sendReceipt({ data: { dataUrl } });
        receiptPath = res.path;
      }
      const placed = await submitOrder({
        data: {
          name: parsed.data.name,
          phone: parsed.data.phone,
          city: parsed.data.city,
          district: parsed.data.district ?? null,
          address: parsed.data.address,
          notes: parsed.data.notes ?? null,
          currency: code,
          paymentMethod: method?.name ?? null,
          receiptUrl: receiptPath,
          couponCode: coupon.trim() ? coupon.trim().toUpperCase() : null,
          influencerCode:
            couponState?.kind === "influencer"
              ? couponState.code
              : typeof window !== "undefined"
                ? localStorage.getItem("ehab_referred_by")
                : null,
          latitude: coords.latitude,
          longitude: coords.longitude,
          items: items.map((i) => ({
            id: i.id,
            quantity: i.quantity,
            colorValueId: i.colorValueId ?? null,
            sizeValueId: i.sizeValueId ?? null,
          })),
        },
      });

      const orderTrackingUrl = placed.orderNumber
        ? `${window.location.origin}/orders?order=${placed.orderNumber}&phone=${encodeURIComponent(parsed.data.phone)}`
        : null;
      const storeCartUrl = `${window.location.origin}/cart`;

      const message = buildWhatsappMessage({
        storeName: placed.storeName,
        orderNumber: placed.orderNumber,
        subtotal: placed.subtotal,
        deliveryFee: placed.deliveryFee,
        discount: placed.discount,
        couponCode: placed.couponCode,
        pointsEarned: placed.pointsEarned,
        deliveryNote: deliveryNote(parsed.data.city),
        paymentMethod: placed.paymentMethod,
        orderUrl: orderTrackingUrl,
        cartUrl: storeCartUrl,
        info: {
          name: parsed.data.name,
          phone: parsed.data.phone,
          city: parsed.data.city,
          district: parsed.data.district ?? "",
          address: parsed.data.address,
          notes: [
            parsed.data.notes ?? "",
            placed.paymentMethod ? `طريقة الدفع: ${placed.paymentMethod}` : "",
            receiptPath ? "تم إرفاق صورة الإشعار" : "",
          ]
            .filter(Boolean)
            .join(" — "),
        },
        items: placed.items.map((i, idx) => ({
          key: String(idx),
          id: String(idx),
          slug: "",
          image: null,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          color: i.color_name,
          size: i.size_name,
        })),
        total: placed.total,
        currencyLabel: placed.currencyLabel,
      });
      // حفظ العنوان الجديد في الملف الشخصي
      if (userId && profile) {
        const list: SavedAddress[] = profile.addresses ?? [];
        const exists = list.some(
          (a) => a.city === parsed.data.city && a.address.trim() === parsed.data.address.trim(),
        );
        if (!exists) {
          const next: SavedAddress[] = [
            ...list,
            {
              id: crypto.randomUUID(),
              label: parsed.data.city,
              city: parsed.data.city,
              district: parsed.data.district ?? "",
              address: parsed.data.address,
              is_default: list.length === 0,
            },
          ];
          await supabase
            .from("profiles")
            .update({
              addresses: next,
              full_name: parsed.data.name,
              phone: parsed.data.phone,
            } as never)
            .eq("id", userId);
        }
      }

      // تتبع حدث الشراء في Meta Pixel و Conversions API
      try {
        void trackMetaPurchase({
          id: placed.orderId,
          total: placed.total ?? total,
          currency: symbol || "SAR",
          phone: parsed.data.phone,
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            sku: i.sku,
          })),
        });
      } catch {
        /* ignore tracking errors */
      }

      const link = whatsappLink(placed.whatsappNumber, message);
      setWaOrderLink(link);
      window.open(link, "_blank", "noopener");

      const finalCurrency = placed.currencyLabel ?? symbol;
      const orderData: OrderInvoiceData = {
        order_number: placed.orderNumber ?? 0,
        created_at: new Date().toISOString(),
        customer_name: parsed.data.name,
        phone: parsed.data.phone,
        city: parsed.data.city,
        district: parsed.data.district ?? "",
        address: parsed.data.address,
        payment_method: method?.name ?? "تحويل بنكي / نقدي عند الاستلام",
        subtotal: placed.subtotal ?? subtotal,
        delivery_fee: placed.deliveryFee ?? deliveryFee,
        discount: placed.discount ?? 0,
        total: placed.total ?? total,
        currency_label: finalCurrency,
        items: placed.items.map((i) => ({
          product_name: i.name,
          quantity: i.quantity,
          price: i.price,
          color_name: i.color_name,
          size_name: i.size_name,
        })),
      };

      clear();
      setConfirmedOrder(orderData);
      toast.success(
        placed.pointsEarned > 0
          ? `تم تسجيل طلبك وكسبت ${placed.pointsEarned} نقطة ولاء!`
          : "تم تسجيل طلبك بنجاح!",
      );
    } catch (err) {
      console.error(err);
      toast.error("تعذّر إرسال الطلب، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  const field = (
    name: keyof typeof form,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-foreground">{label}</label>
      <input
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
        {...props}
      />
      {errors[name] && <p className="mt-1 text-xs font-bold text-destructive">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="border-b border-border/60 pb-4">
        <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl">
          إتمام الطلب
        </h1>
        <p className="mt-1.5 text-xs text-muted-foreground">
          أدخل بيانات المستلم وسنقوم بتجهيز الشحنة وتأكيدها فوراً عبر واتساب المتجر لكافة المحافظات
          اليمنية.
        </p>
      </div>

      <div className="mt-6">
        <FreeShippingBar currentAmount={subtotal} />
      </div>

      <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 rounded-3xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("name", "الاسم الكامل", { placeholder: "مثال: فاطمة أحمد", maxLength: 80 })}
            {field("phone", "رقم الجوال (واتساب للتأكيد)", {
              placeholder: "مثال: 770000000",
              dir: "ltr",
              inputMode: "tel",
              maxLength: 20,
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-foreground">المحافظة</label>
              <select
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value, district: "" }))}
                className="w-full cursor-pointer rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                <option value="">اختر المحافظة…</option>
                {YEMEN_GOVERNORATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              {errors["city"] && (
                <p className="mt-1 text-xs font-bold text-destructive">{errors["city"]}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-foreground">
                المديرية / المنطقة (اختياري)
              </label>
              <input
                list="yemen-districts"
                value={form.district}
                onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                placeholder={districts[0] ? `مثال: ${districts[0]}` : "مثال: مديرية معين"}
                maxLength={60}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <datalist id="yemen-districts">
                {districts.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>

          {field("address", "العنوان بالتفصيل والمعالم البارزة", {
            placeholder: "مثال: صنعاء - شارع الزبيري - بجوار صيدلية النور - عمارة رقم 4",
            maxLength: 200,
          })}

          <LocationPicker
            latitude={coords.latitude}
            longitude={coords.longitude}
            governorate={form.city}
            onPick={(loc) => {
              setCoords({ latitude: loc.latitude, longitude: loc.longitude });
              setForm((f) => ({
                ...f,
                city: loc.city || f.city,
                district: loc.district || f.district,
                address: loc.address || f.address,
              }));
            }}
          />

          {form.city && (
            <div className="rounded-2xl border border-primary/20 bg-secondary/60 p-3.5 text-xs text-muted-foreground">
              <span className="font-bold text-primary">معلومة التوصيل: </span>
              {deliveryNote(form.city)}
            </div>
          )}

          <div className="rounded-2xl border border-border/80 bg-background p-4">
            <label className="mb-1.5 block text-xs font-bold text-foreground">
              كود الخصم أو قسيمة المكافأة (اختياري)
            </label>
            <div className="flex gap-2">
              <input
                value={coupon}
                onChange={(e) => {
                  setCoupon(e.target.value.toUpperCase());
                  setCouponState(null);
                }}
                placeholder="مثال: EH-A7K2M9"
                dir="ltr"
                maxLength={24}
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold uppercase tracking-wider outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <button
                type="button"
                disabled={couponBusy || coupon.trim().length < 2}
                onClick={async () => {
                  setCouponBusy(true);
                  try {
                    const res = await checkCoupon({ data: { code: coupon.trim().toUpperCase() } });
                    setCouponState(res);
                  } catch {
                    setCouponState({ ok: false, message: "تعذّر التحقق من الكود" });
                  } finally {
                    setCouponBusy(false);
                  }
                }}
                className="shrink-0 rounded-xl bg-secondary px-5 text-xs font-bold text-primary transition-colors hover:bg-secondary/80 disabled:opacity-50"
              >
                {couponBusy ? "جارٍ…" : "تطبيق"}
              </button>
            </div>
            {couponState && (
              <div
                className={`mt-2 flex items-center justify-between rounded-xl p-2.5 text-xs font-bold ${
                  couponState.ok
                    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border border-destructive/20 bg-destructive/10 text-destructive"
                }`}
              >
                <span>{couponState.message}</span>
                {couponState.ok && (
                  <button
                    type="button"
                    onClick={() => {
                      setCoupon("");
                      setCouponState(null);
                    }}
                    className="text-[11px] font-extrabold text-destructive hover:underline"
                  >
                    إلغاء الخصم
                  </button>
                )}
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              يمكنك استبدال نقاطك بكوبونات خصم مباشرة من{" "}
              <Link
                to="/loyalty"
                className="font-bold text-primary underline-offset-4 hover:underline"
              >
                نادي الولاء
              </Link>
              .
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-foreground">
              ملاحظات إضافية للتوصيل (اختياري)
            </label>
            <textarea
              value={form.notes}
              maxLength={400}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="مثال: يرجى التوصيل في الفترة المسائية..."
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>

          {methods.length > 0 && (
            <div className="border-t border-border/80 pt-5">
              <label className="mb-2.5 block font-display text-xs font-extrabold text-foreground">
                طريقة الدفع المفضلة
              </label>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {methods.map((m) => {
                  const active = methodId === m.id;
                  const isImage = Boolean(m.icon && !/^\p{Extended_Pictographic}/u.test(m.icon));
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="button"
                      aria-label={`اختر طريقة الدفع ${m.name ?? "الخيار"}`}
                      onClick={() => setMethodId(active ? "" : m.id)}
                      className={`flex items-center gap-2.5 rounded-2xl border p-3 text-start text-xs font-bold shadow-soft transition-all duration-150 active:scale-95 ${
                        active
                          ? "border-primary bg-secondary text-primary ring-2 ring-primary/20"
                          : "border-border bg-background text-foreground hover:border-primary/60"
                      }`}
                    >
                      {m.icon ? (
                        isImage ? (
                          <SmartImage
                            paths={[m.icon]}
                            fallback="/favicon.png"
                            alt={m.name ?? "طريقة دفع"}
                            className="h-7 w-7 shrink-0 rounded-lg object-contain"
                          />
                        ) : (
                          <span className="text-lg leading-none">{m.icon}</span>
                        )
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary font-bold">
                          {(m.name || "د").slice(0, 1)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground sm:text-sm">
                        {m.name ?? "طريقة دفع"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {methodId && (
                <div className="mt-3.5 space-y-1.5 rounded-2xl border border-primary/20 bg-secondary/50 p-4 text-xs text-muted-foreground">
                  {methods.find((m) => m.id === methodId)?.account_details && (
                    <p dir="auto" className="font-bold text-foreground">
                      {methods.find((m) => m.id === methodId)?.account_details}
                    </p>
                  )}
                  <p className="leading-relaxed">
                    {methods.find((m) => m.id === methodId)?.instructions ??
                      "حوّلي المبلغ إلى الحساب الموضح ثم أرفقي صورة الإشعار بالأسفل."}
                  </p>
                </div>
              )}

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-bold text-foreground">
                  صورة الإشعار / الحوالة (اختياري)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return setReceipt(null);
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("حجم الصورة كبير جداً (الحد 5MB)");
                      return;
                    }
                    setReceipt({ file, preview: URL.createObjectURL(file) });
                  }}
                  className="w-full cursor-pointer rounded-2xl border border-dashed border-border bg-background px-4 py-3 text-xs text-muted-foreground file:mr-2 file:rounded-xl file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-xs file:font-bold file:text-primary hover:border-primary"
                />
                {receipt && (
                  <div className="mt-3 flex items-center gap-3">
                    <img
                      src={receipt.preview}
                      alt="صورة الإشعار"
                      className="h-20 w-20 rounded-xl border border-border object-cover shadow-soft"
                    />
                    <button
                      type="button"
                      onClick={() => setReceipt(null)}
                      className="rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/20"
                    >
                      إزالة الصورة
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="sticky top-20 h-fit rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-base font-extrabold text-foreground">ملخص الطلب</h2>
          <ul className="mt-4 space-y-2.5 divide-y divide-border/60 text-xs">
            {items.map((i) => (
              <li key={i.key} className="flex justify-between gap-2 pt-2.5 first:pt-0">
                <div className="flex min-w-0 flex-col">
                  <span className="line-clamp-1 font-medium text-foreground">
                    {i.name} <span className="font-bold text-primary">× {i.quantity}</span>
                  </span>
                  {(i.color || i.size) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {i.color && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/80 px-2 py-0.5 font-bold text-foreground">
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-border"
                            style={{ background: i.colorSwatch ?? "hsl(var(--muted))" }}
                          />
                          اللون: {i.color}
                        </span>
                      )}
                      {i.size && (
                        <span className="rounded-md border border-border bg-secondary/80 px-2 py-0.5 font-bold text-foreground">
                          المقاس: {i.size}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="shrink-0 font-bold tabular-nums text-foreground">
                  {fmt(unitFor(i.id, i.price) * i.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 border-t border-border/80 pt-3 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>المجموع الفرعي</span>
              <span className="font-bold tabular-nums text-foreground">{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                <span>خصم الكوبون ({couponState?.code})</span>
                <span className="tabular-nums">- {fmt(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>التوصيل{form.city ? ` (${form.city})` : ""}</span>
              <span className="font-bold tabular-nums text-foreground">
                {isFreeDeliveryQualified ? (
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    مجاني 🎉
                  </span>
                ) : deliveryFee > 0 ? (
                  fmt(deliveryFee)
                ) : (
                  "يُحدد حسب المحافظة"
                )}
              </span>
            </div>
          </div>
          <div className="mt-4 flex justify-between border-t border-border/80 pt-3 text-base font-extrabold">
            <span className="text-foreground">المجموع الكلي</span>
            <span className="font-display tabular-nums text-primary">{fmt(total)}</span>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-6 w-full rounded-2xl gradient-gold py-3.5 text-sm font-extrabold text-primary-foreground shadow-soft transition-all duration-200 hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? "جاري الإرسال..." : "تأكيد الطلب"}
          </button>
        </aside>
      </form>
    </div>
  );
}
