import { useState, useEffect, useRef } from "react";
import {
  Bell,
  BellRing,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  X,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  isNotificationSupported,
  getNotificationPermission,
  getNotificationPreferences,
  saveNotificationPreferences,
  requestNotificationPermission,
  sendTestNotification,
  type NotificationPreferences,
} from "@/lib/notifications";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [prefs, setPrefs] = useState<NotificationPreferences>(getNotificationPreferences());
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isSup = isNotificationSupported();
    setSupported(isSup);
    if (isSup) {
      setPermission(getNotificationPermission());
    }
    setPrefs(getNotificationPreferences());
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (!open) return undefined;
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!supported) return null;

  const isGranted = permission === "granted" && prefs.enabled;

  const handleToggle = async () => {
    if (permission !== "granted") {
      setBusy(true);
      const granted = await requestNotificationPermission();
      setPermission(getNotificationPermission());
      setBusy(false);
      if (granted) {
        setPrefs((p) => ({ ...p, enabled: true }));
        toast.success("تم تفعيل إشعارات المتجر بنجاح! 🎉");
        void sendTestNotification();
      } else {
        toast.error("تم رفض الإذن أو إغلاق النافذة. يمكنك تفعيلها من إعدادات المتصفح.");
      }
    } else {
      const next = !prefs.enabled;
      saveNotificationPreferences({ enabled: next });
      setPrefs((p) => ({ ...p, enabled: next }));
      toast.info(next ? "تم تشغيل إشعارات الويب" : "تم إيقاف إشعارات الويب مؤقتاً");
    }
  };

  const updateSubPref = (key: keyof NotificationPreferences, val: boolean) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    saveNotificationPreferences({ [key]: val });
  };

  const handleTestNotification = async () => {
    if (permission !== "granted" || !prefs.enabled) {
      toast.error("يرجى تفعيل الإشعارات أولاً لتتمكن من الاختبار.");
      return;
    }
    const ok = await sendTestNotification();
    if (ok) {
      toast.success("تم إرسال الإشعار بنجاح إلى شاشتك!");
    } else {
      toast.info("تحقق من إعدادات النظام للسماح بالظهور على سطح المكتب أو شريط التنبيهات.");
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="إشعارات المتجر"
        title="إشعارات العروض وتحديثات الطلبات"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lift active:scale-95"
      >
        {isGranted ? (
          <BellRing className="h-4.5 w-4.5 text-primary animate-pulse" />
        ) : (
          <Bell className="h-4.5 w-4.5 text-foreground" />
        )}
        {isGranted && (
          <span className="absolute -top-1 -end-1 flex h-3 w-3 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-12 z-50 w-80 max-w-[90vw] rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl transition-all duration-200 sm:w-96 animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BellRing className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-extrabold text-foreground sm:text-sm">
                  إشعارات الويب الذكية
                </h3>
                <p className="text-[11px] text-muted-foreground">تنبيهات فورية بالعروض والطلبات</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Status block */}
          <div className="mt-3 rounded-xl border border-border/80 bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">حالة التنبيهات:</span>
              {permission === "granted" && prefs.enabled ? (
                <span className="flex items-center gap-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> مفعّلة
                </span>
              ) : permission === "denied" ? (
                <span className="flex items-center gap-1 text-xs font-extrabold text-destructive">
                  <XCircle className="h-3.5 w-3.5" /> محظورة في المتصفح
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-extrabold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" /> غير مفعلة
                </span>
              )}
            </div>

            {permission === "denied" ? (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                يرجى الضغط على علامة القفل بجانب شريط العنوان في متصفحك واختيار "سماح بالإشعارات" ثم
                إعادة تحميل الصفحة.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleToggle}
                disabled={busy}
                className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition-all shadow-sm ${
                  isGranted
                    ? "border border-border bg-card text-foreground hover:bg-muted"
                    : "gradient-gold text-primary-foreground hover:opacity-95"
                }`}
              >
                {busy ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : isGranted ? (
                  "إيقاف التنبيهات مؤقتاً"
                ) : (
                  <>
                    <BellRing className="h-3.5 w-3.5" /> تفعيل التنبيهات الآن
                  </>
                )}
              </button>
            )}
          </div>

          {/* Sub preferences */}
          {isGranted && (
            <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
              <p className="text-[11px] font-bold text-muted-foreground">تخصيص أنواع التنبيهات:</p>

              <label className="flex items-center justify-between text-xs font-medium text-foreground cursor-pointer">
                <span>تخفيضات وعروض حصرية</span>
                <input
                  type="checkbox"
                  checked={prefs.offers}
                  onChange={(e) => updateSubPref("offers", e.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-medium text-foreground cursor-pointer">
                <span>تذكير بالسلة المتروكة</span>
                <input
                  type="checkbox"
                  checked={prefs.cartReminder}
                  onChange={(e) => updateSubPref("cartReminder", e.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-medium text-foreground cursor-pointer">
                <span>تحديثات الشحن وحالة الطلب</span>
                <input
                  type="checkbox"
                  checked={prefs.orderUpdates}
                  onChange={(e) => updateSubPref("orderUpdates", e.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
              </label>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
                >
                  <Send className="h-3 w-3" /> تجربة إشعار فوري على شاشتي
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <Smartphone className="h-3 w-3" />
            <span>متوافق مع أجهزة أندرويد والكمبيوتر الشخصي والآيفون</span>
          </div>
        </div>
      )}
    </div>
  );
}
