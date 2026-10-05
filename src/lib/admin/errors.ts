/**
 * دوال معالجة الأخطاء الآمنة للوحة الإدارة.
 * تضمن عدم تسريب تفاصيل SQL، مفاتيح، أو تفاصيل الخادم الداخلية للعميل،
 * مع تسجيل التفاصيل التقنية في سجلات الخادم فقط.
 */

export class SafeAdminError extends Error {
  public readonly isSafeAdminError = true;
  constructor(
    public readonly userMessage: string,
    public readonly originalError?: unknown,
  ) {
    super(userMessage);
    this.name = "SafeAdminError";
  }
}

export function toSafeAdminErrorMessage(
  error: unknown,
  fallbackMessage = "تعذر إكمال العملية المطلوبة. يرجى المحاولة لاحقاً.",
): string {
  if (error instanceof SafeAdminError) {
    return error.userMessage;
  }

  if (error && typeof error === "object" && "message" in error) {
    const rawMsg = String((error as { message: unknown }).message || "");

    // تسجيل الخطأ التقني في الخادم فقط
    console.error("[SafeAdminError] Server-side error:", rawMsg);

    // تصفية الأخطاء الشائعة وتحويلها لرسائل عربية آمنة
    if (rawMsg.includes("Unauthorized") || rawMsg.includes("JWT") || rawMsg.includes("auth")) {
      return "لا تملك الصلاحية اللازمة لتنفيذ هذا الإجراء.";
    }
    if (rawMsg.includes("not found") || rawMsg.includes("PGRST116")) {
      return "العنصر المطلوب غير موجود أو تم حذفه مسبقاً.";
    }
    if (rawMsg.includes("duplicate") || rawMsg.includes("23505")) {
      return "البيانات المدخلة موجودة مسبقاً، يرجى التحقق من المدخلات.";
    }
    if (rawMsg.includes("foreign key") || rawMsg.includes("23503")) {
      return "لا يمكن تنفيذ الإجراء لارتباط هذا العنصر بسجلات أخرى في النظام.";
    }
  }

  return fallbackMessage;
}
