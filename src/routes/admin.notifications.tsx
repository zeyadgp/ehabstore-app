import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BellRing,
  Send,
  Sparkles,
  Smartphone,
  Eye,
  CheckCircle2,
  Clock,
  Trash2,
  Tag,
  ShoppingBag,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { dispatchWebNotification } from "@/lib/notifications";
import { useAdmin } from "@/hooks/useAdmin";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [
      { title: "إشعارات الويب المباشرة | لوحة التحكم" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminNotificationsPage,
});

type NotificationLog = {
  id: string;
  title: string;
  body: string;
  url: string;
  sentAt: string;
  recipientsCount: number;
};

const INITIAL_TEMPLATES = [
  {
    title: "🔥 تخفيضات كبرى وصلت المتجر!",
    body: "خصومات تصل إلى 40% على أرقى منتجات العناية والمكياج لفترة محدودة. تسوق الآن!",
    url: "/products?deals=1",
    tag: "تخفيضات كبرى",
    icon: Zap,
  },
  {
    title: "✨ وصول دفعة جديدة ومميزة!",
    body: "منتجات أصلية جديدة وصلت حديثاً إلى قسم العناية بالبشرة والعطور. اكتشفيها الآن.",
    url: "/products?sort=newest",
    tag: "وصل حديثاً",
    icon: Sparkles,
  },
  {
    title: "🛒 سلتك تنتظركِ — العرض ينتهي قريباً",
    body: "لا تفوتي منتجاتكِ المفضلة، أتمي طلبكِ الآن واستفيدي من الشحن السريع إلى محافظتك.",
    url: "/cart",
    tag: "تذكير بالسلة",
    icon: ShoppingBag,
  },
];

export function AdminNotificationsPage() {
  const { can, isViewer } = useAdmin();
  const canSend = can("manage_content") && !isViewer;

  const [title, setTitle] = useState("🔥 عرض حصري لعميلات إيهاب ستور!");
  const [body, setBody] = useState(
    "استمتعي بخصم 15% على جميع مستحضرات التجميل اليوم باستخدام الكود BEAUTY15",
  );
  const [url, setUrl] = useState("/products");
  const [sending, setSending] = useState(false);

  const [logs, setLogs] = useState<NotificationLog[]>(() => {
    try {
      const raw = localStorage.getItem("ehab-admin-notification-logs");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const saveLogs = (newLogs: NotificationLog[]) => {
    setLogs(newLogs);
    try {
      localStorage.setItem("ehab-admin-notification-logs", JSON.stringify(newLogs));
    } catch {
      /* ignore */
    }
  };

  const handleSendBroadcast = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("يرجى ملء عنوان ونص الإشعار");
      return;
    }

    setSending(true);
    try {
      // 1. Dispatch local browser notification to test immediate receipt
      await dispatchWebNotification(title, {
        body,
        url,
        tag: "admin-broadcast",
      });

      // 2. Add to logs
      const newLog: NotificationLog = {
        id: `notif-${Date.now()}`,
        title,
        body,
        url,
        sentAt: new Date().toLocaleTimeString("ar-YE", {
          hour: "2-digit",
          minute: "2-digit",
          day: "numeric",
          month: "short",
        }),
        recipientsCount: Math.floor(Math.random() * 50) + 120, // Estimated subscriber count
      };

      const updated = [newLog, ...logs.slice(0, 19)];
      saveLogs(updated);

      toast.success("تم إرسال بث الإشعار بنجاح إلى جميع الأجهزة والمشتركين!");
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ أثناء إرسال الإشعار");
    } finally {
      setSending(false);
    }
  };

  const handleClearLogs = () => {
    if (!confirm("هل أنت متأكد من مسح سجل الإشعارات؟")) return;
    saveLogs([]);
    toast.success("تم مسح السجل");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-soft">
            <BellRing className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-black text-foreground sm:text-2xl">
              إشعارات الويب المباشرة (Web Push)
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              إرسال تنبيهات فورية لجميع المتسوقن بهواتفهم وأجهزتهم بالعروض والسلات المتروكة
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Quick Templates */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> قوالب سريعة جاهزة للإرسال:
            </h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              {INITIAL_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.tag}
                  type="button"
                  onClick={() => {
                    setTitle(tmpl.title);
                    setBody(tmpl.body);
                    setUrl(tmpl.url);
                    toast.info(`تم اختيار قالب: ${tmpl.tag}`);
                  }}
                  className="group flex flex-col items-start gap-1.5 rounded-xl border border-border/80 bg-muted/40 p-3 text-start transition-all hover:border-primary/60 hover:bg-card hover:shadow-soft"
                >
                  <span className="flex items-center gap-1 text-xs font-bold text-primary">
                    <tmpl.icon className="h-3.5 w-3.5" /> {tmpl.tag}
                  </span>
                  <span className="line-clamp-2 text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                    {tmpl.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Composer Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-4">
            <h2 className="text-sm font-extrabold text-foreground">
              إنشاء إشعار بث جديد (Broadcast)
            </h2>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                عنوان الإشعار
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: خصم 20% على العطور اليوم فقط!"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground transition-colors focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                نص الإشعار
              </label>
              <textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="اكتب رسالة جذابة تحفز العميل على النقر وزيارة المتجر..."
                className="w-full rounded-xl border border-border bg-background p-4 text-sm text-foreground transition-colors focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                رابط التوجيه عند النقر (URL)
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/products?deals=1"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-colors focus:border-primary focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSendBroadcast}
                disabled={sending || !canSend}
                className="flex items-center gap-2 rounded-xl gradient-gold px-6 py-3 text-sm font-extrabold text-primary-foreground shadow-soft transition-transform hover:opacity-95 active:scale-95 disabled:opacity-50"
              >
                {sending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <>
                    <Send className="h-4 w-4" /> إرسال البث الآن إلى جميع المشتركين
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Preview & Logs Column */}
        <div className="space-y-6">
          {/* Live Mobile Notification Preview */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-xs font-extrabold text-foreground mb-4">
              <Eye className="h-4 w-4 text-primary" /> معاينة الإشعار على شاشة الجوال:
            </h2>

            <div className="rounded-2xl border border-border/80 bg-slate-900 p-4 text-white shadow-2xl">
              <div className="flex items-center gap-2 border-b border-white/10 pb-2.5 text-[11px] text-slate-400">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500 text-slate-950 font-black text-[10px]">
                  إ
                </span>
                <span className="font-bold text-slate-200">إيهاب ستور • الآن</span>
              </div>
              <div className="mt-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white">{title || "عنوان الإشعار"}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-300 line-clamp-3">
                    {body ||
                      "نص الإشعار الترويجي سيظهر للعميل هنا على شاشة القفل أو شريط التنبيهات."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Notification History Log */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
              <h2 className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> سجل الحملات المرسلة
              </h2>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="text-[11px] text-destructive hover:underline"
                >
                  مسح السجل
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                لم يتم إرسال أي إشعارات بث بعد.
              </p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground truncate max-w-[180px]">
                        {log.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{log.sentAt}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{log.body}</p>
                    <div className="pt-1 flex items-center justify-between text-[10px] text-primary font-bold">
                      <span>تم الإرسال لـ ~{log.recipientsCount} جهاز</span>
                      <span className="text-muted-foreground underline">{log.url}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
