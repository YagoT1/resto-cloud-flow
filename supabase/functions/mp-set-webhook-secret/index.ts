// Rotate the per-restaurant Mercado Pago webhook secret.
// Owner/manager only. Encrypts the value with the master key, upserts into
// restaurant_integration_secrets, and logs an audit row in mp_secret_rotations.
import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptSecret, uint8ToPgBytea } from "../_shared/integrationSecrets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    const body = await req.json().catch(() => ({}));
    const secret = String(body?.secret ?? "");
    const note = body?.note ? String(body.note).slice(0, 500) : null;
    if (secret.length < 16 || secret.length > 512) {
      return json({ error: "La clave debe tener entre 16 y 512 caracteres" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve caller's restaurant and verify owner/manager role.
    const { data: prof } = await admin.from("profiles")
      .select("restaurant_id").eq("id", userId).maybeSingle();
    if (!prof?.restaurant_id) return json({ error: "Forbidden" }, 403);
    const restaurantId = prof.restaurant_id as string;

    const { data: role } = await admin.from("user_roles")
      .select("role").eq("user_id", userId)
      .eq("restaurant_id", restaurantId)
      .in("role", ["owner", "manager"]).maybeSingle();
    if (!role) return json({ error: "Forbidden" }, 403);

    // Encrypt and upsert.
    const { ciphertext, iv } = await encryptSecret(secret);
    const { error: upErr } = await admin
      .from("restaurant_integration_secrets")
      .upsert({
        restaurant_id: restaurantId,
        provider: "mercadopago_webhook",
        ciphertext: uint8ToPgBytea(ciphertext),
        iv: uint8ToPgBytea(iv),
        updated_by: userId,
      }, { onConflict: "restaurant_id,provider" });
    if (upErr) {
      console.error("upsert secret error", upErr);
      return json({ error: "No se pudo guardar la clave" }, 500);
    }

    // Audit log (server-side, using service role so the row is guaranteed).
    await admin.from("mp_secret_rotations").insert({
      restaurant_id: restaurantId,
      rotated_by: userId,
      note,
    });

    return json({ ok: true });
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
