import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const STATUSES = [
  "new",
  "reviewing",
  "confirmed",
  "processing",
  "shipped",
  "completed",
  "cancelled",
  "ready",
  "delivered",
  "returned",
  "no_contact",
  "on_hold",
] as const;

export default defineTool({
  name: "update_order_status",
  title: "Update order status",
  description: "Move a store order to a new status. Requires store admin access.",
  inputSchema: {
    order_id: z.string().trim().min(1).describe("The order id (uuid)."),
    status: z.enum(STATUSES).describe("The new order status."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ order_id, status }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", order_id)
      .select("id,order_number,status")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      throw new ToolError(
        "Order not updated — it does not exist or this account is not a store admin.",
      );

    try {
      const { syncOrderCommissionStatus } = await import("@/lib/commissions.server");
      await syncOrderCommissionStatus(supabase, data.id, status);
    } catch (err) {
      console.warn("syncOrderCommissionStatus from MCP tool error:", err);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { order: data },
    };
  },
});
