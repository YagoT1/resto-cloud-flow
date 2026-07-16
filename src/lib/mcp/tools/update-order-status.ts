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
  name: "update_order_status",
  title: "Update order status",
  description:
    "Update the workflow status of an order (pending, preparing, ready, delivered, paid, cancelled). Requires manager or higher role via RLS.",
  inputSchema: {
    order_id: z.string().uuid().describe("Order UUID."),
    status: z
      .enum(["pending", "preparing", "ready", "delivered", "paid", "cancelled"])
      .describe("New order status."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_id, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("orders")
      .update({ status })
      .eq("id", order_id)
      .select("id, order_number, status, payment_status")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return {
        content: [{ type: "text", text: "Order not found or access denied" }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { order: data },
    };
  },
});
