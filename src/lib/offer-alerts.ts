/**
 * إشعارات العروض على الجوال:
 * تعمل عبر إشعارات المتصفح — عند تفعيلها يتلقّى العميل تنبيهاً بأحدث المنتجات
 * التي عليها خصم في كل مرة يفتح فيها المتجر ولم يسبق أن رآها.
 */
const ENABLED_KEY = "ehab-offer-alerts";
const SEEN_KEY = "ehab-offer-seen";

export type OfferItem = { id: string; name: string; discount_price: number | null };

export function offerAlertsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function offerAlertsEnabled() {
  if (!offerAlertsSupported()) return false;
  return window.localStorage.getItem(ENABLED_KEY) === "1" && Notification.permission === "granted";
}

export async function enableOfferAlerts(): Promise<boolean> {
  if (!offerAlertsSupported()) return false;
  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return false;
  window.localStorage.setItem(ENABLED_KEY, "1");
  return true;
}

export function disableOfferAlerts() {
  if (typeof window !== "undefined") window.localStorage.removeItem(ENABLED_KEY);
}

function seen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as string[]) : [];
  } catch {
    return [];
  }
}

/** ينبّه بالعروض الجديدة فقط (يتجاهل ما سبق عرضه). */
export function notifyNewOffers(items: OfferItem[], storeName: string) {
  if (!offerAlertsEnabled()) return;
  const offers = items.filter((i) => i.discount_price != null);
  const known = seen();
  const fresh = offers.filter((o) => !known.includes(o.id));
  if (fresh.length === 0) return;
  const first = fresh[0]!;
  const body =
    fresh.length === 1
      ? `${first.name} بسعر مخفّض الآن`
      : `${first.name} و${fresh.length - 1} عرضاً آخر بأسعار مخفّضة`;
  try {
    new Notification(`عروض جديدة في ${storeName}`, { body, icon: "/icon-192.png" });
  } catch {
    /* بعض المتصفحات تمنع الإشعار المباشر */
  }
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(offers.map((o) => o.id).slice(0, 200)));
  } catch {
    /* التخزين اختياري */
  }
}
