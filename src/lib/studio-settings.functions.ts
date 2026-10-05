import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const studioSettingsSchema = z.object({
  disabled: z.boolean(),
  hidePromoCard: z.boolean(),
  hideFromHeader: z.boolean(),
});

export type StudioSettings = z.infer<typeof studioSettingsSchema>;

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  disabled: true,
  hidePromoCard: true,
  hideFromHeader: true,
};

const KEY = "studio_page_settings";
const GROUP = "store_features";
const MANAGER_ROLES = ["super_admin", "admin"] as const;

export const getStudioSettingsServer = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", KEY)
      .maybeSingle();

    if (error || !data?.value) {
      return DEFAULT_STUDIO_SETTINGS;
    }

    const parsed = studioSettingsSchema.safeParse(JSON.parse(data.value));
    return parsed.success ? parsed.data : DEFAULT_STUDIO_SETTINGS;
  } catch {
    return DEFAULT_STUDIO_SETTINGS;
  }
});

export const saveStudioSettingsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => studioSettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    let canManage = false;
    for (const role of MANAGER_ROLES) {
      const { data: hasRole } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: role,
      });
      if (hasRole) {
        canManage = true;
        break;
      }
    }

    if (!canManage) {
      throw new Error("غير مصرح لك بتعديل إعدادات تعطيل وإخفاء تجربة المكياج");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const jsonValue = JSON.stringify(data);

    const { data: existing, error: readError } = await supabaseAdmin
      .from("site_settings")
      .select("id")
      .eq("key", KEY)
      .maybeSingle();

    if (readError) throw readError;

    const result = existing?.id
      ? await supabaseAdmin
          .from("site_settings")
          .update({
            value: jsonValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
      : await supabaseAdmin.from("site_settings").insert({
          key: KEY,
          value: jsonValue,
          group: GROUP,
          description: "إعدادات تعطيل وإخفاء صفحة وبطاقة تجربة المكياج",
        });

    if (result.error) throw result.error;
    return { ok: true, settings: data };
  });
