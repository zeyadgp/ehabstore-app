import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminCaller } from "@/lib/caller.server";
import { syncOrderCommissionStatus, reverseOrderCommissions } from "./commissions.server";

const updateCommissionStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.string().trim().min(2).max(30),
});

const reverseOrderItemSchema = z.object({
  orderId: z.string().uuid(),
  orderItemId: z.string().uuid(),
});

/**
 * تحديث ومزامنة حالة عمولة الطلب (مخصصة للمديرين فقط)
 * - استقرار العمولة عند الاكتمال/التسليم
 * - عكس العمولة عند الإلغاء/الاسترجاع
 */
export const updateOrderCommissionStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateCommissionStatusSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdminCaller();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await syncOrderCommissionStatus(supabaseAdmin, data.orderId, data.status);
  });

/**
 * عكس عمولة صنف معين داخل طلب عند الاسترجاع الجزئي (Partial Return)
 */
export const reverseOrderItemCommission = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reverseOrderItemSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdminCaller();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await reverseOrderCommissions(supabaseAdmin, data.orderId, data.orderItemId);
  });
