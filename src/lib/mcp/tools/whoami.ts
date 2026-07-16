import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description:
    "Return the signed-in user's profile, roles, and restaurant. Useful to verify connectivity and identity.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const { data: profile } = await sb
      .from("profiles")
      .select("id, email, full_name, restaurant_id")
      .eq("id", userId!)
      .maybeSingle();
    let restaurant: unknown = null;
    let roles: string[] = [];
    if (profile?.restaurant_id) {
      const { data: r } = await sb
        .from("restaurants")
        .select("id, name, slug, plan, status")
        .eq("id", profile.restaurant_id)
        .maybeSingle();
      restaurant = r;
      const { data: rr } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("restaurant_id", profile.restaurant_id);
      roles = (rr ?? []).map((x: { role: string }) => x.role);
    }
    const result = { user_id: userId, email: ctx.getUserEmail(), profile, restaurant, roles };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
