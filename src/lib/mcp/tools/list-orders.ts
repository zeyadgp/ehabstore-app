import { defineTool } from "@lovable.dev/mcp-js";
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
  name: "list_orders",
  title: "List store orders",
  description:
    "List recent store orders with their items. Only store admins can read orders; other users get an empty list.",
  inputSchema: {
    status: z.enum(STATUSES).optional().describe("Filter by order status."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max orders to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("orders")
      .select(
        "id,order_number,status,payment_status,payment_method,total,currency_label,customer_name,phone,city,district,created_at,order_items(product_name,quantity,price)",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const orders = data ?? [];
    if (orders.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No orders visible for this account (store admin access is required to read orders).",
          },
        ],
        structuredContent: { orders: [] },
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(orders) }],
      structuredContent: { orders },
    };
  },
});
