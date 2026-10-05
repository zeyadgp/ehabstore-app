import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { defaultWaTemplates, fillTemplate, type WaTemplateKey } from "@/lib/wa-templates";

export type WhatsappAutomation = {
  confirm: boolean;
  status: boolean;
  abandoned: boolean;
  templates: Record<WaTemplateKey, string>;
};

export const DEFAULT_WHATSAPP_AUTOMATION: WhatsappAutomation = {
  confirm: true,
  status: true,
  abandoned: false,
  templates: defaultWaTemplates,
};

const KEY = "whatsapp_automation";

async function assertOrderManager(context: { supabase: any; userId: string }) {
  for (const role of ["super_admin", "admin"]) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: role,
    });
    if (data) return;
  }
  throw new Error("غير مصرح");
}

export const getWhatsappAutomation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOrderManager(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", KEY)
      .maybeSingle();
    if (!data?.value) return DEFAULT_WHATSAPP_AUTOMATION;
    try {
      const saved = JSON.parse(data.value) as Partial<WhatsappAutomation>;
      return {
        ...DEFAULT_WHATSAPP_AUTOMATION,
        ...saved,
        templates: { ...defaultWaTemplates, ...saved.templates },
      };
    } catch {
      return DEFAULT_WHATSAPP_AUTOMATION;
    }
  });

export const saveWhatsappAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WhatsappAutomation) => input)
  .handler(async ({ data, context }) => {
    await assertOrderManager(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const value = JSON.stringify(data);
    const { data: current } = await supabaseAdmin
      .from("site_settings")
      .select("id")
      .eq("key", KEY)
      .maybeSingle();
    if (current?.id) {
      await supabaseAdmin.from("site_settings").update({ value }).eq("id", current.id);
    } else {
      await supabaseAdmin.from("site_settings").insert({
        key: KEY,
        value,
        group: "notifications",
        description: "إعدادات وقوالب رسائل واتساب التلقائية",
      });
    }
    return { ok: true };
  });

const statusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["confirmed", "processing", "shipped", "delivered"]),
});

const STATUS_TEMPLATE: Record<string, WaTemplateKey> = {
  confirmed: "confirm",
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
};

export const sendAutomaticOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertOrderManager(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: row }, { data: saved }] = await Promise.all([
      supabaseAdmin.from("orders").select("*").eq("id", data.orderId).maybeSingle(),
      supabaseAdmin.from("site_settings").select("value").eq("key", KEY).maybeSingle(),
    ]);
    if (!row) return { sent: false };
    let config = DEFAULT_WHATSAPP_AUTOMATION;
    try {
      const parsed = saved?.value ? (JSON.parse(saved.value) as Partial<WhatsappAutomation>) : {};
      config = { ...config, ...parsed, templates: { ...config.templates, ...parsed.templates } };
    } catch {
      /* استخدم الإعدادات الافتراضية */
    }
    if (!config.status) return { sent: false };
    const key = STATUS_TEMPLATE[data.status];
    if (!key) return { sent: false };
    const { data: store } = await supabaseAdmin
      .from("store_settings")
      .select("store_name")
      .limit(1)
      .maybeSingle();
    const body = fillTemplate(config.templates[key], {
      name: row.customer_name,
      order: row.order_number,
      total: `${row.total} ${row.currency_label}`,
      city: row.city,
      store: store?.store_name ?? "متجرنا",
      delivery: `${row.delivery_fee ?? 0} ${row.currency_label}`,
    });
    const { sendWhatsappText } = await import("@/lib/notify.server");
    const sent = await sendWhatsappText(body, row.phone);
    await supabaseAdmin.from("whatsapp_messages").insert({
      order_id: row.id,
      phone: row.phone,
      template: `auto_${key}`,
      body,
    });
    return { sent };
  });
