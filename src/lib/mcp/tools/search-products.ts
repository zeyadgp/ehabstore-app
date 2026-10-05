import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search the store catalog of active products by name or description. Returns price, discount, stock and slug.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .max(100)
      .optional()
      .describe("Text to search in product name/description."),
    only_discounted: z
      .boolean()
      .optional()
      .describe("Return only products that have a discount price."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max products to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, only_discounted, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("products")
      .select("id,name,slug,price,discount_price,stock,sku,is_bestseller,is_featured,description")
      .eq("status", true)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (query) q = q.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    if (only_discounted) q = q.not("discount_price", "is", null);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
