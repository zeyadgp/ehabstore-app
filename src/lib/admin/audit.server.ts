import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuditActionType =
  | "order_status_changed"
  | "order_deleted"
  | "product_created"
  | "product_updated"
  | "product_deleted"
  | "inventory_updated"
  | "settings_updated"
  | "secrets_status_viewed"
  | "loyalty_points_adjusted"
  | "coupon_created"
  | "coupon_deleted";

export type RecordAuditParams = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: AuditActionType | string;
  targetTable?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
};

/**
 * تسجل عملية إدارية في سجل التدقيق admin_audit_log.
 * تعمل داخل الخادم فقط ولا تسرب استثناءات قد توقف سير العمل الأساسي.
 */
export async function recordAdminAudit(params: RecordAuditParams): Promise<void> {
  try {
    // تنقية التفاصيل لمنع تسريب أسرار أو كلمات مرور
    const sanitizedDetails: Record<string, unknown> = {};
    if (params.details) {
      for (const [key, val] of Object.entries(params.details)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("password") ||
          lowerKey.includes("token") ||
          lowerKey.includes("secret") ||
          lowerKey.includes("key")
        ) {
          sanitizedDetails[key] = "[PROTECTED]";
        } else {
          sanitizedDetails[key] = val;
        }
      }
    }

    const { error } = await supabaseAdmin.from("admin_audit_log" as any).insert({
      actor_id: params.actorId ?? null,
      actor_email: params.actorEmail ?? null,
      action: params.action,
      target_table: params.targetTable ?? null,
      target_id: params.targetId ?? null,
      details: sanitizedDetails,
      ip: params.ip ?? null,
    });

    if (error) {
      console.warn("[AdminAudit] Failed to insert audit log:", error.message);
    }
  } catch (err) {
    console.error("[AdminAudit] Unexpected error while recording audit:", err);
  }
}
