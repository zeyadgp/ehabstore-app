export type WaTemplateKey =
  "confirm" | "processing" | "shipped" | "delivered" | "review" | "no_contact" | "payment";

export const waTemplateLabels: Record<WaTemplateKey, string> = {
  confirm: "تأكيد الطلب",
  processing: "جاري التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  review: "طلب تقييم",
  no_contact: "تعذّر التواصل",
  payment: "متابعة الدفع",
};

export const defaultWaTemplates: Record<WaTemplateKey, string> = {
  confirm:
    "مرحباً {name} 🌟\nتم استلام طلبك رقم #{order} من {store}.\nالإجمالي: {total}\nنرجو تأكيد الطلب للبدء بالتجهيز.",
  processing:
    "مرحباً {name}\nطلبك #{order} قيد التجهيز الآن، وسنبلغك فور شحنه. شكراً لثقتك بـ{store} 💛",
  shipped:
    "مرحباً {name}\nتم شحن طلبك #{order} إلى {city}.\nقيمة التوصيل: {delivery}\nالإجمالي عند الاستلام: {total}",
  delivered: "مرحباً {name}\nنتمنى أن يكون طلبك #{order} قد وصلك بحالة ممتازة 🌸",
  review: "مرحباً {name}\nيسعدنا رأيك بمنتجات طلبك #{order} — تقييمك يساعدنا نقدّم أفضل 🌟",
  no_contact:
    "مرحباً {name}\nحاولنا التواصل معك بخصوص الطلب #{order} ولم نتمكن. نرجو الرد لتأكيد الطلب.",
  payment:
    "مرحباً {name}\nبخصوص الطلب #{order}، بانتظار إشعار التحويل لتأكيد الدفع.\nالمبلغ: {total}\nشكراً لك 💛",
};

const KEY = "wa-templates-v1";

export function loadWaTemplates(): Record<WaTemplateKey, string> {
  if (typeof window === "undefined") return defaultWaTemplates;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultWaTemplates;
    return { ...defaultWaTemplates, ...(JSON.parse(raw) as Record<string, string>) };
  } catch {
    return defaultWaTemplates;
  }
}

export function saveWaTemplates(t: Record<WaTemplateKey, string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(t));
}

export function fillTemplate(
  body: string,
  vars: {
    name: string;
    order: string | number;
    total: string;
    city: string;
    store: string;
    delivery: string;
  },
) {
  return body
    .replaceAll("{name}", vars.name)
    .replaceAll("{order}", String(vars.order))
    .replaceAll("{total}", vars.total)
    .replaceAll("{city}", vars.city)
    .replaceAll("{store}", vars.store)
    .replaceAll("{delivery}", vars.delivery);
}
