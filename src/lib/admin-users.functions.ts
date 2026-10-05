import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** يتحقق من صلاحية الدخول ويعيد ما إذا كان المتصل مديراً أعلى. */
async function assertAdmin(supabase: any, userId: string): Promise<{ isSuper: boolean }> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Unauthorized");
  const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("super_admin")) {
    throw new Error("Unauthorized: admin only");
  }
  return { isSuper: roles.includes("super_admin") };
}

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: { user_id: string; role: string }) => {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
    });
    return data.users
      .filter((u) => {
        // عدم ظهور بريد وحساب المدير الأعلى في جدول المستخدمين أبداً
        const isTargetSuper = (roleMap.get(u.id) ?? []).includes("super_admin");
        return !isTargetSuper;
      })
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        roles: roleMap.get(u.id) ?? [],
      }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        role: z.enum(["super_admin", "admin", "editor", "editor_add_only", "viewer", "user"]),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { isSuper } = await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw error;
    const target = list.users.find(
      (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
    );
    if (!target) throw new Error("لا يوجد مستخدم بهذا البريد");

    // التحقق من تعيين أو تعديل المدير الأعلى (خاص بالمدير الأعلى فقط)
    if (data.role === "super_admin" && !isSuper) {
      throw new Error("تخصيص دور المدير الأعلى مسموح فقط للمدير الأعلى الحالي");
    }

    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", target.id);
    const targetIsSuper = ((targetRoles ?? []) as { role: string }[]).some(
      (r) => r.role === "super_admin",
    );
    if (targetIsSuper && !isSuper) throw new Error("لا يمكنك تعديل صلاحيات المدير الأعلى");

    if (data.role === "user") {
      if (target.id === context.userId) throw new Error("لا يمكنك إزالة صلاحياتك بنفسك");
      // حذف كافة الأدوار الإدارية ليصبح مستخدم عادي
      const { error: e } = await supabaseAdmin.from("user_roles").delete().eq("user_id", target.id);
      if (e) throw e;
    } else {
      // إزالة الأدوار القديمة ثم إسناد الدور الجديد
      await supabaseAdmin.from("user_roles").delete().eq("user_id", target.id);
      const { error: e } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: target.id, role: data.role });
      if (e) throw e;
    }

    return { ok: true, role: data.role };
  });

export const createAdminUserManual = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6).optional(),
        name: z.string().optional(),
        role: z.enum(["super_admin", "admin", "editor", "editor_add_only", "viewer"]),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { isSuper } = await assertAdmin(context.supabase, context.userId);
    if (data.role === "super_admin" && !isSuper) {
      throw new Error("تخصيص دور المدير الأعلى متاح فقط للمدير الأعلى");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // تحقق إن كان المستخدم مسجلاً مسبقاً
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let target = list?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
    );

    const generatedPassword =
      data.password?.trim() || `Admin_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}!`;

    if (!target) {
      // إنشاء الحساب يدوياً وتأكيد البريد مباشرة
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email.trim(),
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: data.name?.trim() || undefined,
        },
      });
      if (createErr) throw new Error(`تعذر إنشاء الحساب: ${createErr.message}`);
      if (!created?.user) throw new Error("تعذر إنشاء المستخدم");
      target = created.user;
    } else if (data.password?.trim()) {
      // إذا كان الحساب موجوداً وتم إدخال كلمة مرور جديدة، تحديثها
      await supabaseAdmin.auth.admin.updateUserById(target.id, {
        password: data.password.trim(),
        email_confirm: true,
      });
    }

    // تعيين الدور في جدول الأدوار
    await supabaseAdmin.from("user_roles").delete().eq("user_id", target.id);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: target.id, role: data.role });
    if (roleErr) throw new Error(`تعذر إسناد الصلاحية: ${roleErr.message}`);

    return {
      ok: true,
      userId: target.id,
      email: data.email.trim(),
      password: generatedPassword,
      role: data.role,
    };
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ email: z.string().email(), makeAdmin: z.boolean() }).parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    return setUserRole({
      data: {
        email: data.email,
        role: data.makeAdmin ? "admin" : "user",
      },
    });
  });
