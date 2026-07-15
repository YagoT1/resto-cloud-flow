import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.order_id ?? "");
    if (!orderId || orderId.length > 64) return json({ error: "order_id requerido" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch order + restaurant + items
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, order_number, restaurant_id, branch_id, total, status")
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) return json({ error: "Pedido no encontrado" }, 404);
    if (order.status === "paid" || order.status === "cancelled") {
      return json({ error: "Pedido no cobrable" }, 400);
    }

    // Verify caller belongs to restaurant
    const { data: prof } = await admin
      .from("profiles").select("restaurant_id").eq("id", claims.claims.sub).maybeSingle();
    if (!prof || prof.restaurant_id !== order.restaurant_id) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: items } = await admin
      .from("order_items").select("product_name, quantity, unit_price")
      .eq("order_id", orderId);

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) return json({ error: "MP no configurado" }, 500);

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`;

    const preference = {
      items: (items ?? []).map((i) => ({
        title: String(i.product_name).slice(0, 250),
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        currency_id: "ARS",
      })),
      external_reference: order.id,
      notification_url: webhookUrl,
      metadata: { order_id: order.id, restaurant_id: order.restaurant_id, branch_id: order.branch_id },
      statement_descriptor: `Pedido #${order.order_number}`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    });
    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP error", mpData);
      return json({ error: "MP error", details: mpData?.message ?? null }, 502);
    }

    return json({
      preference_id: mpData.id,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
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
