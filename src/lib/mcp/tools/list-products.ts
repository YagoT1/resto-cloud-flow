import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_products",
  title: "List menu products",
  description: "List menu products for the signed-in user's restaurant.",
  inputSchema: {
    category_id: z.string().uuid().optional().describe("Optional category UUID."),
    available_only: z
      .boolean()
      .optional()
      .describe("If true, return only available products. Default false."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ category_id, available_only }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("products")
      .select("id, name, description, price, available, category_id, image_url, sort_order")
      .order("sort_order", { ascending: true });
    if (category_id) q = q.eq("category_id", category_id);
    if (available_only) q = q.eq("available", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
