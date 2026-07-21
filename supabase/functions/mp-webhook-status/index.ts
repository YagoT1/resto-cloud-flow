// Diagnostic endpoint: reports whether the MP webhook secret is configured
// (per-restaurant override or global env) and performs an HMAC self-test.
// Never returns the secret value itself.
import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptSecret, pgByteaToUint8 } from "../_shared/integrationSecrets.ts";

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
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: prof } = await admin.from("profiles")
      .select("restaurant_id").eq("id", userId).maybeSingle();
    if (!prof?.restaurant_id) return json({ error: "Forbidden" }, 403);
    const restaurantId = prof.restaurant_id as string;
    const { data: role } = await admin.from("user_roles")
      .select("role").eq("user_id", userId)
      .eq("restaurant_id", restaurantId)
      .in("role", ["owner", "manager"]).maybeSingle();
    if (!role) return json({ error: "Forbidden" }, 403);

    // Determine which secret would be used at verification time.
    let secret: string | null = null;
    let source: "per_restaurant" | "env" | null = null;
    const { data: row } = await admin
      .from("restaurant_integration_secrets")
      .select("ciphertext, iv, updated_at, updated_by")
      .eq("restaurant_id", restaurantId)
      .eq("provider", "mercadopago_webhook")
      .maybeSingle();
    if (row?.ciphertext && row?.iv) {
      try {
        secret = await decryptSecret(pgByteaToUint8(row.ciphertext), pgByteaToUint8(row.iv));
        source = "per_restaurant";
      } catch (e) {
        console.error("decrypt error", e);
      }
    }
    if (!secret) {
      const env = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
      if (env) {
        secret = env;
        source = "env";
      }
    }

    let signatureSelfTest = false;
    if (secret) {
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
      webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
      webhook_secret_configured: Boolean(secret),
      webhook_secret_source: source,
      per_restaurant_updated_at: row?.updated_at ?? null,
      access_token_configured: Boolean(Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")),
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
