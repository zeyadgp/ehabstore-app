/**
 * تكامل تتبع Meta Pixel و Conversions API (CAPI)
 * تتبع الأحداث القياسية للتجارة الإلكترونية بدقة وربطها بالمنتجات وSKU والأسعار والعملة
 */

import { sendMetaCapiEvent } from "./meta.functions";

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
  }
}

let pixelInitialized = false;

/**
 * تهيئة كود Meta Pixel في المتصفح بأمان
 */
export function initMetaPixel(pixelId?: string | null): void {
  if (typeof window === "undefined" || !pixelId) return;
  if (pixelInitialized) return;

  try {
    const trimmedId = pixelId.trim();
    if (!trimmedId || trimmedId.length < 5) return;

    /* eslint-disable */
    if (!window.fbq) {
      const fbq: any = function () {
        if (fbq.callMethod) {
          fbq.callMethod.apply(fbq, arguments);
        } else {
          fbq.queue.push(arguments);
        }
      };
      if (!window._fbq) window._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      window.fbq = fbq;

      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      script.onerror = () => {
        console.warn("Meta Pixel script could not load (e.g. ad blocker active)");
      };
      const firstScript = document.getElementsByTagName("script")[0];
      firstScript?.parentNode?.insertBefore(script, firstScript);
    }

    window.fbq("init", trimmedId);
    window.fbq("track", "PageView");
    pixelInitialized = true;
    /* eslint-enable */
  } catch (err) {
    console.warn("Error initializing Meta Pixel", err);
  }
}

export type MetaLoggedEvent = {
  id: string;
  eventName: string;
  eventId: string;
  timestamp: string;
  source: "browser" | "server" | "both" | "test";
  status: "success" | "pending" | "failed";
  value?: number;
  currency?: string | undefined;
  params?: Record<string, unknown>;
  responseMessage?: string;
};

const RECENT_EVENTS_STORAGE_KEY = "ehab_meta_recent_events_v2";

/**
 * استرجاع سجل آخر أحداث Meta المسجلة محلياً
 */
export function getRecentMetaEvents(): MetaLoggedEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_EVENTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * تسجيل حدث في السجل المحلي
 */
export function recordMetaEvent(event: MetaLoggedEvent): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRecentMetaEvents();
    const updated = [event, ...current.filter((e) => e.eventId !== event.eventId)].slice(0, 30);
    localStorage.setItem(RECENT_EVENTS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("meta-event-logged", { detail: event }));
  } catch {
    /* ignore */
  }
}

/**
 * تفريغ سجل الأحداث المسجلة
 */
export function clearRecentMetaEvents(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_EVENTS_STORAGE_KEY, JSON.stringify([]));
    window.dispatchEvent(new CustomEvent("meta-event-logged", { detail: null }));
  } catch {
    /* ignore */
  }
}

export type MetaUserData = { email?: string | undefined; phone?: string | undefined };

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]!) : "";
}

/** _fbc من الكوكي أو من fbclid في الرابط */
function readFbc(): string {
  const c = readCookie("_fbc");
  if (c) return c;
  if (typeof window === "undefined") return "";
  const id = new URLSearchParams(window.location.search).get("fbclid");
  return id ? `fb.1.${Date.now()}.${id}` : "";
}

/**
 * توليد معرف فريد للحدث (Event ID) للربط بين Pixel و Conversions API ومنع التكرار (Deduplication)
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * إرسال حدث Conversions API (CAPI) عبر الخادم أو واجهة Meta Graph API المباشرة
 */
export async function sendCapiEvent(
  eventName: string,
  eventData: Record<string, unknown>,
  eventId: string,
  userData?: MetaUserData,
): Promise<boolean> {
  try {
    const numValue = typeof eventData["value"] === "number" ? eventData["value"] : 0;
    const cur = typeof eventData["currency"] === "string" ? eventData["currency"] : "SAR";

    const res = await sendMetaCapiEvent({
      data: {
        event_name: eventName,
        event_id: eventId,
        event_source_url: typeof window !== "undefined" ? window.location.href : "",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        fbp: readCookie("_fbp"),
        fbc: readFbc(),
        email: userData?.email ?? "",
        phone: userData?.phone ?? "",
        custom_data: eventData,
      },
    });

    recordMetaEvent({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventName,
      eventId,
      timestamp: new Date().toISOString(),
      source: "server",
      status: res.ok ? "success" : "pending",
      value: numValue,
      currency: cur,
      params: eventData,
      responseMessage: res.message,
    });

    return res.ok;
  } catch (err: any) {
    console.warn("Could not send CAPI event", err);
    recordMetaEvent({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventName,
      eventId,
      timestamp: new Date().toISOString(),
      source: "server",
      status: "failed",
      params: eventData,
      responseMessage: err?.message || "فشل الاتصال بخادم Meta",
    });
    return false;
  }
}

/**
 * تتبع حدث عام في Pixel و CAPI
 */
export async function trackMetaEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  userData?: MetaUserData,
): Promise<string> {
  const eventId = generateEventId();

  if (typeof window !== "undefined" && window.fbq) {
    try {
      window.fbq("track", eventName, params, { eventID: eventId });
    } catch {
      /* ignore */
    }
  }

  // إرسال عبر Conversions API كنسخة موازية للخادم
  void sendCapiEvent(eventName, params, eventId, userData);

  return eventId;
}

// ==============================================
// الدوال القياسية لأحداث التجارة الإلكترونية
// ==============================================

/**
 * 1. حدث عرض المنتج (ViewContent)
 */
export function trackMetaViewContent(product: {
  id: string;
  name: string;
  price: number;
  currency?: string | undefined;
  category?: string | undefined;
  sku?: string | null | undefined;
}) {
  return trackMetaEvent("ViewContent", {
    content_name: product.name,
    content_ids: [product.sku || product.id],
    content_type: "product",
    content_category: product.category || "General",
    value: Number(product.price || 0),
    currency: product.currency || "SAR",
    contents: [
      {
        id: product.sku || product.id,
        quantity: 1,
        item_price: Number(product.price || 0),
      },
    ],
  });
}

/**
 * 2. حدث إضافة إلى السلة (AddToCart)
 */
export function trackMetaAddToCart(item: {
  id: string;
  name: string;
  price: number;
  quantity: number;
  currency?: string | undefined;
  sku?: string | null | undefined;
  color?: string | null | undefined;
  size?: string | null | undefined;
}) {
  return trackMetaEvent("AddToCart", {
    content_name: item.name,
    content_ids: [item.sku || item.id],
    content_type: "product",
    value: Number(item.price || 0) * (item.quantity || 1),
    currency: item.currency || "SAR",
    contents: [
      {
        id: item.sku || item.id,
        quantity: item.quantity || 1,
        item_price: Number(item.price || 0),
      },
    ],
  });
}

/**
 * 3. حدث بدء إتمام الطلب (InitiateCheckout)
 */
export function trackMetaInitiateCheckout(
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    sku?: string | null | undefined;
  }>,
  totalAmount: number,
  currency = "SAR",
  userData?: MetaUserData,
) {
  return trackMetaEvent("InitiateCheckout", {
    content_ids: items.map((i) => i.sku || i.id),
    content_type: "product",
    num_items: items.reduce((acc, i) => acc + (i.quantity || 1), 0),
    value: Number(totalAmount || 0),
    currency,
    contents: items.map((i) => ({
      id: i.sku || i.id,
      quantity: i.quantity || 1,
      item_price: Number(i.price || 0),
    })),
  }, userData);
}

/**
 * 4. حدث إتمام الشراء (Purchase)
 */
export function trackMetaPurchase(order: {
  id: string;
  total: number;
  currency?: string | undefined;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    sku?: string | null | undefined;
  }>;
  phone?: string | undefined;
  email?: string | undefined;
}) {
  return trackMetaEvent("Purchase", {
    content_ids: order.items.map((i) => i.sku || i.id),
    content_type: "product",
    num_items: order.items.reduce((acc, i) => acc + (i.quantity || 1), 0),
    value: Number(order.total || 0),
    currency: order.currency || "SAR",
    order_id: order.id,
    contents: order.items.map((i) => ({
      id: i.sku || i.id,
      quantity: i.quantity || 1,
      item_price: Number(i.price || 0),
    })),
  }, { phone: order.phone, email: order.email });
}

/**
 * 5. حدث البحث في المتجر (Search)
 */
export function trackMetaSearch(query: string) {
  if (!query.trim()) return;
  return trackMetaEvent("Search", {
    search_string: query.trim(),
  });
}

/**
 * 6. حدث استعراض تصنيف (ViewCategory)
 */
export function trackMetaViewCategory(categoryName: string, productCount?: number) {
  return trackMetaEvent("ViewCategory", {
    content_category: categoryName,
    content_type: "product_group",
    num_items: productCount ?? 0,
  });
}
