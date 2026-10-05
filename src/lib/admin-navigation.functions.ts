import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminPageState = { hidden: boolean; disabled: boolean };
export type AdminNavigationConfig = Record<string, AdminPageState>;

const KEY = "admin_navigation_config";
const STAFF_ROLES = ["super_admin", "admin", "editor", "editor_add_only", "viewer"] as const;
const MANAGER_ROLES = ["super_admin", "admin"] as const;
const pageStateSchema = z.object({ hidden: z.boolean(), disabled: z.boolean() });
const configSchema = z.record(z.string(), pageStateSchema);

async function assertStaff(context: { supabase: any; userId: string }) {
  for (const role of STAFF_ROLES) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: role,
    });
    if (data) return;
  }
  throw new Error("غير مصرح لك بتغيير قوائم لوحة التحكم");
}

export const getAdminNavigationConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", KEY)
      .maybeSingle();
    if (error) throw error;
    if (!data?.value) return {} as AdminNavigationConfig;
    const parsed = configSchema.safeParse(JSON.parse(data.value));
    return parsed.success ? parsed.data : ({} as AdminNavigationConfig);
  });

export const saveAdminNavigationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => configSchema.parse(input))
  .handler(async ({ data, context }) => {
    let canManage = false;
    for (const role of MANAGER_ROLES) {
      const { data: hasRole } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: role,
      });
      if (hasRole) canManage = true;
    }
    if (!canManage) throw new Error("غير مصرح لك بتغيير قوائم لوحة التحكم");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const value = JSON.stringify(data);
    const { data: existing, error: readError } = await supabaseAdmin
      .from("site_settings")
      .select("id")
      .eq("key", KEY)
      .maybeSingle();
    if (readError) throw readError;
    const result = existing?.id
      ? await supabaseAdmin.from("site_settings").update({ value }).eq("id", existing.id)
      : await supabaseAdmin.from("site_settings").insert({
          key: KEY,
          value,
          group: "internal",
          description: "إخفاء وتعطيل صفحات لوحة التحكم",
        });
    if (result.error) throw result.error;
    return { ok: true };
  });
