/** المحافظات اليمنية + أمثلة مديريات لكل محافظة (تُستخدم كاقتراحات في نموذج الطلب) */
export const YEMEN_GOVERNORATES = [
  "أمانة العاصمة (صنعاء)",
  "صنعاء",
  "عدن",
  "تعز",
  "إب",
  "الحديدة",
  "ذمار",
  "حضرموت",
  "حجة",
  "المحويت",
  "عمران",
  "صعدة",
  "البيضاء",
  "لحج",
  "أبين",
  "شبوة",
  "المهرة",
  "مأرب",
  "الجوف",
  "ريمة",
  "الضالع",
  "سقطرى",
] as const;

export const YEMEN_DISTRICTS: Record<string, string[]> = {
  "أمانة العاصمة (صنعاء)": [
    "معين",
    "الصافية",
    "الوحدة",
    "التحرير",
    "شعوب",
    "الثورة",
    "السبعين",
    "بني الحارث",
    "آزال",
    "الحصبة",
  ],
  صنعاء: ["بني مطر", "همدان", "سنحان", "أرحب", "خولان", "بلاد الروس"],
  عدن: ["كريتر", "المعلا", "التواهي", "خور مكسر", "الشيخ عثمان", "المنصورة", "دار سعد", "البريقة"],
  تعز: ["المظفر", "القاهرة", "صالة", "الحوبان", "التربة", "المخا"],
  إب: ["المشنة", "الظهار", "جبلة", "يريم", "بعدان", "العدين"],
  الحديدة: ["الحالي", "الميناء", "المراوعة", "باجل", "زبيد", "بيت الفقيه"],
  ذمار: ["مدينة ذمار", "معبر", "عنس", "جهران", "وصاب"],
  حضرموت: ["المكلا", "سيئون", "تريم", "الشحر", "غيل باوزير"],
  حجة: ["مدينة حجة", "عبس", "المحابشة", "حرض"],
  عمران: ["مدينة عمران", "ريدة", "حوث", "خمر"],
  مأرب: ["مدينة مأرب", "الوادي"],
  الضالع: ["مدينة الضالع", "دمت", "قعطبة"],
  لحج: ["الحوطة", "تبن", "ردفان"],
  المحويت: ["مدينة المحويت", "الطويلة", "شبام كوكبان"],
};

export function districtsFor(governorate: string): string[] {
  return YEMEN_DISTRICTS[governorate] ?? [];
}

/** رسالة التوصيل المناسبة حسب المحافظة */
export function deliveryNote(governorate: string): string {
  if (!governorate)
    return "التوصيل داخل أمانة العاصمة خلال 24 ساعة، وبقية المحافظات عبر مكاتب الشحن البري خلال 2–4 أيام.";
  if (governorate.includes("أمانة العاصمة"))
    return "التوصيل داخل أمانة العاصمة خلال 24 ساعة عبر مندوب المتجر، والدفع عند الاستلام متاح.";
  if (["عدن", "تعز", "إب", "الحديدة", "ذمار"].includes(governorate))
    return `الشحن إلى ${governorate} عبر مكاتب النقل البري خلال 1–3 أيام، ويتم تسليم الشحنة من أقرب مكتب لك.`;
  return `الشحن إلى ${governorate} عبر مكاتب النقل البري خلال 2–4 أيام، ويتم إبلاغك برقم الشحنة عبر واتساب.`;
}

/** تحويل الأرقام المشرقية/الفارسية والرموز الخفية إلى أرقام لاتينية قياسية */
export function toWesternDigits(input?: string | null): string {
  return (input || "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "");
}

/** تحويل الأرقام اللاتينية إلى أرقام مشرقية عربية */
export function toEasternDigits(input?: string | null): string {
  return (input || "").replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)] ?? d);
}

/** استخراج الأرقام فقط بعد توحيد الأرقام المشرقية واللاتينية */
export function cleanDigits(input?: string | null): string {
  return toWesternDigits(input).replace(/[^\d]/g, "");
}

/** توحيد صيغة رقم الجوال اليمني: 7XXXXXXXX -> 9677XXXXXXXX مع دعم كافة الصيغ والأرقام المشرقية */
export function normalizeYemeniPhone(input?: string | null): string {
  const digits = cleanDigits(input);
  if (!digits) return "";
  if (digits.startsWith("00967")) return digits.slice(2);
  if (digits.startsWith("967")) return digits;
  if (digits.startsWith("0")) return `967${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("7")) return `967${digits}`;
  return digits;
}

/**
 * مقارنة مرنة وموثوقة بين رقمين هاتف، تدعم اختلاف الترميز (عربي/إنجليزي)،
 * البادئات الدولية (+967، 00967، 0)، والفراغات أو علامات الربط في قواعد البيانات.
 */
export function phonesMatch(phoneA?: string | null, phoneB?: string | null): boolean {
  if (!phoneA || !phoneB) return false;
  const normA = normalizeYemeniPhone(phoneA);
  const normB = normalizeYemeniPhone(phoneB);
  if (normA && normB && normA === normB) return true;

  const digitsA = cleanDigits(phoneA);
  const digitsB = cleanDigits(phoneB);
  if (!digitsA || !digitsB) return false;
  if (digitsA === digitsB) return true;

  // مطابقة آخر 8 أو 9 خانات (تغطي كافة أرقام الجوال اليمنية بأي بادئة)
  const minLen = Math.min(digitsA.length, digitsB.length, 8);
  if (minLen >= 7) {
    return digitsA.slice(-minLen) === digitsB.slice(-minLen);
  }
  return false;
}

/** توليد قائمة بصيغ الرقم الشائعة (لاتينية ومشرقية) للبحث المباشر في قاعدة البيانات */
export function getYemeniPhoneVariants(phone?: string | null): string[] {
  if (!phone) return [];
  const raw = phone.trim();
  const digits = cleanDigits(phone);
  const norm = normalizeYemeniPhone(phone);
  const local9 = norm.startsWith("967") ? norm.slice(3) : digits;

  const westernSet = new Set<string>([
    raw,
    digits,
    norm,
    local9,
    `0${local9}`,
    `+${norm}`,
    `00${norm}`,
  ]);

  // إضافة الصيغ بالأرقام المشرقية
  const variants: string[] = [];
  for (const item of westernSet) {
    if (!item) continue;
    variants.push(item);
    const eastern = toEasternDigits(item);
    if (eastern !== item) variants.push(eastern);
  }

  return Array.from(new Set(variants));
}

/** إحداثيات مراكز المحافظات لعرض الخريطة عند الاختيار اليدوي */
export const GOVERNORATE_COORDS: Record<string, { lat: number; lng: number }> = {
  "أمانة العاصمة (صنعاء)": { lat: 15.3694, lng: 44.191 },
  صنعاء: { lat: 15.3547, lng: 44.2066 },
  عدن: { lat: 12.7855, lng: 45.0187 },
  تعز: { lat: 13.5789, lng: 44.0219 },
  إب: { lat: 13.9667, lng: 44.1833 },
  الحديدة: { lat: 14.7978, lng: 42.9545 },
  ذمار: { lat: 14.5427, lng: 44.4017 },
  حضرموت: { lat: 14.5425, lng: 49.1242 },
  حجة: { lat: 15.6943, lng: 43.6019 },
  المحويت: { lat: 15.4703, lng: 43.5453 },
  عمران: { lat: 15.6594, lng: 43.9439 },
  صعدة: { lat: 16.9402, lng: 43.7635 },
  البيضاء: { lat: 13.9843, lng: 45.5729 },
  لحج: { lat: 13.0577, lng: 44.8819 },
  أبين: { lat: 13.1783, lng: 45.3667 },
  شبوة: { lat: 14.5333, lng: 46.8333 },
  المهرة: { lat: 16.5225, lng: 52.1751 },
  مأرب: { lat: 15.4625, lng: 45.3256 },
  الجوف: { lat: 16.7919, lng: 44.9333 },
  ريمة: { lat: 14.6279, lng: 43.5911 },
  الضالع: { lat: 13.6957, lng: 44.7315 },
  سقطرى: { lat: 12.6339, lng: 53.9095 },
};

/** مركز الخريطة الافتراضي حسب المحافظة (وإلا صنعاء) */
export function centerFor(governorate?: string | null): { lat: number; lng: number } {
  if (governorate && GOVERNORATE_COORDS[governorate]) return GOVERNORATE_COORDS[governorate]!;
  return { lat: 15.3694, lng: 44.191 };
}
