export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/**
 * يضبط رقم الصفحة ليضمن أنه عدد صحيح لا يقل عن 0.
 * API الداخلي يبدأ الترقيم من 0، بينما الواجهة تعرض 1 فما فوق.
 */
export function normalizePage(page?: unknown): number {
  const p = Number(page);
  if (isNaN(p) || p < 0) return 0;
  return Math.floor(p);
}

/**
 * يضبط حجم الصفحة بين 1 و 100 مع قيمة افتراضية 50.
 */
export function normalizePageSize(pageSize?: unknown): number {
  const s = Number(pageSize);
  if (isNaN(s) || s <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.floor(s));
}

/**
 * يحسب النطاق (from و to) المستخدم في range() باستعلامات قاعدة البيانات.
 */
export function getPageRange(page: number, pageSize: number): { from: number; to: number } {
  const validPage = normalizePage(page);
  const validSize = normalizePageSize(pageSize);
  const from = validPage * validSize;
  const to = from + validSize - 1;
  return { from, to };
}

/**
 * يحسب إجمالي عدد الصفحات استناداً للعدد الكلي للنتائج.
 */
export function getTotalPages(total: number, pageSize: number): number {
  const validSize = normalizePageSize(pageSize);
  const validTotal = Math.max(0, Number(total) || 0);
  return Math.max(1, Math.ceil(validTotal / validSize));
}
