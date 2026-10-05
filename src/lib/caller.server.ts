import { getRequest } from "@tanstack/react-start/server";
import { normalizeYemeniPhone } from "./yemen";

export type Caller = {
  userId: string;
  /** رقم جوال الملف الشخصي بصيغة موحّدة (إن وُجد) */
  phone: string | null;
  isAdmin: boolean;
};

/**
 * هوية المتصل بشكل اختياري: يقرأ رمز الجلسة من الطلب إن وُجد ويعيد null للزائر.
 * يُستخدم للدوال العامة التي تُظهر تفاصيل خاصة للمالك فقط.
 */
export async function optionalCaller(): Promise<Caller | null> {
  try {
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    if (token.split(".").length !== 3) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;

    const userId = data.user.id;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("phone").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const rawPhone =
      profile?.phone?.trim() || (data.user.user_metadata as { phone?: string })?.phone;
    return {
      userId,
      phone: rawPhone ? normalizeYemeniPhone(rawPhone) : null,
      isAdmin: (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin"),
    };
  } catch {
    return null;
  }
}

/** يتحقق أن المتصل مدير فعلي — للاستخدام في دوال الخادم الحساسة. */
export async function requireAdminCaller(): Promise<Caller> {
  const caller = await optionalCaller();
  if (!caller?.isAdmin) throw new Error("Unauthorized: admin only");
  return caller;
}
