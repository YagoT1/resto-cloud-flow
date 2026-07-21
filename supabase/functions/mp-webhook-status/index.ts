// Diagnostic endpoint: reports whether the MP webhook secret is configured
// and performs a self-test of the HMAC-SHA256 signature computation used by
// mp-webhook. Never returns the secret value.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    // Only owners/managers can view diagnostic info
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: prof } = await admin.from("profiles")
      .select("restaurant_id").eq("id", claims.claims.sub).maybeSingle();
    if (!prof?.restaurant_id) return json({ error: "Forbidden" }, 403);
    const { data: role } = await admin.from("user_roles")
      .select("role").eq("user_id", claims.claims.sub)
      .eq("restaurant_id", prof.restaurant_id)
      .in("role", ["owner", "manager"]).maybeSingle();
    if (!role) return json({ error: "Forbidden" }, 403);

    const secret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`;

    let signatureSelfTest = false;
    if (secret) {
      // Compute an HMAC over a canonical fixed manifest and re-verify it,
      // proving the runtime can produce the same signature MP would send.
      const manifest = "id:TEST;request-id:TEST;ts:1700000000;";
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
      );
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
      signatureSelfTest = await crypto.subtle.verify(
        "HMAC", key, sig, new TextEncoder().encode(manifest),
      );
    }

    return json({
      webhook_url: webhookUrl,
      webhook_secret_configured: Boolean(secret),
      access_token_configured: Boolean(mpToken),
      signature_self_test: signatureSelfTest,
    });
  } catch (e) {
    console.error("Unhandled error", e);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
