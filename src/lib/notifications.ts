/**
 * نظام إدارة إشعارات الويب المباشرة (Web Push & Notification Manager)
 * متوافق مع جميع المتصفحات الحديثة ويدعم الهواتف والأجهزة المكتبية عبر Service Worker و Notification API
 */

const NOTIFICATION_CONFIG_KEY = "ehab-web-notifications-config";
const LAST_ALERT_KEY = "ehab-last-notification-timestamp";

export type NotificationPreferences = {
  enabled: boolean;
  offers: boolean;
  cartReminder: boolean;
  orderUpdates: boolean;
  sound: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: false,
  offers: true,
  cartReminder: true,
  orderUpdates: true,
  sound: true,
};

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(NOTIFICATION_CONFIG_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveNotificationPreferences(prefs: Partial<NotificationPreferences>) {
  if (typeof window === "undefined") return;
  try {
    const current = getNotificationPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(NOTIFICATION_CONFIG_KEY, JSON.stringify(updated));
  } catch {
    /* Safe ignore */
  }
}

/**
 * طلب الإذن من المستخدم لتفعيل إشعارات الويب
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      saveNotificationPreferences({ enabled: true });
      return true;
    }
    saveNotificationPreferences({ enabled: false });
    return false;
  } catch (err) {
    console.warn("[Notifications] Error requesting permission:", err);
    return false;
  }
}

/**
 * إرسال إشعار ويب فوري للعميل
 */
export async function dispatchWebNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    url?: string;
    data?: any;
  },
): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return false;
  }

  const prefs = getNotificationPreferences();
  if (!prefs.enabled) return false;

  const icon = options?.icon || "/icon-192.png";
  const badge = options?.badge || "/icon-192.png";

  try {
    // 1. Try Service Worker Registration if active
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.active) {
        await registration.showNotification(title, {
          ...(options?.body ? { body: options.body } : {}),
          icon,
          badge,
          tag: options?.tag || "ehab-store-notification",
          data: { url: options?.url || "/" },
        });
        return true;
      }
    }

    // 2. Direct Window Notification fallback
    const notif = new Notification(title, {
      ...(options?.body ? { body: options.body } : {}),
      icon,
      badge,
      tag: options?.tag || "ehab-store-notification",
    });

    notif.onclick = () => {
      window.focus();
      if (options?.url) {
        window.location.href = options.url;
      }
      notif.close();
    };

    return true;
  } catch (e) {
    console.warn("[Notifications] Fallback notification failed:", e);
    return false;
  }
}

/**
 * إرسال إشعار تجريبي لاختبار عمل الإشعارات على جهاز العميل
 */
export async function sendTestNotification(): Promise<boolean> {
  return dispatchWebNotification("🎉 مرحباً بك في إشعارات إيهاب ستور!", {
    body: "تم تفعيل التنبيهات بنجاح. ستصلك أحدث العروض الحصرية وتحديثات طلباتك أولاً بأول.",
    tag: "test-notification",
    url: "/products",
  });
}

/**
 * فحص وإطلاق تذكير بالسلة المتروكة إن وُجدت منتجات
 */
export function checkCartReminder(cartCount: number, storeName = "إيهاب ستور") {
  if (cartCount <= 0 || !isNotificationSupported() || Notification.permission !== "granted") return;
  const prefs = getNotificationPreferences();
  if (!prefs.enabled || !prefs.cartReminder) return;

  const lastAlert = Number(localStorage.getItem(LAST_ALERT_KEY) || 0);
  const now = Date.now();
  // Don't spam: minimum 24 hours between cart reminders
  if (now - lastAlert < 24 * 60 * 60 * 1000) return;

  setTimeout(() => {
    void dispatchWebNotification(`🛒 سلتك تنتظرك في ${storeName}`, {
      body: `لديك ${cartCount} ${cartCount === 1 ? "منتج" : "منتجات"} بانتظارك في السلة، أكمل طلبك الآن قبل نفاد الكمية!`,
      url: "/cart",
      tag: "cart-reminder",
    });
    localStorage.setItem(LAST_ALERT_KEY, String(now));
  }, 3000);
}
