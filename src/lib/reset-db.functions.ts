import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** الجداول التي يمكن تفريغها، مرتبة لاحترام العلاقات (الأبناء أولاً لتفادي أخطاء المفاتيح الأجنبية). */
const SCOPES = {
  orders: ["whatsapp_messages", "invoices", "order_items", "orders"],
  catalog: [
    "product_reviews",
    "product_prices",
    "product_categories",
    "product_option_values",
    "product_options",
    "product_colors",
    "products",
    "categories",
    "brands",
  ],
  loyalty: [
    "loyalty_checkins",
    "loyalty_transactions",
    "loyalty_coupons",
    "loyalty_rewards",
    "loyalty_accounts",
    "coupon_redemptions",
    "discount_coupons",
  ],
  content: ["banners", "testimonials"],
  reviews: ["product_reviews", "testimonials"],
  audit: ["admin_audit_log"],
} as const;

export type ResetScope = keyof typeof SCOPES;

/** تحديد عمود الشرط المناسب لكل جدول عند الحذف لتفادي خطأ عدم وجود عمود id */
function getDeleteFilter(table: string): {
  column: string;
  operator: "neq" | "not.is";
  value: any;
} {
  switch (table) {
    case "product_categories":
      return {
        column: "product_id",
        operator: "neq",
        value: "00000000-0000-0000-0000-000000000000",
      };
    case "product_prices":
      return {
        column: "product_id",
        operator: "neq",
        value: "00000000-0000-0000-0000-000000000000",
      };
    default:
      return { column: "id", operator: "not.is", value: null };
  }
}

/** التفريغ الجماعي للبيانات مقصور على المدير الأعلى فقط. */
async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin");
  if (error) throw new Error("Unauthorized");
  if (!data || data.length === 0) throw new Error("Unauthorized: super admin only");
}

/** تفريغ مجموعات مختارة من البيانات — لا يمسّ الحسابات ولا الإعدادات ولا الصلاحيات. */
export const resetDatabase = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        scopes: z
          .array(z.enum(["orders", "catalog", "loyalty", "content", "reviews", "audit"]))
          .min(1),
        confirm: z.literal("حذف"),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tables: string[] = [];
    (data.scopes as ResetScope[]).forEach((s) => {
      const list = SCOPES[s];
      if (list) {
        list.forEach((t) => {
          if (!tables.includes(t)) tables.push(t);
        });
      }
    });

    const deleted: Record<string, string> = {};
    for (const table of tables) {
      try {
        const filter = getDeleteFilter(table);
        let query = supabaseAdmin.from(table as never).delete();
        if (filter.operator === "not.is") {
          query = (query as any).not(filter.column, "is", filter.value);
        } else {
          query = (query as any).neq(filter.column, filter.value);
        }

        const { error } = await query;
        if (error) {
          // جرب حذف بديل عبر neq لعمود بديل إذا كان خطأ عمود
          const fallbackRes = await (supabaseAdmin.from(table as never).delete() as any).neq(
            "created_at",
            "1970-01-01",
          );
          deleted[table] = fallbackRes.error ? `خطأ: ${error.message}` : "تم بنجاح";
        } else {
          deleted[table] = "تم بنجاح";
        }
      } catch (err) {
        deleted[table] = `خطأ: ${err instanceof Error ? err.message : "فشل الحذف"}`;
      }
    }

    // سجل تدقيق: من نفّذ التفريغ ومتى وماذا حذف
    try {
      await supabaseAdmin.from("admin_audit_log" as never).insert({
        actor_id: context.userId,
        actor_email: (context.claims as { email?: string } | null)?.email ?? null,
        action: "reset_database",
        details: { scopes: data.scopes, tables, result: deleted },
      } as never);
    } catch {
      // ignore audit log error if table doesn't exist
    }

    return { deleted };
  });
