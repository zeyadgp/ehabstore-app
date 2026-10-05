import { csvSafe } from "@/lib/csv-safe";
import { useEffect, useState, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Filter,
  LayoutGrid,
  List,
  MessageCircle,
  Phone,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { syncOrderPoints } from "@/lib/loyalty.functions";
import { updateOrderCommissionStatus } from "@/lib/commissions.functions";
import {
  paymentStatusLabels,
  statusColor,
  statusLabels,
  statusOrder,
  useOrderItems,
  useOrders,
  useWhatsappMessages,
  type Order,
  type OrderStatus,
  useAdminCurrency,
} from "@/lib/admin";
import { formatMoney, useSettings } from "@/lib/store";
import { whatsappLink } from "@/lib/whatsapp";
import {
  fillTemplate,
  loadWaTemplates,
  saveWaTemplates,
  waTemplateLabels,
  type WaTemplateKey,
} from "@/lib/wa-templates";
import { useAdmin } from "@/hooks/useAdmin";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  DEFAULT_WHATSAPP_AUTOMATION,
  getWhatsappAutomation,
  saveWhatsappAutomation,
  sendAutomaticOrderStatus,
} from "@/lib/whatsapp-automation.functions";

export const Route = createFileRoute("/admin/orders")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { order?: string | undefined; status?: string | undefined; payment?: string | undefined } => ({
    ...(typeof s["order"] === "string" ? { order: s["order"] } : {}),
    ...(typeof s["status"] === "string" ? { status: s["status"] } : {}),
    ...(typeof s["payment"] === "string" ? { payment: s["payment"] } : {}),
  }),
  component: AdminOrders,
});

function playOrderChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    /* Audio context might be restricted before interaction */
  }
}

/** مسار الحالة المتتابع: كل حالة لها إجراء تالٍ واحد فقط. */
const nextStatusMap: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "confirmed",
  reviewing: "confirmed",
  confirmed: "processing",
  processing: "shipped",
  ready: "shipped",
  shipped: "delivered",
  delivered: "completed",
  on_hold: "confirmed",
  no_contact: "confirmed",
};

const nextActionLabels: Partial<Record<OrderStatus, string>> = {
  confirmed: "تأكيد الطلب",
  processing: "جاري التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  completed: "إنهاء الطلب",
};

function nextStatusOf(s: OrderStatus): OrderStatus | null {
  return nextStatusMap[s] ?? null;
}

function AdminOrders() {
  const { order: focusId } = Route.useSearch();
  const qc = useQueryClient();
  const { can, isViewer } = useAdmin();
  const canManageOrders = can("manage_orders") && !isViewer;
  const canDeleteOrders = can("delete_orders") && !isViewer;

  const { data: orders = [] } = useOrders();
  const { data: items = [] } = useOrderItems();
  const { data: messages = [] } = useWhatsappMessages();
  const { data: settings } = useSettings();
  const { label } = useAdminCurrency();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [templates, setTemplates] = useState(() => loadWaTemplates());
  const [editTemplates, setEditTemplates] = useState(false);
  const [packingSlipOrder, setPackingSlipOrder] = useState<Order | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    return (
      (typeof window !== "undefined" &&
        (localStorage.getItem("admin_orders_view") as "list" | "kanban")) ||
      "list"
    );
  });
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "highest" | "oldest">("newest");
  const [page, setPage] = useState(0);
  const [debouncedQ, setDebouncedQ] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(0);
  }, [filter, paymentFilter, dateFilter, sortOrder]);

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return typeof window !== "undefined" && localStorage.getItem("admin_order_chime") === "true";
  });
  const prevOrderCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      prevOrderCountRef.current !== null &&
      orders.length > prevOrderCountRef.current &&
      soundEnabled
    ) {
      playOrderChime();
      toast.info("🔔 تم استلام طلب جديد في المتجر!");
    }
    prevOrderCountRef.current = orders.length;
  }, [orders.length, soundEnabled]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("admin_order_chime", String(next));
    if (next) {
      playOrderChime();
      toast.success("تم تفعيل التنبيه الصوتي للطلبات الجديدة");
    } else {
      toast.info("تم كتم التنبيه الصوتي");
    }
  };

  const syncPoints = useServerFn(syncOrderPoints);
  const syncCommission = useServerFn(updateOrderCommissionStatus);
  const loadAutomation = useServerFn(getWhatsappAutomation);
  const saveAutomation = useServerFn(saveWhatsappAutomation);
  const sendAutoStatus = useServerFn(sendAutomaticOrderStatus);
  const { data: automation = DEFAULT_WHATSAPP_AUTOMATION } = useQuery({
    queryKey: ["admin", "whatsapp-automation"],
    queryFn: () => loadAutomation(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "orders"] });

  const setStatus = async (o: Order, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", o.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث حالة الطلب");
    if (["confirmed", "processing", "shipped", "delivered"].includes(status)) {
      try {
        const result = await sendAutoStatus({
          data: {
            orderId: o.id,
            status: status as "confirmed" | "processing" | "shipped" | "delivered",
          },
        });
        if (result.sent) toast.success("تم إرسال تحديث واتساب تلقائياً");
      } catch {
        toast.info("تم تحديث الطلب، وتعذر إرسال واتساب تلقائياً");
      }
    }
    if (["completed", "delivered", "cancelled", "returned"].includes(status)) {
      const mapped =
        status === "delivered" ? "completed" : status === "returned" ? "cancelled" : status;
      try {
        const res = await syncPoints({
          data: { orderId: o.id, status: mapped as "completed" | "cancelled" },
        });
        if (res.ok && res.points > 0) toast.success(`تم اعتماد ${res.points} نقطة ولاء للعميل`);
        if (res.ok && res.points < 0) toast.info("تم إلغاء نقاط هذا الطلب");
        await qc.invalidateQueries({ queryKey: ["admin", "loyalty-accounts"] });
        await qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
      } catch {
        /* نظام الولاء اختياري */
      }

      // مزامنة وعكس العمولات عند تغيير الحالة
      try {
        const commRes = await syncCommission({
          data: { orderId: o.id, status: mapped },
        });
        if (commRes.status === "reversed") {
          toast.info("تم عكس العمولات المرتبطة بهذا الطلب");
        } else if (commRes.status === "settled" && (commRes.amountCents ?? 0) > 0) {
          toast.success("تم تسوية عمولة الأرباح للطلب");
        }
      } catch {
        /* ignore */
      }
    }
    await refresh();
  };

  const setPayment = async (o: Order, payment_status: string) => {
    const { error } = await supabase.from("orders").update({ payment_status }).eq("id", o.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("invoices").update({ payment_status }).eq("order_id", o.id);
    toast.success("تم تحديث حالة الدفع");
    await refresh();
    await qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
  };

  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setDeleteLoading(true);
    try {
      await supabase.from("order_items").delete().eq("order_id", orderToDelete.id);
      const { error } = await supabase.from("orders").delete().eq("id", orderToDelete.id);
      if (error) {
        toast.error("تعذر حذف الطلب. حاول مرة أخرى.");
        return;
      }
      toast.success("تم حذف الطلب بنجاح.");
      setOrderToDelete(null);
      await refresh();
      await qc.invalidateQueries({ queryKey: ["admin", "order-items"] });
    } catch {
      toast.error("تعذر الاتصال بالخادم.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const sendTemplate = async (o: Order, key: WaTemplateKey) => {
    const currency = o.currency_label ?? label;
    const body = fillTemplate(templates[key], {
      name: o.customer_name,
      order: o.order_number,
      total: formatMoney(Number(o.total), currency),
      city: o.city,
      store: settings?.store_name ?? "متجرنا",
      delivery: formatMoney(Number(o.delivery_fee ?? 0), currency),
    });
    window.open(whatsappLink(o.phone, body), "_blank", "noopener");
    await supabase
      .from("whatsapp_messages")
      .insert({ order_id: o.id, phone: o.phone, template: key, body });
    await supabase
      .from("orders")
      .update({ last_contact_at: new Date().toISOString() })
      .eq("id", o.id);
    await refresh();
    await qc.invalidateQueries({ queryKey: ["admin", "wa-messages"] });
  };

  useEffect(() => {
    if (focusId) setOpen(focusId);
  }, [focusId]);

  const today = new Date().toDateString();
  const inStatus = (s: OrderStatus[]) => orders.filter((o) => s.includes(o.status)).length;
  const stats = [
    { label: "إجمالي الطلبات", value: String(orders.length), tone: "bg-secondary text-foreground" },
    {
      label: "طلبات اليوم",
      value: String(orders.filter((o) => new Date(o.created_at).toDateString() === today).length),
      tone: "bg-primary/10 text-primary border border-primary/20",
    },
    {
      label: "جديدة",
      value: String(inStatus(["new", "reviewing"])),
      tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    },
    {
      label: "قيد التجهيز",
      value: String(inStatus(["confirmed", "processing", "ready"])),
      tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
    },
    {
      label: "قيد الشحن",
      value: String(inStatus(["shipped"])),
      tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
    },
    {
      label: "مكتملة",
      value: String(inStatus(["delivered", "completed"])),
      tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    },
    {
      label: "مدفوعات معلقة",
      value: String(orders.filter((o) => (o.payment_status ?? "unpaid") === "pending").length),
      tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    },
  ];

  const getElapsedInfo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.max(0, Math.floor(diffMs / (60 * 1000)));
    if (diffMins < 60) return { label: `منذ ${diffMins} دقيقة`, isLate: false };
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return { label: `منذ ${diffHours} ساعة`, isLate: false };
    const diffDays = Math.floor(diffHours / 24);
    return { label: `منذ ${diffDays} يوم`, isLate: diffHours >= 24 };
  };

  const quickNextStatusMap: Partial<Record<OrderStatus, OrderStatus>> = {
    new: "confirmed",
    reviewing: "confirmed",
    confirmed: "processing",
    processing: "shipped",
    ready: "shipped",
    shipped: "delivered",
  };
  const quickNextLabels: Partial<Record<OrderStatus, string>> = {
    new: "تأكيد الطلب",
    reviewing: "تأكيد الطلب",
    confirmed: "تجهيز الشحنة",
    processing: "شحن الطلب",
    ready: "شحن الطلب",
    shipped: "تم التسليم",
  };

  const kanbanColumns: Array<{
    id: string;
    title: string;
    statuses: OrderStatus[];
    tone: string;
    badge: string;
  }> = [
    {
      id: "new_orders",
      title: "طلبات جديدة",
      statuses: ["new", "reviewing"],
      tone: "border-amber-500/30 bg-amber-500/5",
      badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    },
    {
      id: "processing_orders",
      title: "قيد التجهيز والتأكيد",
      statuses: ["confirmed", "processing", "ready"],
      tone: "border-indigo-500/30 bg-indigo-500/5",
      badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
    },
    {
      id: "shipped_orders",
      title: "قيد الشحن",
      statuses: ["shipped"],
      tone: "border-sky-500/30 bg-sky-500/5",
      badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
    },
    {
      id: "delivered_orders",
      title: "مكتملة ومستلمة",
      statuses: ["delivered", "completed"],
      tone: "border-emerald-500/30 bg-emerald-500/5",
      badge:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    },
    {
      id: "cancelled_orders",
      title: "ملغية أو راجعة",
      statuses: ["cancelled", "returned", "no_contact", "on_hold"],
      tone: "border-rose-500/30 bg-rose-500/5",
      badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    },
  ];

  const nowTime = Date.now();
  const list = orders
    .filter((o) => filter === "all" || o.status === filter)
    .filter((o) => {
      if (paymentFilter === "all") return true;
      const ps = o.payment_status ?? "unpaid";
      if (paymentFilter === "paid") return ps === "paid";
      if (paymentFilter === "pending") return ps === "pending";
      if (paymentFilter === "unpaid") return ps === "unpaid" || ps === "failed";
      return true;
    })
    .filter((o) => {
      if (dateFilter === "all") return true;
      const created = new Date(o.created_at).getTime();
      const diffMs = nowTime - created;
      if (dateFilter === "today") return new Date(o.created_at).toDateString() === today;
      if (dateFilter === "week") return diffMs <= 7 * 24 * 60 * 60 * 1000;
      if (dateFilter === "month") return diffMs <= 30 * 24 * 60 * 60 * 1000;
      return true;
    })
    .filter((o) => {
      if (!debouncedQ.trim()) return true;
      const needle = debouncedQ.trim().toLowerCase();
      const orderItems = items.filter((i) => i.order_id === o.id);
      return (
        String(o.order_number).includes(needle) ||
        o.customer_name.toLowerCase().includes(needle) ||
        o.phone.includes(needle) ||
        o.city.toLowerCase().includes(needle) ||
        orderItems.some((i) => i.product_name.toLowerCase().includes(needle))
      );
    })
    .sort((a, b) => {
      if (sortOrder === "highest") return Number(b.total) - Number(a.total);
      if (sortOrder === "oldest")
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const pagedList = list.slice(page * pageSize, (page + 1) * pageSize);

  const exportOrdersCSV = () => {
    if (list.length === 0) {
      toast.error("لا توجد طلبات لتصديرها");
      return;
    }
    const headers = [
      "رقم الطلب",
      "تاريخ الطلب",
      "اسم العميل",
      "الهاتف",
      "المدينة",
      "الحي",
      "العنوان",
      "الحالة",
      "حالة الدفع",
      "الإجمالي",
      "العملة",
      "طريقة الدفع",
      "ملاحظات",
    ];
    const rows = list.map((o) => [
      o.order_number,
      new Date(o.created_at).toLocaleDateString("ar-EG"),
      `"${(o.customer_name || "").replace(/"/g, '""')}"`,
      `"${o.phone}"`,
      `"${(o.city || "").replace(/"/g, '""')}"`,
      `"${(o.district || "").replace(/"/g, '""')}"`,
      `"${(o.address || "").replace(/"/g, '""')}"`,
      `"${statusLabels[o.status] || o.status}"`,
      `"${paymentStatusLabels[o.payment_status ?? "unpaid"] || o.payment_status}"`,
      o.total,
      `"${o.currency_label || label}"`,
      `"${(o.payment_method || "").replace(/"/g, '""')}"`,
      `"${(o.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.map(csvSafe).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير ملف الطلبات (CSV) بنجاح");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground md:text-3xl">
            إدارة الطلبات
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            متابعة دورة حياة الطلبات، تحديث الحالات، إدارة المدفوعات والتواصل عبر واتساب.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleSound}
            title={soundEnabled ? "كتم التنبيه الصوتي" : "تفعيل التنبيه الصوتي للطلبات الجديدة"}
            className={`flex items-center gap-1.5 rounded-2xl border px-3.5 py-2.5 text-xs font-extrabold shadow-soft transition-all duration-150 active:scale-95 ${
              soundEnabled
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            <span>{soundEnabled ? "التنبيه مفعل" : "تنبيه صوتي"}</span>
          </button>
          <button
            onClick={exportOrdersCSV}
            className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-xs font-extrabold text-foreground shadow-soft transition-all duration-150 hover:bg-secondary hover:text-primary active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span>تصدير CSV</span>
          </button>
          <button
            onClick={() => setEditTemplates((v) => !v)}
            className="rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-extrabold text-foreground shadow-soft transition-all duration-150 hover:bg-secondary hover:text-primary active:scale-95"
          >
            {editTemplates ? "إغلاق قوالب الواتساب" : "قوالب رسائل الواتساب"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-all hover:border-primary/40 hover:shadow-lift"
          >
            <p className="text-[11px] font-bold text-muted-foreground">{s.label}</p>
            <span
              className={`mt-2 inline-flex w-fit rounded-xl px-2.5 py-1 text-xs font-extrabold tabular-nums ${s.tone}`}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {editTemplates && (
        <div className="grid gap-3.5 rounded-3xl border border-border bg-card p-6 shadow-soft sm:grid-cols-2 animate-in fade-in-50 duration-200">
          <div className="sm:col-span-2 border-b border-border/60 pb-3">
            <h2 className="font-display text-sm font-extrabold text-foreground">
              قوالب رسائل الواتساب التلقائية
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              تخصيص الرسائل التي تُرسل للعملاء حسب مرحلة الطلب.
            </p>
          </div>
          <div className="sm:col-span-2 grid gap-2 sm:grid-cols-3">
            {(
              [
                ["confirm", "تأكيد الطلب تلقائياً"],
                ["status", "تغيّر حالة الطلب تلقائياً"],
                ["abandoned", "تذكير السلة المتروكة"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-xs font-bold"
              >
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={automation[key]}
                  onChange={async (event) => {
                    const next = { ...automation, [key]: event.target.checked };
                    await saveAutomation({ data: next });
                    await qc.invalidateQueries({ queryKey: ["admin", "whatsapp-automation"] });
                    toast.success("تم حفظ إعداد الإرسال التلقائي");
                  }}
                  className="h-4 w-4 accent-primary"
                />
              </label>
            ))}
          </div>
          {(Object.keys(waTemplateLabels) as WaTemplateKey[]).map((k) => (
            <label key={k} className="block space-y-1.5">
              <span className="text-xs font-extrabold text-foreground">{waTemplateLabels[k]}</span>
              <textarea
                rows={3}
                value={templates[k]}
                onChange={(e) => setTemplates({ ...templates, [k]: e.target.value })}
                className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </label>
          ))}
          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              المتغيرات الديناميكية:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-primary">{"{name}"}</code>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-primary">{"{order}"}</code>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-primary">{"{total}"}</code>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-primary">{"{city}"}</code>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-primary">{"{delivery}"}</code>
            </p>
            <button
              onClick={() => {
                saveWaTemplates(templates);
                void saveAutomation({ data: { ...automation, templates } }).then(() =>
                  qc.invalidateQueries({ queryKey: ["admin", "whatsapp-automation"] }),
                );
                toast.success("تم حفظ قوالب الواتساب بنجاح");
              }}
              className="rounded-2xl gradient-gold px-6 py-2.5 text-xs font-extrabold text-primary-foreground shadow-soft transition-all hover:opacity-95 active:scale-95"
            >
              حفظ القوالب
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {/* Top toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1 shadow-xs">
            <button
              onClick={() => {
                setViewMode("list");
                localStorage.setItem("admin_orders_view", "list");
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all duration-150 ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4" />
              <span>عرض القائمة</span>
            </button>
            <button
              onClick={() => {
                setViewMode("kanban");
                localStorage.setItem("admin_orders_view", "kanban");
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all duration-150 ${
                viewMode === "kanban"
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              <span>لوحة كانبان</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <option value="all">كل حالات الدفع</option>
              <option value="paid">مدفوع بالكامل</option>
              <option value="pending">سند معلق للمراجعة</option>
              <option value="unpaid">غير مدفوع / عند الاستلام</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as "all" | "today" | "week" | "month")}
              className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <option value="all">كل التواريخ</option>
              <option value="today">طلبات اليوم</option>
              <option value="week">آخر 7 أيام</option>
              <option value="month">آخر 30 يوماً</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "newest" | "highest" | "oldest")}
              className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <option value="newest">الأحدث أولاً</option>
              <option value="highest">الأعلى قيمة</option>
              <option value="oldest">الأقدم أولاً</option>
            </select>
          </div>
        </div>

        {/* Search & Status Bar */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث برقم الطلب، اسم العميل، رقم الهاتف أو المنتج..."
              className="w-full rounded-2xl border border-border bg-background py-2.5 pe-4 ps-10 text-xs font-medium outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as OrderStatus | "all")}
            className="rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-extrabold outline-none transition-all focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 sm:w-auto"
          >
            <option value="all">جميع الحالات ({orders.length})</option>
            {statusOrder.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 gap-4 overflow-x-auto pb-4 md:grid-cols-2 lg:grid-cols-5">
          {kanbanColumns.map((col) => {
            const colOrders = list.filter((o) => col.statuses.includes(o.status));
            const colTotal = colOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
            return (
              <div
                key={col.id}
                className={`flex min-w-[260px] flex-col rounded-3xl border p-3.5 shadow-soft transition-all duration-200 ${col.tone}`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-xs font-black text-foreground">
                        {col.title}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${col.badge}`}
                      >
                        {colOrders.length}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                      {formatMoney(colTotal, label)}
                    </p>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="mt-3 flex flex-1 flex-col gap-2.5 overflow-y-auto max-h-[75vh]">
                  {colOrders.map((o) => {
                    const orderItems = items.filter((i) => i.order_id === o.id);
                    const elapsed = getElapsedInfo(o.created_at);
                    const nextStatus = quickNextStatusMap[o.status];
                    const nextLabel = quickNextLabels[o.status];
                    const isPending = ["new", "reviewing", "confirmed", "processing"].includes(
                      o.status,
                    );

                    return (
                      <div
                        key={o.id}
                        className="rounded-2xl border border-border bg-card p-3 shadow-soft transition-all duration-150 hover:border-primary/50 hover:shadow-lift"
                      >
                        <div className="flex items-center justify-between gap-1 border-b border-border/40 pb-2">
                          <span className="font-display text-xs font-black text-foreground">
                            #{o.order_number}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                              elapsed.isLate && isPending
                                ? "border border-amber-500/30 bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                : "bg-secondary text-muted-foreground"
                            }`}
                            title={new Date(o.created_at).toLocaleString("ar-EG")}
                          >
                            <Clock className="h-2.5 w-2.5" />
                            {elapsed.label}
                            {elapsed.isLate && isPending && <span>⚠️</span>}
                          </span>
                        </div>

                        <div className="mt-2 space-y-1">
                          <p className="truncate text-xs font-extrabold text-foreground">
                            {o.customer_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {o.city} · {orderItems.length} صنف
                          </p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="font-display text-xs font-black text-primary">
                              {formatMoney(Number(o.total), o.currency_label ?? label)}
                            </span>
                            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                              {paymentStatusLabels[o.payment_status ?? "unpaid"] ||
                                o.payment_status}
                            </span>
                          </div>
                        </div>

                        {/* Quick action buttons */}
                        <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-border/40 pt-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setOpen(open === o.id ? null : o.id)}
                              title="تفاصيل الطلب"
                              className="rounded-xl border border-border bg-secondary/60 p-1.5 text-muted-foreground transition-colors hover:text-primary active:scale-95"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setPackingSlipOrder(o)}
                              title="طباعة البوليصة"
                              className="rounded-xl border border-border bg-secondary/60 p-1.5 text-muted-foreground transition-colors hover:text-primary active:scale-95"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => sendTemplate(o, "confirm")}
                              title="واتساب العميل"
                              className="rounded-xl border border-border bg-secondary/60 p-1.5 text-emerald-600 transition-colors hover:bg-emerald-500/10 active:scale-95"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {nextStatus && nextLabel && (
                            <button
                              onClick={() => setStatus(o, nextStatus)}
                              className="flex items-center gap-1 rounded-xl gradient-gold px-2.5 py-1 text-[10px] font-extrabold text-primary-foreground shadow-xs transition-transform hover:opacity-95 active:scale-95"
                            >
                              <span>{nextLabel}</span>
                              <ArrowLeft className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {colOrders.length === 0 && (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 p-6 text-center text-[11px] font-semibold text-muted-foreground/60">
                      لا توجد طلبات في هذه المرحلة
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {pagedList.map((o) => {
            const orderItems = items.filter((i) => i.order_id === o.id);
            const logs = messages.filter((m) => m.order_id === o.id);
            const currency = o.currency_label ?? label;
            return (
              <div
                key={o.id}
                className="overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:border-primary/40 hover:shadow-lift"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-display text-sm font-extrabold text-foreground">
                      #{o.order_number}
                    </span>
                    <span className="text-sm font-bold text-foreground">{o.customer_name}</span>
                    <span
                      dir="ltr"
                      className="rounded-lg bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {o.phone}
                    </span>
                    <span className="text-xs text-muted-foreground">· {o.city}</span>
                    {(() => {
                      const elapsed = getElapsedInfo(o.created_at);
                      const isPending = ["new", "reviewing", "confirmed", "processing"].includes(
                        o.status,
                      );
                      return (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                            elapsed.isLate && isPending
                              ? "border border-amber-500/30 bg-amber-500/20 text-amber-700 dark:text-amber-300 animate-pulse"
                              : "bg-muted text-muted-foreground"
                          }`}
                          title={new Date(o.created_at).toLocaleString("ar-EG")}
                        >
                          <Clock className="h-3 w-3" />
                          <span>{elapsed.label}</span>
                          {elapsed.isLate && isPending && <span>⚠️</span>}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${statusColor[o.status]}`}
                    >
                      {statusLabels[o.status]}
                    </span>
                    <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold text-foreground">
                      {paymentStatusLabels[o.payment_status ?? "unpaid"] ?? o.payment_status}
                    </span>
                    <span className="font-display text-sm font-extrabold text-primary">
                      {formatMoney(Number(o.total), currency)}
                    </span>
                  </div>
                </div>

                <Timeline status={o.status} />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <p>
                    <span className="font-bold text-foreground">{orderItems.length} صنف</span>
                    {" · "}
                    <span>{o.city}</span>
                    {o.district ? ` - ${o.district}` : ""}
                  </p>
                  <span className="text-[11px]">
                    {new Date(o.created_at).toLocaleString("ar-EG")}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
                  {canManageOrders && nextStatusOf(o.status) && (
                    <button
                      onClick={() => {
                        const next = nextStatusOf(o.status);
                        if (next) void setStatus(o, next);
                      }}
                      className="flex items-center gap-1.5 rounded-2xl gradient-gold px-4 py-2 text-xs font-extrabold text-primary-foreground shadow-soft transition-all hover:opacity-95 active:scale-95"
                    >
                      <Check className="h-4 w-4 stroke-[3]" />{" "}
                      {(() => {
                        const next = nextStatusOf(o.status);
                        return next ? nextActionLabels[next] : "";
                      })()}
                    </button>
                  )}
                  {canManageOrders &&
                    o.status !== "cancelled" &&
                    o.status !== "completed" &&
                    o.status !== "returned" && (
                      <button
                        onClick={() => setStatus(o, "cancelled")}
                        className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs font-bold text-destructive transition-colors hover:bg-destructive/20"
                      >
                        إلغاء الطلب
                      </button>
                    )}

                  {canManageOrders ? (
                    <select
                      value={o.payment_status ?? "unpaid"}
                      onChange={(e) => setPayment(o, e.target.value)}
                      className="rounded-2xl border border-border bg-background px-3 py-2 text-xs font-bold outline-none transition-all focus:border-primary"
                    >
                      {Object.entries(paymentStatusLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-2xl border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground">
                      {paymentStatusLabels[o.payment_status ?? "unpaid"] ?? o.payment_status}
                    </span>
                  )}
                  <button
                    onClick={() => setPackingSlipOrder(o)}
                    title="طباعة بوليصة التجهيز والشحن"
                    className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground transition-colors hover:bg-secondary hover:text-primary"
                  >
                    <Printer className="h-4 w-4" /> بوليصة الشحن
                  </button>
                  <a
                    href={whatsappLink(
                      o.phone,
                      `مرحباً ${o.customer_name}، بخصوص طلبك رقم #${o.order_number}`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-2xl bg-[#25D366] px-3.5 py-2 text-xs font-bold text-white shadow-soft transition-transform hover:opacity-95 active:scale-95"
                  >
                    <MessageCircle className="h-4 w-4" /> واتساب
                  </a>
                  <button
                    onClick={() => setOpen(open === o.id ? null : o.id)}
                    className="rounded-2xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground transition-colors hover:bg-secondary"
                  >
                    {open === o.id ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                  </button>
                  {canDeleteOrders && (
                    <button
                      onClick={() => setOrderToDelete(o)}
                      title="حذف الطلب"
                      className="rounded-2xl bg-destructive/10 p-2 text-destructive transition-colors hover:bg-destructive/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground">قوالب سريعة:</span>
                  {(Object.keys(waTemplateLabels) as WaTemplateKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => void sendTemplate(o, k)}
                      className="rounded-full border border-border bg-background/80 px-3 py-1 text-[10px] font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-secondary hover:text-foreground"
                    >
                      {waTemplateLabels[k]}
                    </button>
                  ))}
                </div>

                {open === o.id && (
                  <div className="mt-4 rounded-3xl border border-border/80 bg-secondary/40 p-5 text-xs animate-in fade-in-50 duration-200">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="font-bold text-foreground">
                          العنوان:{" "}
                          <span className="font-normal text-muted-foreground">
                            {o.city}
                            {o.district ? ` - ${o.district}` : ""} - {o.address}
                          </span>
                        </p>
                        {o.notes && (
                          <p className="mt-1.5 font-bold text-foreground">
                            ملاحظات العميل:{" "}
                            <span className="font-normal text-muted-foreground">{o.notes}</span>
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">
                          رسوم التوصيل:{" "}
                          <span className="font-normal text-muted-foreground">
                            {formatMoney(Number(o.delivery_fee ?? 0), currency)}
                          </span>
                        </p>
                        {o.payment_method && (
                          <p className="mt-1.5 font-bold text-foreground">
                            طريقة الدفع المختارة:{" "}
                            <span className="font-normal text-muted-foreground">
                              {o.payment_method}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {o.receipt_url && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
                        <span className="text-xs font-bold text-foreground">سند التحويل:</span>
                        <a
                          href={o.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-border bg-background px-3 py-1.5 font-bold text-primary transition-colors hover:bg-secondary"
                        >
                          عرض السند المرفوع
                        </a>
                        <button
                          onClick={() => setPayment(o, "paid")}
                          className="flex items-center gap-1 rounded-xl bg-emerald-500/10 px-3 py-1.5 font-bold text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-500/20"
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" /> اعتماد الدفع
                        </button>
                        <button
                          onClick={() => setPayment(o, "failed")}
                          className="flex items-center gap-1 rounded-xl bg-rose-500/10 px-3 py-1.5 font-bold text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-500/20"
                        >
                          <X className="h-3.5 w-3.5 stroke-[3]" /> رفض السند
                        </button>
                      </div>
                    )}

                    <div className="mt-4 border-t border-border/60 pt-3">
                      <p className="font-display font-extrabold text-foreground">أصناف الطلب</p>
                      <ul className="mt-2 divide-y divide-border/50">
                        {orderItems.map((i) => (
                          <li key={i.id} className="flex items-center justify-between py-2 text-xs">
                            <span className="font-medium text-foreground">
                              {i.product_name}{" "}
                              <span className="text-muted-foreground">× {i.quantity}</span>
                            </span>
                            <span className="font-display font-extrabold text-foreground">
                              {formatMoney(Number(i.price) * i.quantity, currency)}
                            </span>
                          </li>
                        ))}
                        {orderItems.length === 0 && (
                          <li className="py-2 text-muted-foreground">لا توجد أصناف مسجلة</li>
                        )}
                      </ul>
                    </div>

                    {logs.length > 0 && (
                      <div className="mt-4 border-t border-border/60 pt-3">
                        <p className="font-display font-extrabold text-foreground">
                          سجل رسائل الواتساب المرسلة
                        </p>
                        <ul className="mt-1.5 space-y-1.5 text-[11px] text-muted-foreground">
                          {logs.slice(0, 6).map((m) => (
                            <li key={m.id} className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                              <span>{new Date(m.created_at).toLocaleString("ar-EG")}</span>
                              <span>—</span>
                              <span className="font-bold text-foreground">
                                {waTemplateLabels[(m.template ?? "confirm") as WaTemplateKey] ??
                                  m.template}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* شريط ترقيم الصفحات (Pagination Controls) */}
          {list.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xs text-xs">
              <div className="text-muted-foreground font-medium">
                الصفحة <span className="font-bold text-foreground">{page + 1}</span> من{" "}
                <span className="font-bold text-foreground">{totalPages}</span>{" "}
                <span className="text-[11px] text-muted-foreground">
                  ({list.length} طلب إجمالاً)
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

          {list.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center shadow-soft">
              <p className="text-sm font-bold text-foreground">لا توجد طلبات مطابقة</p>
              <p className="mt-1 text-xs text-muted-foreground">
                جرب تغيير معايير البحث أو اختيار حالة أخرى.
              </p>
            </div>
          )}
        </div>
      )}

      {packingSlipOrder && (
        <PackingSlipModal
          order={packingSlipOrder}
          items={items.filter((it) => it.order_id === packingSlipOrder.id)}
          storeName={settings?.store_name ?? "متجرنا"}
          onClose={() => setPackingSlipOrder(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(orderToDelete)}
        onOpenChange={(open) => !open && setOrderToDelete(null)}
        title="تأكيد حذف الطلب"
        description={`هل أنت متأكد من رغبتك في حذف الطلب #${orderToDelete?.order_number} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف الطلب"
        cancelLabel="إلغاء"
        isLoading={deleteLoading}
        onConfirm={confirmDeleteOrder}
      />
    </div>
  );
}

function PackingSlipModal({
  order,
  items,
  storeName,
  onClose,
}: {
  order: Order;
  items: Array<{ id: string; product_name: string; quantity: number; price: number }>;
  storeName: string;
  onClose: () => void;
}) {
  const printSlip = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in-50">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-extrabold text-foreground">
              بوليصة تجهيز وشحن الطلب #{order.order_number}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs" id="printable-packing-slip">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <p className="font-display text-base font-extrabold text-foreground">{storeName}</p>
              <p className="text-[11px] text-muted-foreground">بوليصة تجهيز وتوصيل شحنة</p>
            </div>
            <div className="text-end">
              <span className="font-display text-sm font-extrabold text-primary">
                #{order.order_number}
              </span>
              <p className="text-[10px] text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString("ar-EG")}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/30 p-3">
            <p className="font-bold text-foreground">بيانات المستلم والتوصيل:</p>
            <p className="mt-1 font-extrabold text-foreground">{order.customer_name}</p>
            <p className="text-muted-foreground" dir="ltr">
              {order.phone}
            </p>
            <p className="mt-1 text-muted-foreground">
              {order.city}
              {order.district ? ` - ${order.district}` : ""} - {order.address}
            </p>
            {order.notes && (
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                ملاحظة: {order.notes}
              </p>
            )}
          </div>

          <div>
            <p className="font-bold text-foreground">محتويات الشحنة للتجهيز:</p>
            <table className="mt-2 w-full text-right text-xs">
              <thead className="border-b border-border/60 text-muted-foreground font-bold">
                <tr>
                  <th className="py-1.5 ps-1">فحص [✓]</th>
                  <th className="py-1.5">المنتج</th>
                  <th className="py-1.5 text-center">الكمية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2 ps-1">
                      <span className="inline-block h-4 w-4 rounded border border-border" />
                    </td>
                    <td className="py-2 font-medium text-foreground">{it.product_name}</td>
                    <td className="py-2 text-center font-extrabold tabular-nums text-foreground">
                      {it.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
            <span className="font-bold text-muted-foreground">
              طريقة الدفع: {order.payment_method || "عند الاستلام"}
            </span>
            <span className="font-display text-sm font-extrabold text-foreground">
              المبلغ المطلوب: {formatMoney(Number(order.total), order.currency_label ?? "ر.س")}
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/60 pt-3 print:hidden">
          <button
            onClick={onClose}
            className="rounded-2xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-secondary"
          >
            إلغاء
          </button>
          <button
            onClick={printSlip}
            className="flex items-center gap-1.5 rounded-2xl gradient-gold px-5 py-2 text-xs font-extrabold text-primary-foreground shadow-soft transition-transform hover:opacity-95 active:scale-95"
          >
            <Printer className="h-4 w-4" /> طباعة البوليصة
          </button>
        </div>
      </div>
    </div>
  );
}

const flow: OrderStatus[] = ["new", "confirmed", "processing", "shipped", "delivered", "completed"];

/** Horizontal progress strip showing where the order stands in its lifecycle. */
function Timeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled" || status === "returned") {
    return (
      <div className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-2.5 text-center text-xs font-extrabold text-destructive">
        {statusLabels[status]}
      </div>
    );
  }
  const idx = flow.indexOf(status);
  return (
    <div className="mt-3.5 flex items-center gap-1.5">
      {flow.map((s, i) => {
        const done = idx >= 0 && i <= idx;
        const current = idx >= 0 && i === idx;
        return (
          <div key={s} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span
                className={`h-1 flex-1 rounded-full transition-colors ${
                  done && i > 0 ? "gradient-gold" : "bg-border/60"
                }`}
              />
              <span
                className={`mx-0.5 h-3 w-3 shrink-0 rounded-full transition-all ${
                  current
                    ? "gradient-gold ring-4 ring-primary/20 shadow-soft"
                    : done
                      ? "gradient-gold"
                      : "bg-border/60"
                }`}
              />
              <span
                className={`h-1 flex-1 rounded-full transition-colors ${
                  idx > i ? "gradient-gold" : "bg-border/60"
                }`}
              />
            </div>
            <span
              className={`truncate text-[9px] font-extrabold transition-colors ${
                current ? "text-primary" : done ? "text-foreground" : "text-muted-foreground/70"
              }`}
            >
              {statusLabels[s]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
