/**
 * محرك البحث العربي المعرّب والمطبع للأحرف (Arabic Text Normalizer & Fast Search Engine)
 *
 * يقوم بتطبيع الحروف العربية ومطابقة الكلمات بغض النظر عن:
 * 1. الهمزات (أ، إ، آ، ٱ -> ا)
 * 2. التاء المربوطة والهاء (ة -> ه)
 * 3. الألف المقصورة والياء (ى -> ي)
 * 4. التشكيل والتنوين والمد والشدة
 * 5. التطويل / الكشيدة (ـ)
 * 6. الأرقام المشرقية والمغربية (٠-٩ -> 0-9)
 * 7. اختلاف ترتيب الكلمات والبحث متعدد الكلمات (Multi-token Search)
 */

import type { Product } from "./store";

const TASHKEEL_REGEX = /[\u064B-\u065F\u0670]/g;
const TATWEEL_REGEX = /\u0640/g;
const PUNCTUATION_REGEX = /[،؛؟.,/#!$%^&*;:{}=\-_`~()[\]"'«»]/g;

const EASTERN_NUMERALS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

/**
 * تطبيع النص العربي لإزالة الفروق الإملائية والتشكيل
 */
export function normalizeArabic(text: string | null | undefined): string {
  if (!text) return "";

  const normalized = text
    .toString()
    .toLowerCase()
    // إزالة التشكيل والتنوين
    .replace(TASHKEEL_REGEX, "")
    // إزالة الكشيدة والتطويل
    .replace(TATWEEL_REGEX, "")
    // تحويل الأرقام العربية المشرقية إلى غربية
    .replace(/[٠-٩]/g, (w) => EASTERN_NUMERALS[w] || w)
    // توحيد الهمزات
    .replace(/[إأآٱ]/g, "ا")
    // توحيد الألف المقصورة إلى ياء
    .replace(/ى/g, "ي")
    // توحيد التاء المربوطة إلى هاء
    .replace(/ة/g, "ه")
    // توحيد الهمزات على واو وياء
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    // إزالة علامات الترقيم واستبدالها بمسافات
    .replace(PUNCTUATION_REGEX, " ")
    // إزالة الفراغات المكررة
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

/**
 * فحص ما إذا كانت كل كلمات البحث مطابقة في النصوص المستهدفة
 */
export function matchesArabicSearch(
  query: string | null | undefined,
  ...targets: (string | null | undefined)[]
): boolean {
  if (!query || !query.trim()) return true;

  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return true;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  if (queryTokens.length === 0) return true;

  const normalizedTarget = normalizeArabic(targets.filter(Boolean).join(" "));

  // يجب أن تتواجد كل كلمة من كلمات البحث في النص المستهدف
  return queryTokens.every((token) => normalizedTarget.includes(token));
}

/**
 * ترتيب وفرز المنتجات حسب صلة البحث (Relevance Score)
 */
export function rankProductsBySearch(products: Product[], query: string): Product[] {
  if (!query || !query.trim()) return products;

  const normalizedQuery = normalizeArabic(query);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  if (tokens.length === 0) return products;

  type ScoredProduct = {
    product: Product;
    score: number;
  };

  const scored: ScoredProduct[] = [];

  for (const p of products) {
    const normName = normalizeArabic(p.name);
    const normDesc = normalizeArabic(p.description);
    const normSku = normalizeArabic(p.sku);

    const combined = `${normName} ${normDesc} ${normSku}`;

    // التحقق من احتواء كل الكلمات
    const matchesAll = tokens.every((token) => combined.includes(token));
    if (!matchesAll) continue;

    let score = 0;

    // تطابق تام في الاسم
    if (normName === normalizedQuery) {
      score += 100;
    } else if (normName.startsWith(normalizedQuery)) {
      score += 50;
    } else if (normName.includes(normalizedQuery)) {
      score += 30;
    }

    // مطابقة الـ SKU بدقة
    if (normSku && normSku.includes(normalizedQuery)) {
      score += 40;
    }

    // مطابقة كل رمز في الاسم
    for (const token of tokens) {
      if (normName.includes(token)) score += 10;
      if (normDesc.includes(token)) score += 2;
    }

    // تمييز المنتجات المتوفرة والأكثر مبيعاً
    if (p.stock > 0) score += 5;
    if (p.is_bestseller) score += 3;

    scored.push({ product: p, score });
  }

  // الترتيب التنازلي حسب الأعلى درجة
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.product);
}
