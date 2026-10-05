import { useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Database,
  Eye,
  FileText,
  Flame,
  Gift,
  Globe,
  Layers,
  LayoutGrid,
  Megaphone,
  Monitor,
  Smartphone,
  MapPin,
  Package,
  PackageCheck,
  Palette,
  PhoneOff,
  Plus,
  Receipt,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  Target,
  Ticket,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import {
  statusColor,
  statusLabels,
  useAllProducts,
  useOrderItems,
  useOrders,
  useAdminCurrency,
  type Order,
} from "@/lib/admin";
import { formatMoney } from "@/lib/store";
import { SmartImage } from "@/components/SmartImage";
import { useAdminNavigation } from "@/lib/admin-navigation";
import { getDashboardStats } from "@/lib/admin/dashboard.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "الرئيسية | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminHome,
});

const DAY = 86400000;

type PeriodOption = "today" | "week" | "month" | "all" | "custom";

function AdminHome() {
  const navigate = useNavigate();
  const { data: orders = [], refetch: refetchOrders, isFetching } = useOrders();
  const { data: items = [] } = useOrderItems();
  const { data: products = [] } = useAllProducts();
  const { label } = useAdminCurrency();

  // إحصائيات الزوار (آخر 30 يوماً)
  const { data: pageViews = [] } = useQuery({
    queryKey: ["admin-page-views"],
    staleTime: 60000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * DAY).toISOString();
      const { data } = await (supabase as any)
        .from("page_views")
        .select("country,device,session_id,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000);
      return (data ?? []) as {
        country: string | null;
        device: string | null;
        session_id: string | null;
        created_at: string;
      }[];
    },
  });

  const visitorStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const weekAgo = Date.now() - 7 * DAY;
    const today = pageViews.filter((v) => v.created_at.slice(0, 10) === todayStr).length;
    const week = pageViews.filter((v) => new Date(v.created_at).getTime() >= weekAgo).length;
    const unique = new Set(pageViews.map((v) => v.session_id).filter(Boolean)).size;
    const countries = new Map<string, number>();
    const devices = new Map<string, number>();
    pageViews.forEach((v) => {
      if (v.country) countries.set(v.country, (countries.get(v.country) ?? 0) + 1);
      if (v.device) devices.set(v.device, (devices.get(v.device) ?? 0) + 1);
    });
    return {
      today,
      week,
      total: pageViews.length,
      unique,
      countries: [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      devices: [...devices.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [pageViews]);

  // Period filter state
  const [period, setPeriod] = useState<PeriodOption>("week");
  const [chartMetric, setChartMetric] = useState<"revenue" | "orders">("revenue");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const periodDays = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 60;
  const { data: serverStats } = useQuery({
    queryKey: ["admin", "dashboard-stats", periodDays],
    queryFn: () => getDashboardStats({ data: { days: periodDays } }),
    staleTime: 60_000,
  });

  // Filter orders based on chosen period
  const { filteredOrders, periodLabel, daysCount } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (period === "today") {
      const filtered = orders.filter((o) => o.created_at.slice(0, 10) === todayStr);
      return { filteredOrders: filtered, periodLabel: "اليوم", daysCount: 1 };
    }

    if (period === "week") {
      const since = Date.now() - 7 * DAY;
      const filtered = orders.filter((o) => new Date(o.created_at).getTime() >= since);
      return { filteredOrders: filtered, periodLabel: "آخر 7 أيام", daysCount: 7 };
    }

    if (period === "month") {
      const since = Date.now() - 30 * DAY;
      const filtered = orders.filter((o) => new Date(o.created_at).getTime() >= since);
      return { filteredOrders: filtered, periodLabel: "آخر 30 يوم", daysCount: 30 };
    }

    if (period === "custom" && customStart && customEnd) {
      const startMs = new Date(customStart).getTime();
      const endMs = new Date(customEnd).getTime() + DAY;
      const filtered = orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= startMs && t <= endMs;
      });
      const diffDays = Math.max(1, Math.round((endMs - startMs) / DAY));
      return {
        filteredOrders: filtered,
        periodLabel: `من ${customStart} إلى ${customEnd}`,
        daysCount: diffDays,
      };
    }

    return { filteredOrders: orders, periodLabel: "كافة الفترات", daysCount: 60 };
  }, [orders, period, customStart, customEnd]);

  // Calculations for filtered period
  const liveFiltered = filteredOrders.filter(
    (o) => o.status !== "cancelled" && o.status !== "returned",
  );
  const periodRevenue =
    serverStats && period !== "custom"
      ? serverStats.total_sales
      : liveFiltered.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const periodOrdersCount =
    serverStats && period !== "custom" ? serverStats.orders_count : filteredOrders.length;

  const avgOrderValue =
    serverStats && period !== "custom" && serverStats.avg_order_value
      ? serverStats.avg_order_value
      : periodOrdersCount > 0
        ? periodRevenue / (liveFiltered.length || 1)
        : 0;

  // Customers count
  const allPhones = new Set(orders.map((o) => o.phone).filter(Boolean));
  const totalCustomers = allPhones.size;

  const firstOrderByPhone = new Map<string, string>();
  [...orders]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .forEach((o) => {
      if (!firstOrderByPhone.has(o.phone)) firstOrderByPhone.set(o.phone, o.created_at);
    });
  const newCustomers30d = [...firstOrderByPhone.values()].filter(
    (d) => Date.now() - new Date(d).getTime() < 30 * DAY,
  ).length;

  // Products stock stats
  const totalProducts = products.length;
  const inStockProducts = products.filter((p) => p.stock > 0).length;
  const lowStock = products.filter((p) => p.stock <= 5);

  // Status follow-up queues
  const pendingPayments = orders.filter((o) => o.payment_status === "pending");
  const noContact = orders.filter((o) => o.status === "no_contact");
  const awaiting = orders.filter((o) => o.status === "new" || o.status === "reviewing");
  const late = orders.filter(
    (o) =>
      !["completed", "delivered", "cancelled", "returned"].includes(o.status) &&
      Date.now() - new Date(o.created_at).getTime() > 2 * DAY,
  );

  // Chart data calculation according to chosen period
  const chartData = useMemo(() => {
    const numDays = Math.min(daysCount, 30);
    const dayMap = new Map<string, { total: number; ordersCount: number }>();

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { total: 0, ordersCount: 0 });
    }

    filteredOrders.forEach((o) => {
      const key = o.created_at.slice(0, 10);
      if (dayMap.has(key)) {
        const curr = dayMap.get(key)!;
        const isLive = o.status !== "cancelled" && o.status !== "returned";
        dayMap.set(key, {
          total: curr.total + (isLive ? Number(o.total || 0) : 0),
          ordersCount: curr.ordersCount + 1,
        });
      }
    });

    return [...dayMap.entries()].map(([dateStr, val]) => {
      const dateObj = new Date(dateStr);
      return {
        date: dateStr,
        day:
          numDays <= 7
            ? dateObj.toLocaleDateString("ar-EG", { weekday: "short" })
            : dateObj.toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" }),
        total: Math.round(val.total),
        ordersCount: val.ordersCount,
      };
    });
  }, [filteredOrders, daysCount]);

  // Top selling products
  const topProducts = useMemo(() => {
    const soldCount = new Map<
      string,
      { qty: number; total: number; image?: string | undefined; id?: string | undefined }
    >();

    items.forEach((i) => {
      const prod = products.find((p) => p.name === i.product_name);
      const prev = soldCount.get(i.product_name) ?? {
        qty: 0,
        total: 0,
        image: prod?.images?.[0],
        id: prod?.id,
      };
      soldCount.set(i.product_name, {
        qty: prev.qty + i.quantity,
        total: prev.total + Number(i.price) * i.quantity,
        image: prev.image || prod?.images?.[0],
        id: prev.id || prod?.id,
      });
    });

    return [...soldCount.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
  }, [items, products]);

  const todayArabic = useMemo(() => {
    return new Intl.DateTimeFormat("ar-EG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  }, []);

  return (
    <div className="space-y-7 pb-10">
      {/* 1. Header Banner & Period Selector */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-soft transition-all">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>النظام متصل ومحدث</span>
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">• {todayArabic}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              لوحة التحكم المركزية
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground font-medium">
              نظرة عامة متكاملة على المبيعات، معالجة الطلبات، والمخزون، مع وصول سريع لكافة أدوات
              الإدارة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Selector Pills */}
            <div className="flex items-center rounded-2xl border border-border bg-secondary/50 p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setPeriod("today")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  period === "today"
                    ? "bg-card text-primary shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => setPeriod("week")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  period === "week"
                    ? "bg-card text-primary shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                هذا الأسبوع
              </button>
              <button
                type="button"
                onClick={() => setPeriod("month")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  period === "month"
                    ? "bg-card text-primary shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => setPeriod("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  period === "all"
                    ? "bg-card text-primary shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setPeriod("custom")}
                className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  period === "custom"
                    ? "bg-card text-primary shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>مخصص</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => void refetchOrders()}
              disabled={isFetching}
              title="تحديث البيانات"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {period === "custom" && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 animate-in fade-in">
            <span className="text-xs font-bold text-foreground">تحديد الفترة المخصصة:</span>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground">من:</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-xl border border-border bg-card px-2.5 py-1 text-xs outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground">إلى:</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-xl border border-border bg-card px-2.5 py-1 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Quick Action Command Hub (بطاقات الإجراءات السريعة بالأيقونات) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-extrabold text-foreground">إجراءات سريعة ومباشرة</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">الوصول الفوري للمهام الشائعة</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          <QuickActionCard
            to="/admin/products"
            icon={Plus}
            title="إضافة منتج"
            description="إدراج صنف جديد"
            accent="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:border-emerald-500/50"
          />
          <QuickActionCard
            to="/admin/orders"
            icon={ShoppingBag}
            title="إدارة الطلبات"
            description="متابعة الوارد"
            badge={orders.filter((o) => o.status === "new").length || undefined}
            accent="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:border-blue-500/50"
          />
          <QuickActionCard
            to="/admin/categories"
            icon={LayoutGrid}
            title="التصنيفات"
            description="هيكلة الأقسام"
            accent="bg-purple-500/10 text-purple-600 border-purple-500/20 hover:border-purple-500/50"
          />
          <QuickActionCard
            to="/admin/coupons"
            icon={Ticket}
            title="الكوبونات"
            description="خصومات وحملات"
            accent="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:border-amber-500/50"
          />
          <QuickActionCard
            to="/admin/meta"
            icon={Globe}
            title="إعلانات Meta"
            description="ربط Pixel و CAPI"
            accent="bg-sky-500/10 text-sky-600 border-sky-500/20 hover:border-sky-500/50"
          />
          <QuickActionCard
            to="/"
            target="_blank"
            icon={Eye}
            title="معاينة المتجر"
            description="عرض شاشة العميل"
            accent="bg-rose-500/10 text-rose-600 border-rose-500/20 hover:border-rose-500/50"
          />
        </div>
      </div>

      {/* 3. Primary KPI Cards Grid (بطاقات المؤشرات الرئيسية) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Total Revenue */}
        <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:border-primary/50 hover:shadow-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي المبيعات المحققة</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <Wallet className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground tabular-nums tracking-tight">
            {formatMoney(periodRevenue, label)}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
            <span>
              الفترة: <strong className="text-foreground">{periodLabel}</strong>
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
              <TrendingUp className="h-3 w-3" />
              <span>مؤكد</span>
            </span>
          </div>
        </div>

        {/* 2. Total Orders */}
        <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:border-blue-500/50 hover:shadow-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي عدد الطلبات</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 transition-transform group-hover:scale-110">
              <ShoppingBag className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground tabular-nums tracking-tight">
            {periodOrdersCount} <span className="text-sm font-bold text-muted-foreground">طلب</span>
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
            <span>متوسط قيمة الطلب:</span>
            <span className="font-extrabold text-foreground">
              {formatMoney(Math.round(avgOrderValue), label)}
            </span>
          </div>
        </div>

        {/* 3. Products in Stock */}
        <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:border-purple-500/50 hover:shadow-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">المنتجات في الكتالوج</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 transition-transform group-hover:scale-110">
              <Package className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground tabular-nums tracking-tight">
            {totalProducts} <span className="text-sm font-bold text-muted-foreground">منتج</span>
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
            <span>جاهز للتسليم الفوري:</span>
            <span className="font-extrabold text-emerald-600">{inStockProducts} صنف</span>
          </div>
        </div>

        {/* 4. Total Customers */}
        <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:border-amber-500/50 hover:shadow-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي قاعدة العملاء</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 transition-transform group-hover:scale-110">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground tabular-nums tracking-tight">
            {totalCustomers} <span className="text-sm font-bold text-muted-foreground">عميل</span>
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
            <span>انضموا خلال 30 يوم:</span>
            <span className="font-extrabold text-primary">+{newCustomers30d} عميل</span>
          </div>
        </div>
      </div>

      {/* 3.5 Visitors Analytics (إحصائيات الزوار) */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-sky-500" />
            <h2 className="text-sm font-extrabold text-foreground">زوار المتجر</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">آخر 30 يوماً</span>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
            <p className="text-[11px] font-bold text-muted-foreground">زيارات اليوم</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
              {visitorStats.today}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
            <p className="text-[11px] font-bold text-muted-foreground">زيارات الأسبوع</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
              {visitorStats.week}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
            <p className="text-[11px] font-bold text-muted-foreground">إجمالي الزيارات</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
              {visitorStats.total}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
            <p className="text-[11px] font-bold text-muted-foreground">زوار فريدون</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
              {visitorStats.unique}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {/* الدول */}
          <div className="rounded-2xl border border-border/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-500" />
              <h3 className="text-xs font-extrabold text-foreground">الزيارات حسب الدولة</h3>
            </div>
            {visitorStats.countries.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                لا توجد بيانات دول بعد — تظهر تلقائياً عند نشر الموقع وزيارة العملاء.
              </p>
            ) : (
              <div className="space-y-2">
                {visitorStats.countries.map(([country, count]) => (
                  <div key={country} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">{country}</span>
                    <div className="flex flex-1 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{
                            width: `${Math.round((count / (visitorStats.countries[0]?.[1] || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-extrabold tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* الأجهزة */}
          <div className="rounded-2xl border border-border/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-500" />
              <h3 className="text-xs font-extrabold text-foreground">الزيارات حسب الجهاز</h3>
            </div>
            {visitorStats.devices.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">لا توجد زيارات مسجلة بعد.</p>
            ) : (
              <div className="space-y-2">
                {visitorStats.devices.map(([device, count]) => {
                  const pct = Math.round((count / (visitorStats.total || 1)) * 100);
                  return (
                    <div key={device} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        {device === "جوال" ? (
                          <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {device}
                      </span>
                      <div className="flex flex-1 items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-extrabold tabular-nums text-muted-foreground">
                          {count} ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Order Statuses Overview (بطاقات مسار الطلبات التفاعلية) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-extrabold text-foreground">مسار تدفق الطلبات وحالاتها</h2>
          <span className="text-[11px] text-muted-foreground">
            انقر على أي حالة لتصفية الطلبات فوراً
          </span>
        </div>

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatusCard
            icon={Clock}
            label="طلبات جديدة"
            count={orders.filter((o) => o.status === "new").length}
            tone="text-blue-600 bg-blue-500/10 border-blue-500/25 hover:border-blue-500/60"
            onClick={() => void navigate({ to: "/admin/orders", search: { status: "new" } })}
          />
          <StatusCard
            icon={Package}
            label="قيد التجهيز"
            count={orders.filter((o) => o.status === "processing").length}
            tone="text-purple-600 bg-purple-500/10 border-purple-500/25 hover:border-purple-500/60"
            onClick={() => void navigate({ to: "/admin/orders", search: { status: "processing" } })}
          />
          <StatusCard
            icon={Truck}
            label="تم الشحن للتوصيل"
            count={orders.filter((o) => o.status === "shipped").length}
            tone="text-cyan-600 bg-cyan-500/10 border-cyan-500/25 hover:border-cyan-500/60"
            onClick={() => void navigate({ to: "/admin/orders", search: { status: "shipped" } })}
          />
          <StatusCard
            icon={CheckCircle2}
            label="مكتملة ومستلمة"
            count={orders.filter((o) => o.status === "completed").length}
            tone="text-emerald-600 bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/60"
            onClick={() => void navigate({ to: "/admin/orders", search: { status: "completed" } })}
          />
          <StatusCard
            icon={XCircle}
            label="ملغية أو مرتجعة"
            count={orders.filter((o) => o.status === "cancelled" || o.status === "returned").length}
            tone="text-rose-600 bg-rose-500/10 border-rose-500/25 hover:border-rose-500/60"
            onClick={() => void navigate({ to: "/admin/orders", search: { status: "cancelled" } })}
          />
          <StatusCard
            icon={CreditCard}
            label="مدفوعات قيد المراجعة"
            count={pendingPayments.length}
            tone="text-amber-600 bg-amber-500/10 border-amber-500/25 hover:border-amber-500/60"
            onClick={() => void navigate({ to: "/admin/orders", search: { payment: "pending" } })}
          />
        </div>
      </div>

      {/* 5. Organized Operational Hub Modules (بطاقات منظومة الوصول المنظم على شكل بطاقات وأيقونات) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-extrabold text-foreground">خريطة أقسام لوحة التحكم</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">
            تنظيم هيكلي مبسط لجميع وحدات الإدارة
          </span>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          {/* Module 1: Sales & Orders */}
          <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/40 hover:shadow-lift">
            <div>
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-foreground">إدارة المبيعات والطلبات</h3>
                    <p className="text-[10px] text-muted-foreground">
                      العمليات ومتابعة الفواتير والزبائن
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 space-y-1.5">
                <ModuleLinkItem
                  to="/admin/orders"
                  icon={ShoppingBag}
                  title="الطلبات وتفاصيلها"
                  badge={`${orders.length} طلب`}
                />
                <ModuleLinkItem
                  to="/admin/invoices"
                  icon={Receipt}
                  title="الفواتير وسندات القبض"
                  badge="إصدار وطباعة"
                />
                <ModuleLinkItem
                  to="/admin/customers"
                  icon={Users}
                  title="قاعدة بيانات العملاء"
                  badge={`${totalCustomers} عميل`}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50">
              <Link
                to="/admin/orders"
                className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary hover:text-primary transition"
              >
                <span>فتح شاشة الطلبات</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Module 2: Products & Catalog */}
          <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/40 hover:shadow-lift">
            <div>
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-foreground">الكتالوج والمخزون</h3>
                    <p className="text-[10px] text-muted-foreground">
                      المنتجات، التصنيفات، والألوان
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 space-y-1.5">
                <ModuleLinkItem
                  to="/admin/products"
                  icon={Package}
                  title="قائمة كافة المنتجات"
                  badge={`${totalProducts} صنف`}
                />
                <ModuleLinkItem
                  to="/admin/categories"
                  icon={LayoutGrid}
                  title="الأقسام والشجرة الهرمية"
                  badge="تصفح الأقسام"
                />
                <ModuleLinkItem
                  to="/admin/inventory"
                  icon={Boxes}
                  title="جرد ومتابعة المخزون"
                  badge={lowStock.length > 0 ? `${lowStock.length} حرج` : "سليم"}
                  badgeColor={lowStock.length > 0 ? "text-amber-600 bg-amber-500/15" : undefined}
                />
                <ModuleLinkItem
                  to="/admin/bulk-editor"
                  icon={LayoutGrid}
                  title="التعديل الجماعي والأسعار"
                  badge="تحديث سريع"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50">
              <Link
                to="/admin/products"
                className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary hover:text-primary transition"
              >
                <span>إدارة كتالوج المنتجات</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Module 3: Marketing & Meta */}
          <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/40 hover:shadow-lift">
            <div>
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-foreground">التسويق والإعلانات</h3>
                    <p className="text-[10px] text-muted-foreground">
                      ربط Meta، الكوبونات، والولاء
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 space-y-1.5">
                <ModuleLinkItem
                  to="/admin/meta"
                  icon={Globe}
                  title="Meta Pixel & CAPI"
                  badge="تتبع الخادم"
                />
                <ModuleLinkItem
                  to="/admin/coupons"
                  icon={Ticket}
                  title="كوبونات التخفيض"
                  badge="حملات ترويجية"
                />
                <ModuleLinkItem
                  to="/admin/banners"
                  icon={Megaphone}
                  title="البانرات والعروض العلوية"
                  badge="إدارة الواجهة"
                />
                <ModuleLinkItem
                  to="/admin/loyalty"
                  icon={Gift}
                  title="برنامج الولاء والنقاط"
                  badge="مكافآت الزبائن"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50">
              <Link
                to="/admin/meta"
                className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary hover:text-primary transition"
              >
                <span>إعدادات وتتبع الإعلانات</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Module 4: System & Infrastructure */}
          <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/40 hover:shadow-lift">
            <div>
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-foreground">الإعدادات والعمليات</h3>
                    <p className="text-[10px] text-muted-foreground">
                      الدفع، الشحن، العملات، والصلاحيات
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 space-y-1.5">
                <ModuleLinkItem
                  to="/admin/payments"
                  icon={CreditCard}
                  title="طرق الدفع والحسابات"
                  badge="حوالات وبنوك"
                />
                <ModuleLinkItem
                  to="/admin/delivery"
                  icon={Truck}
                  title="مناطق ورسوم التوصيل"
                  badge="المحافظات"
                />
                <ModuleLinkItem
                  to="/admin/currencies"
                  icon={Coins}
                  title="أسعار صرف العملات"
                  badge={label}
                />
                <ModuleLinkItem
                  to="/admin/users"
                  icon={UserCog}
                  title="المستخدمون والأدوار"
                  badge="إدارة الصلاحيات"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50">
              <Link
                to="/admin/site-settings"
                className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary hover:text-primary transition"
              >
                <span>ضبط إعدادات المتجر</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Charts & Top Selling Products Section */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main Chart Card */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-foreground">
                  تحليل الأداء والمبيعات ({periodLabel})
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  توزيع حجم المبيعات وتدفق الطلبات على مدار الفترة
                </p>
              </div>

              {/* Metric Toggle: Revenue vs Orders */}
              <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/40 p-1">
                <button
                  type="button"
                  onClick={() => setChartMetric("revenue")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    chartMetric === "revenue"
                      ? "bg-card text-primary shadow-xs font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  المبيعات ({label})
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric("orders")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    chartMetric === "orders"
                      ? "bg-card text-primary shadow-xs font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  عدد الطلبات
                </button>
              </div>
            </div>

            {/* Chart Container */}
            <div className="mt-5 h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "currentColor", opacity: 0.7 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "currentColor", opacity: 0.7 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [
                      chartMetric === "revenue" ? formatMoney(Number(v), label) : `${v} طلب`,
                      chartMetric === "revenue" ? "المبيعات" : "عدد الطلبات",
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "1rem",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar
                    dataKey={chartMetric === "revenue" ? "total" : "ordersCount"}
                    fill="hsl(var(--primary))"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span>
              متوسط المبيعات اليومية:{" "}
              <strong className="text-foreground">
                {formatMoney(Math.round(periodRevenue / Math.max(1, chartData.length)), label)}
              </strong>
            </span>
            <span>
              أيام الرصد: <strong className="text-foreground">{chartData.length} يوم</strong>
            </span>
          </div>
        </div>

        {/* Top Selling Products Card */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-extrabold text-foreground">الأكثر مبيعاً ورواجاً</h2>
              </div>
              <Link
                to="/admin/products"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>الكتالوج</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <ul className="mt-3 divide-y divide-border/60">
              {topProducts.map(([name, data], idx) => (
                <li key={name} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                        idx === 0
                          ? "bg-amber-400 text-amber-950 font-black shadow-xs"
                          : idx === 1
                            ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-bold"
                            : idx === 2
                              ? "bg-amber-700/20 text-amber-800 dark:text-amber-300 font-bold"
                              : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <SmartImage
                      paths={data.image ? [data.image] : []}
                      fallback="/favicon.png"
                      alt={name}
                      className="h-9 w-9 shrink-0 rounded-xl border border-border object-cover"
                    />
                    <span className="truncate text-xs font-bold text-foreground">{name}</span>
                  </div>
                  <div className="text-end shrink-0">
                    <span className="block text-xs font-black text-primary">{data.qty} قطعة</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {formatMoney(data.total, label)}
                    </span>
                  </div>
                </li>
              ))}

              {topProducts.length === 0 && (
                <li className="py-10 text-center text-xs text-muted-foreground">
                  لا توجد مبيعات مسجلة حتى الآن
                </li>
              )}
            </ul>
          </div>

          <div className="mt-4 border-t border-border/70 pt-3">
            <Link
              to="/admin/inventory"
              className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >
              <span className="flex items-center gap-2">
                <Boxes className="h-3.5 w-3.5 text-purple-500" />
                <span>فحص ومزامنة كميات المخزن</span>
              </span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 7. Critical Stock Alert Banner */}
      {lowStock.length > 0 && (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4.5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                <PackageCheck className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-black text-amber-900 dark:text-amber-200">
                  تنبيه المخزون الحرج: ({lowStock.length}) أصناف تقترب من النفاد التام (≤ 5 قطع)
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  يُرجى توريد كميات إضافية لتفادي تعطل عمليات الشراء والتوصيل للزبائن.
                </p>
              </div>
            </div>
            <Link
              to="/admin/inventory"
              className="rounded-xl gradient-gold px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-95"
            >
              فتح شاشة الجرد
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {lowStock.slice(0, 8).map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/25 bg-card/90 px-3 py-1 text-[11px] font-bold text-foreground"
              >
                <span className="truncate max-w-[140px]">{p.name}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                    p.stock === 0
                      ? "bg-rose-500/20 text-rose-600"
                      : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {p.stock === 0 ? "نفد كلياً" : `${p.stock} قطع`}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 8. Follow-up Priority Queues (بطاقات المتابعة العاجلة للمدير) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-extrabold text-foreground">طابور المتابعة العاجلة</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">مهام تتطلب تدخلاً تشغيلياً</span>
        </div>

        <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-4">
          <FollowUpCard
            title="بانتظار التأكيد"
            icon={Clock}
            orders={awaiting}
            label={label}
            tone="border-blue-500/25 hover:border-blue-500/50"
          />
          <FollowUpCard
            title="تعذر التواصل مع العميل"
            icon={PhoneOff}
            orders={noContact}
            label={label}
            tone="border-rose-500/25 hover:border-rose-500/50"
          />
          <FollowUpCard
            title="طلبات متأخرة (> 48س)"
            icon={AlertTriangle}
            orders={late}
            label={label}
            tone="border-amber-500/25 hover:border-amber-500/50"
          />
          <FollowUpCard
            title="إثباتات دفع قيد المراجعة"
            icon={CreditCard}
            orders={pendingPayments}
            label={label}
            tone="border-purple-500/25 hover:border-purple-500/50"
          />
        </div>
      </div>

      {/* 9. Recent Orders Table (بطاقة أحدث الطلبات الواردة) */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-extrabold text-foreground">أحدث الطلبات الواردة</h2>
          </div>
          <Link
            to="/admin/orders"
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            <span>عرض كل الطلبات ({orders.length})</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground font-bold">
                <th className="py-2.5 px-3">رقم الطلب</th>
                <th className="py-2.5 px-3">العميل</th>
                <th className="py-2.5 px-3">المدينة والمحافظة</th>
                <th className="py-2.5 px-3">الحالة الحالية</th>
                <th className="py-2.5 px-3">الإجمالي</th>
                <th className="py-2.5 px-3 text-center">إجراء فوري</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {orders.slice(0, 6).map((o) => (
                <tr key={o.id} className="transition-colors hover:bg-secondary/40">
                  <td className="py-3 px-3 font-black text-foreground">#{o.order_number}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-foreground block">{o.customer_name}</span>
                    <span dir="ltr" className="text-[10px] text-muted-foreground block">
                      {o.phone}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{o.city || "—"}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black ${statusColor[o.status]}`}
                    >
                      {statusLabels[o.status]}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-black text-primary">
                    {formatMoney(Number(o.total), o.currency_label || label)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        void navigate({ to: "/admin/orders", search: { order: o.id } })
                      }
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1 text-[11px] font-bold text-foreground hover:border-primary hover:text-primary transition active:scale-95"
                    >
                      <Eye className="h-3 w-3" />
                      <span>تفاصيل</span>
                    </button>
                  </td>
                </tr>
              ))}

              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">
                    لا توجد طلبات واردة في النظام حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Helper Components: Clean Card & Icon Architectures
// ----------------------------------------------------

function QuickActionCard({
  to,
  icon: Icon,
  title,
  description,
  accent,
  badge,
  target,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: string;
  badge?: number | undefined;
  target?: string | undefined;
}) {
  const { config } = useAdminNavigation();
  if (config[to]?.hidden) return null;
  const disabled = config[to]?.disabled ?? false;
  return (
    <Link
      to={disabled ? "/admin" : to}
      aria-disabled={disabled}
      {...(target ? { target } : {})}
      className={`group relative flex flex-col items-center justify-center rounded-2xl border p-3.5 text-center shadow-soft transition-all duration-200 bg-card ${disabled ? "pointer-events-none cursor-not-allowed opacity-40" : "hover:-translate-y-0.5 hover:shadow-lift"} ${accent}`}
    >
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-xs">
          {badge}
        </span>
      )}
      <div className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110">
        <Icon className="h-5 w-5" />
      </div>
      <span className="mt-2 text-xs font-black text-foreground">{title}</span>
      <span className="text-[10px] text-muted-foreground font-medium">{description}</span>
    </Link>
  );
}

function StatusCard({
  icon: Icon,
  label,
  count,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  tone: string;
  onClick: () => void;
}) {
  const { config } = useAdminNavigation();
  const disabled = config["/admin/orders"]?.disabled ?? false;
  if (config["/admin/orders"]?.hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border p-3.5 text-right shadow-soft transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 hover:-translate-y-0.5 hover:shadow-lift active:scale-95 ${tone}`}
    >
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4" />
        <span className="text-lg font-black tabular-nums">{count}</span>
      </div>
      <p className="mt-2 text-[11px] font-bold text-muted-foreground">{label}</p>
    </button>
  );
}

function ModuleLinkItem({
  to,
  icon: Icon,
  title,
  badge,
  badgeColor,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string | undefined;
  badgeColor?: string | undefined;
}) {
  const { config } = useAdminNavigation();
  if (config[to]?.hidden) return null;
  const disabled = config[to]?.disabled ?? false;
  return (
    <Link
      to={disabled ? "/admin" : to}
      aria-disabled={disabled}
      className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground transition ${disabled ? "pointer-events-none cursor-not-allowed opacity-40" : "hover:bg-secondary/80 hover:text-foreground"}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary/80" />
        <span className="font-semibold text-foreground text-[11px]">{title}</span>
      </div>
      {badge && (
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            badgeColor || "bg-secondary text-muted-foreground"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function FollowUpCard({
  title,
  icon: Icon,
  orders,
  label,
  tone,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  orders: Order[];
  label: string;
  tone: string;
}) {
  const navigate = useNavigate();

  return (
    <div className={`rounded-3xl border bg-card p-4 shadow-soft transition-all ${tone}`}>
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <span className="flex items-center gap-1.5 text-xs font-extrabold text-foreground">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span>{title}</span>
        </span>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-black text-foreground">
          {orders.length}
        </span>
      </div>

      <ul className="mt-2.5 divide-y divide-border/40 text-xs">
        {orders.slice(0, 3).map((o) => (
          <li
            key={o.id}
            onClick={() => void navigate({ to: "/admin/orders", search: { order: o.id } })}
            className="flex cursor-pointer items-center justify-between py-2 hover:text-primary transition"
          >
            <span className="font-bold text-foreground">#{o.order_number}</span>
            <span className="truncate max-w-[90px] text-[11px] text-muted-foreground">
              {o.customer_name}
            </span>
            <span className="font-extrabold text-primary">
              {formatMoney(Number(o.total), o.currency_label ?? label)}
            </span>
          </li>
        ))}

        {orders.length === 0 && (
          <li className="py-4 text-center text-[11px] text-muted-foreground">
            لا توجد طلبات معلقة في هذه الفئة
          </li>
        )}
      </ul>
    </div>
  );
}
