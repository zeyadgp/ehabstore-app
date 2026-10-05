import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CustomerExportRow = {
  name: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  created_at: string;
};

/** تصدير بيانات العملاء (الاسم، البريد، الرقم، العنوان) — للمديرين فقط. */
export const exportCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CustomerExportRow[]> => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      throw new Error("غير مصرح");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const users: { id: string; email: string; created_at: string }[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      data.users.forEach((u) =>
        users.push({ id: u.id, email: u.email ?? "", created_at: u.created_at }),
      );
      if (data.users.length < 200) break;
    }

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, address, governorate, district");

    const map = new Map<string, Record<string, string | null>>();
    (profiles ?? []).forEach((p: Record<string, string | null>) => map.set(String(p["id"]), p));

    return users.map((u) => {
      const p = map.get(u.id) ?? {};
      const address = [p["governorate"], p["district"], p["address"]]
        .filter((v) => v && String(v).trim())
        .join(" - ");
      return {
        name: (p["full_name"] as string) ?? "",
        email: u.email,
        phone: (p["phone"] as string) ?? "",
        address,
        // كلمات المرور محفوظة مشفّرة ولا يمكن استرجاعها نصّاً بأي طريقة.
        password: "مشفّرة — غير قابلة للاسترجاع",
        created_at: u.created_at,
      };
    });
  });

/**
 * يُنشئ رابط استعادة كلمة مرور لعميل نسي كلمته.
 * كلمات المرور محفوظة مشفّرة ولا يمكن استرجاعها نصّاً، فهذا هو البديل الآمن.
 */
export const createCustomerRecoveryLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; redirectTo?: string }) => {
    const email = (input?.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("أدخلي بريد العميل بشكل صحيح");
    return { email, redirectTo: input?.redirectTo };
  })
  .handler(async ({ data, context }): Promise<{ link: string }> => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      throw new Error("غير مصرح");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      ...(data.redirectTo ? { options: { redirectTo: data.redirectTo } } : {}),
    });
    if (error || !link?.properties?.action_link) {
      throw new Error(error?.message ?? "تعذّر إنشاء رابط الاستعادة");
    }
    return { link: link.properties.action_link };
  });

/**
 * تعيين كلمة مرور جديدة ومباشرة لأي عميل من قبل الإدارة.
 * يتيح للمشرف تحديد كلمة مرور معروفة وتزويد العميل بها فوراً.
 */
export const setCustomerPasswordDirectly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; newPassword: string }) => {
    const email = (input?.email ?? "").trim().toLowerCase();
    const newPassword = (input?.newPassword ?? "").trim();
    if (!email || !email.includes("@")) throw new Error("يرجى إدخال بريد العميل بشكل صحيح");
    if (!newPassword || newPassword.length < 6)
      throw new Error("كلمة المرور يجب أن لا تقل عن 6 خانات");
    return { email, newPassword };
  })
  .handler(async ({ data, context }): Promise<{ success: boolean; message: string }> => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      throw new Error("غير مصرح");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) throw listErr;
    const targetUser = usersData.users.find((u) => (u.email ?? "").toLowerCase() === data.email);
    if (!targetUser) {
      throw new Error("لم يتم العثور على حساب مسجل بهذا البريد");
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password: data.newPassword,
    });
    if (updateErr) {
      throw new Error(updateErr.message || "تعذر تحديث كلمة المرور");
    }

    return {
      success: true,
      message: `تم تعيين كلمة المرور الجديدة للحساب (${data.email}) بنجاح`,
    };
  });
