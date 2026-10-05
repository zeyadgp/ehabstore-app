import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Store,
  Home,
  Clock,
  Check,
  Package,
  Activity,
  ChevronDown,
  ChevronUp,
  FileText,
  Phone,
  MessageCircle,
  ChevronLeft,
  ShoppingCart,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { whatsappLink } from "@/lib/whatsapp";

interface TrackedOrderInfo {
  id: string;
  status: string;
  cityName?: string;
  district?: string | null | undefined;
  total?: number;
  currency_label?: string;
  order_number?: number | string;
  customer_name?: string | null | undefined;
  items?: any[];
}

interface OrderTrackingMapProps {
  order?: TrackedOrderInfo | null | undefined;
  isDemo?: boolean;
  storePhone?: string;
  storeWhatsApp?: string;
  storeName?: string;
  onShowDetailsToggle?: () => void;
  showDetailsState?: boolean;
}

// 3-Point Wave bezier interpolation function (P0: Warehouse, P1/P2: Control curves, P3: Client)
const getWavyPathPoint = (t: number): [number, number] => {
  // x(t) = (1-t)^3 * 50 + 3*(1-t)^2 * t * 130 + 3*(1-t)*t^2 * 250 + t^3 * 350
  // y(t) = (1-t)^3 * 100 + 3*(1-t)^2 * t * 40 + 3*(1-t)*t^2 * 160 + t^3 * 100
  const x =
    Math.pow(1 - t, 3) * 50 +
    3 * Math.pow(1 - t, 2) * t * 130 +
    3 * (1 - t) * Math.pow(t, 2) * 250 +
    Math.pow(t, 3) * 350;
  const y =
    Math.pow(1 - t, 3) * 100 +
    3 * Math.pow(1 - t, 2) * t * 40 +
    3 * (1 - t) * Math.pow(t, 2) * 160 +
    Math.pow(t, 3) * 100;
  return [x, y];
};

export default function OrderTrackingMap({
  order,
  isDemo = false,
  storePhone = "770000000",
  storeWhatsApp = "967770000000",
  storeName = "إيهاب ستور",
  onShowDetailsToggle,
  showDetailsState = false,
}: OrderTrackingMapProps) {
  const [progress, setProgress] = useState(0.02);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const orderStatus = order?.status || "new";

  // Three Primary Stages Map:
  // 1. Preparing (تم التجهيز): new, reviewing, confirmed, processing, ready, on_hold, etc.
  // 2. In Transit (في الطريق): shipped
  // 3. Delivered (تم التسليم): delivered, completed
  const isDelivered = orderStatus === "delivered" || orderStatus === "completed";
  const isInTransit = orderStatus === "shipped";
  const isPreparing = !isDelivered && !isInTransit;

  const activeStage = isDelivered ? "delivered" : isInTransit ? "transit" : "preparing";

  // Truck Position calculation with smooth loops or static steps
  useEffect(() => {
    if (!mounted) return undefined;

    if (isDemo) {
      let animFrameId: number;
      let start: number | null = null;
      const duration = 7500; // 7.5s cycle for demo truck movement

      const step = (timestamp: number) => {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        const progressT = (elapsed % duration) / duration;
        setProgress(progressT);
        animFrameId = requestAnimationFrame(step);
      };

      animFrameId = requestAnimationFrame(step);
      return () => cancelAnimationFrame(animFrameId);
    } else {
      if (activeStage === "delivered") {
        setProgress(0.95);
      } else if (activeStage === "preparing") {
        setProgress(orderStatus === "ready" ? 0.15 : 0.05);
      } else if (activeStage === "transit") {
        // Vehicle moves dynamically between 40% and 82% of path to show transit
        let animFrameId: number;
        let start: number | null = null;
        const duration = 5000;

        const step = (timestamp: number) => {
          if (!start) start = timestamp;
          const elapsed = timestamp - start;
          const cycle = (elapsed % duration) / duration; // 0 to 1
          const factor = Math.sin(cycle * Math.PI * 2) * 0.5 + 0.5; // oscillation
          const activeProgress = 0.4 + factor * 0.4;
          setProgress(activeProgress);
          animFrameId = requestAnimationFrame(step);
        };

        animFrameId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animFrameId);
      }
    }
    return undefined;
  }, [mounted, isDemo, activeStage, orderStatus]);

  if (!mounted) {
    return (
      <div className="h-80 w-full rounded-[32px] border border-[#F3DBDF] bg-[#FAF1F1] animate-pulse flex items-center justify-center">
        <span className="text-sm font-bold text-[#823341]/60">
          جاري تحميل لوحة التتبع الأنيقة...
        </span>
      </div>
    );
  }

  // Calculate coordinates of the truck on the wavy curve
  const [truckX, truckY] = getWavyPathPoint(progress);

  // Status-specific texts and configurations
  const getStatusConfig = () => {
    switch (orderStatus) {
      case "new":
      case "reviewing":
        return {
          pill: "قيد المراجعة",
          desc: "تم استلام طلبك وبانتظار التأكيد",
          eta: "خلال 24 – 48 ساعة",
        };
      case "confirmed":
        return {
          pill: "تم التأكيد",
          desc: "تم تأكيد طلبك بنجاح",
          eta: "خلال 24 – 48 ساعة",
        };
      case "processing":
        return {
          pill: "قيد التجهيز",
          desc: "جاري تغليف وتجهيز منتجاتك الفاخرة",
          eta: "خلال 24 – 48 ساعة",
        };
      case "ready":
        return {
          pill: "جاهز للتسليم",
          desc: "الشحنة جاهزة بانتظار مندوب التوصيل",
          eta: "خلال 24 – 48 ساعة",
        };
      case "shipped":
        return {
          pill: "خارج للتوصيل",
          desc: "جاري توصيل طلبك الآن",
          eta: "خلال 34 دقيقة تقريباً",
        };
      case "delivered":
      case "completed":
        return {
          pill: "تم التسليم",
          desc: "تم تسليم طلبك بنجاح. شكراً لك!",
          eta: "تم التوصيل",
        };
      case "cancelled":
        return {
          pill: "تم الإلغاء",
          desc: "تم إلغاء هذا الطلب",
          eta: "ملغي",
        };
      default:
        return {
          pill: "قيد المراجعة",
          desc: "يتم معالجة الطلب حالياً",
          eta: "خلال 24 – 48 ساعة",
        };
    }
  };

  const statusConfig = getStatusConfig();

  // Copy order id helper
  const copyOrderId = () => {
    if (!order?.order_number) return;
    navigator.clipboard.writeText(String(order.order_number));
    setCopied(true);
    toast.success(`تم نسخ رقم الطلب #${order.order_number}`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* 1. TOP CARD: Beautiful Glowing Pastel Map Panel */}
      <div className="w-full bg-gradient-to-br from-[#FFF2F4] via-[#FCECEF] to-[#FDE1E5] border border-[#F3DBDF] shadow-[0_12px_36px_rgba(179,77,95,0.06)] rounded-[32px] overflow-hidden relative p-6 transition-all min-h-[220px]">
        {/* Subtle Decorative Ambient Wave Glow inside container */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.5),transparent)] pointer-events-none" />

        {/* The Wavy Road and Location Pins inside SVG */}
        <div className="relative h-32 w-full mt-4 select-none">
          <svg viewBox="0 0 400 140" className="w-full h-full" preserveAspectRatio="none">
            {/* Soft pink curved road background */}
            <path
              d="M 50,100 C 130,40 170,160 250,100 C 290,70 310,120 350,100"
              fill="none"
              stroke="#FFF"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.6"
            />

            {/* Wavy solid soft-pink/rose line */}
            <path
              d="M 50,100 C 130,40 170,160 250,100 C 290,70 310,120 350,100"
              fill="none"
              stroke="#F68F9E"
              strokeWidth="4"
              strokeLinecap="round"
              className="transition-all duration-300"
            />

            {/* Tiny start/end anchor circles on path */}
            <circle cx="50" cy="100" r="5" fill="#E8A3B0" />
            <circle cx="350" cy="100" r="5" fill="#E8A3B0" />
          </svg>

          {/* Left Node Pin: Warehouse */}
          <div
            className="absolute"
            style={{ left: "12.5%", bottom: "28.5%", transform: "translate(-50%, 50%)" }}
          >
            <div className="flex flex-col items-center relative">
              {/* White rounded info popup */}
              <div className="absolute bottom-11 bg-white/95 backdrop-blur border border-[#F3DBDF] rounded-[16px] px-3 py-1.5 shadow-[0_6px_16px_rgba(179,77,95,0.06)] text-center">
                <p className="text-[11px] font-black text-[#823341] leading-tight">المستودع</p>
                <p className="text-[9px] font-bold text-slate-400 whitespace-nowrap leading-tight mt-0.5">
                  مركز التوزيع
                </p>
              </div>

              {/* Pin Base & Pin Container */}
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#B34D5F] text-white border-2 border-white shadow-lg relative z-10">
                <Store size={18} />
              </div>
            </div>
          </div>

          {/* Right Node Pin: Customer Address */}
          <div
            className="absolute"
            style={{ left: "87.5%", bottom: "28.5%", transform: "translate(-50%, 50%)" }}
          >
            <div className="flex flex-col items-center relative">
              {/* White rounded info popup */}
              <div className="absolute bottom-11 bg-white/95 backdrop-blur border border-[#F3DBDF] rounded-[16px] px-3 py-1.5 shadow-[0_6px_16px_rgba(179,77,95,0.06)] text-center">
                <p className="text-[11px] font-black text-[#823341] leading-tight">عنوان العميل</p>
                <p className="text-[9px] font-bold text-slate-400 whitespace-nowrap leading-tight mt-0.5">
                  المنزل
                </p>
              </div>

              {/* Pin Container */}
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#B34D5F] text-white border-2 border-white shadow-lg relative z-10">
                <Home size={18} />
              </div>
            </div>
          </div>

          {/* Dynamic Moving Truck Node */}
          <div
            className="absolute transition-all duration-300 ease-out"
            style={{
              left: `${(truckX / 400) * 100}%`,
              top: `${(truckY / 140) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="relative flex items-center justify-center">
              {/* Pulsing glow if truck is currently shipped/transit */}
              {isInTransit && (
                <span className="absolute inset-0 rounded-full bg-pink-400/30 blur-md animate-ping" />
              )}

              {/* Stylized 3D Truck Container */}
              <div className="drop-shadow-[0_8px_20px_rgba(179,77,95,0.25)] relative z-20">
                <svg width="52" height="40" viewBox="0 0 48 36">
                  {/* Truck Cabin (Pure white) */}
                  <rect x="28" y="11" width="13" height="15" rx="3" fill="#FFFFFF" />
                  <path d="M40 15 L45 20 L45 26 L40 26 Z" fill="#E5E7EB" />
                  <rect x="31" y="13" width="7" height="5" rx="1.5" fill="#823341" opacity="0.2" />

                  {/* Cargo Container (Blush soft-pink with deep pink cargo) */}
                  <rect x="6" y="5" width="24" height="21" rx="4" fill="#FCECEF" />
                  <rect x="8" y="7" width="20" height="17" rx="3" fill="#B34D5F" />

                  {/* Gift Package lines on cargo container */}
                  <line x1="8" y1="15.5" x2="28" y2="15.5" stroke="#FFFFFF" strokeWidth="2.5" />
                  <line x1="18" y1="7" x2="18" y2="24" stroke="#FFFFFF" strokeWidth="2.5" />
                  {/* Bow Ribbon */}
                  <path
                    d="M15 10.5 Q18 12 18 15 Q18 12 21 10.5"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  {/* Wheels with silver hubcaps */}
                  <circle cx="14" cy="27" r="5" fill="#374151" />
                  <circle cx="14" cy="27" r="2" fill="#9CA3AF" />

                  {/* Back/Front Wheels */}
                  <circle cx="34" cy="27" r="5" fill="#374151" />
                  <circle cx="34" cy="27" r="2" fill="#9CA3AF" />

                  {/* Yellow headlights */}
                  <circle cx="44" cy="22" r="1.5" fill="#F59E0B" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Mode floating visual card */}
        {isDemo && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-[1001]">
            <div className="max-w-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#FCECEF] border border-[#F3DBDF] flex items-center justify-center mx-auto text-[#B34D5F] animate-bounce">
                <Activity size={24} />
              </div>
              <h3 className="font-display text-base font-extrabold text-[#823341]">
                تتبع شحنتك المباشرة
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                فور تأكيد طلبك وشحن المنتجات، ستتمكن من متابعة حركة الشحنة والوقت الاحتياطي للوصول
                مباشرة عبر هذه اللوحة التفاعلية.
              </p>
              <div className="pt-2">
                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D48995] to-[#B34D5F] text-white font-extrabold text-xs shadow-md shadow-pink-500/10 hover:brightness-105 active:scale-95 transition-all"
                >
                  <span>تسوقي الآن</span>
                  <ChevronLeft size={14} className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. BOTTOM CARD: Beautiful Pink/Blush Order Status & Action Overlay */}
      {!isDemo && order && (
        <div className="bg-white border border-[#F0D5D8] rounded-[32px] p-6 shadow-[0_12px_40px_rgba(179,77,95,0.06)] space-y-6">
          {/* Row 1: Order Number & Badge */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FCECEF] text-[#B34D5F]">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-bold leading-none mb-1">
                  رقم الطلب
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-display text-2xl font-black text-[#823341] tracking-wide leading-none">
                    #{order.order_number}
                  </span>
                  <button
                    type="button"
                    onClick={copyOrderId}
                    className="p-1 text-slate-400 hover:text-[#B34D5F] transition-colors rounded-lg"
                    title="نسخ رقم الطلب"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="text-right flex flex-col items-end">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#B34D5F] text-white px-4 py-1.5 text-xs font-black shadow-[0_4px_12px_rgba(179,77,95,0.15)]">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                {statusConfig.pill}
              </span>
              <span className="text-[10px] text-[#B34D5F] font-bold mt-1.5 block">
                {statusConfig.desc}
              </span>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-[#F0D5D8] to-transparent" />

          {/* Row 2: Estimated Time & 3-Circle Progress Line */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-[#FAF1F1]/50 border border-[#F0D5D8]/70 rounded-[24px] p-4">
            {/* Left Column: ETA Estimate */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FCECEF] text-[#B34D5F]">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-bold mb-0.5">
                  الوقت التقديري
                </span>
                <p className="font-black text-[#823341] text-sm sm:text-base leading-tight">
                  {statusConfig.eta}
                </p>
              </div>
            </div>

            {/* Right Column: 3-Circle Horizontal Timeline */}
            <div className="flex items-center justify-between gap-1 pt-3 sm:pt-0 sm:border-r sm:border-[#F0D5D8]/50 sm:pr-4">
              {/* Circle 1: تم التجهيز */}
              <div className="flex flex-col items-center text-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 ${
                    isPreparing || isInTransit || isDelivered
                      ? "bg-[#B34D5F] text-white border-[#B34D5F]"
                      : "bg-white text-slate-300 border-slate-200"
                  }`}
                >
                  <Check size={14} className="stroke-[3.5]" />
                </div>
                <span
                  className={`text-[10px] font-bold ${isPreparing ? "text-[#823341]" : "text-slate-400"}`}
                >
                  تم التجهيز
                </span>
              </div>

              {/* Connecting Line segment 1 */}
              <div
                className={`h-[2px] flex-1 ${isInTransit || isDelivered ? "bg-[#B34D5F]" : "bg-slate-200"}`}
              />

              {/* Circle 2: في الطريق */}
              <div className="flex flex-col items-center text-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 ${
                    isInTransit
                      ? "bg-[#B34D5F] text-white border-[#B34D5F] animate-pulse"
                      : isDelivered
                        ? "bg-[#FCECEF] text-[#B34D5F] border-[#B34D5F]"
                        : "bg-white text-slate-300 border-slate-200"
                  }`}
                >
                  {isDelivered ? (
                    <Check size={14} className="stroke-[3.5]" />
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="1" y="3" width="15" height="13" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold ${isInTransit ? "text-[#823341]" : "text-slate-400"}`}
                >
                  في الطريق
                </span>
              </div>

              {/* Connecting Line segment 2 */}
              <div className={`h-[2px] flex-1 ${isDelivered ? "bg-[#B34D5F]" : "bg-slate-200"}`} />

              {/* Circle 3: قريباً / تم التسليم */}
              <div className="flex flex-col items-center text-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 ${
                    isDelivered
                      ? "bg-[#10B981] text-white border-[#10B981]"
                      : "bg-white text-slate-300 border-slate-200"
                  }`}
                >
                  {isDelivered ? <Check size={14} className="stroke-[3.5]" /> : <Home size={12} />}
                </div>
                <span
                  className={`text-[10px] font-bold ${isDelivered ? "text-[#10B981]" : "text-slate-400"}`}
                >
                  {isDelivered ? "مكتمل" : "قريباً"}
                </span>
              </div>
            </div>
          </div>

          {/* Row 3: Elegant Phone Call & WhatsApp Contact Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <a
              href={`tel:${storePhone}`}
              className="flex items-center justify-center gap-2 bg-white border border-[#E9D2D6] text-[#823341] py-3.5 rounded-[18px] font-black text-xs hover:bg-[#FFF8F9] hover:border-[#B34D5F]/40 transition-all shadow-sm active:scale-95"
            >
              <Phone className="w-4 h-4 text-[#B34D5F]" />
              <span>اتصال بالمتجر</span>
            </a>

            <a
              href={whatsappLink(
                storeWhatsApp,
                `مرحباً ${storeName}، أود الاستفسار بخصوص طلبي رقم #${order.order_number}`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white border border-[#E9D2D6] text-[#823341] py-3.5 rounded-[18px] font-black text-xs hover:bg-[#FFF8F9] hover:border-[#B34D5F]/40 transition-all shadow-sm active:scale-95"
            >
              <MessageCircle className="w-4 h-4 text-[#10B981]" />
              <span>واتساب الشحنة</span>
            </a>
          </div>

          {/* Row 4: Custom Details Expandable CTA Button */}
          {onShowDetailsToggle && (
            <button
              onClick={onShowDetailsToggle}
              className="w-full flex items-center justify-between bg-gradient-to-r from-[#D48995] to-[#B34D5F] hover:opacity-95 text-white py-3.5 px-5 rounded-2xl font-extrabold text-sm shadow-[0_6px_20px_rgba(179,77,95,0.2)] transition-all active:scale-98"
            >
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span>تفاصيل الطلب والمنتجات</span>
              </div>
              <div className="flex items-center gap-1.5">
                {showDetailsState ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </div>
            </button>
          )}
        </div>
      )}

      {/* Footer Branding Ribbon nestled between thin divider lines */}
      <div className="flex items-center justify-center gap-3 py-4 text-[11px] font-extrabold text-[#823341]/80 select-none">
        <div className="h-px bg-[#EED2D6] flex-1" />
        <ShoppingCart className="h-3.5 w-3.5 text-[#B34D5F]" />
        <span>إيهاب ستور للعناية والتجميل</span>
        <div className="h-px bg-[#EED2D6] flex-1" />
      </div>
    </div>
  );
}
