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
  name: "list_orders",
  title: "List orders",
  description:
    "List recent orders for the signed-in user's restaurant. Optional filters by status and branch.",
  inputSchema: {
    status: z
      .enum(["pending", "preparing", "ready", "delivered", "paid", "cancelled"])
      .optional()
      .describe("Optional order status filter."),
    branch_id: z.string().uuid().optional().describe("Optional branch UUID filter."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (1-100, default 25)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, branch_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("orders")
      .select(
        "id, order_number, status, payment_status, type, customer_name, subtotal, total, branch_id, table_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    if (branch_id) q = q.eq("branch_id", branch_id);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});
