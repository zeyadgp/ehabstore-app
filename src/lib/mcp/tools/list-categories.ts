import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_categories",
  title: "List categories",
  description:
    "List the store's active categories (hierarchical: parent_id links a subcategory to its parent).",
  inputSchema: {
    parent_id: z.string().trim().optional().describe("Only return children of this category id."),
    top_level_only: z.boolean().optional().describe("Only return root categories (no parent)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ parent_id, top_level_only }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("categories")
      .select("id,name,slug,parent_id,kind,description,sort_order,is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (parent_id) q = q.eq("parent_id", parent_id);
    else if (top_level_only) q = q.is("parent_id", null);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { categories: data ?? [] },
    };
  },
});
