import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    // MP sends either { type, data: { id } } or query params (?type=payment&data.id=...)
    const type = body?.type ?? body?.action?.split(".")[0] ?? url.searchParams.get("type");
    const paymentId =
      body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");

    if (type !== "payment" || !paymentId) {
      return json({ ok: true, ignored: true });
    }

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) return json({ error: "MP no configurado" }, 500);

    // Fetch payment details from MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payment = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP fetch error", payment);
      return json({ error: "MP fetch error" }, 502);
    }

    const orderId: string | null =
      payment?.external_reference ?? payment?.metadata?.order_id ?? null;
    if (!orderId) return json({ ok: true, ignored: true });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order } = await admin
      .from("orders")
      .select("id, restaurant_id, branch_id, status, total")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return json({ ok: true, ignored: true });

    // Idempotency: don't insert same MP payment twice
    const mpRef = String(payment.id);
    const { data: existing } = await admin
      .from("payments").select("id").eq("reference", mpRef).maybeSingle();
    if (existing) return json({ ok: true, already: true });

    const status = payment.status === "approved" ? "approved"
      : payment.status === "rejected" ? "rejected"
      : payment.status === "refunded" ? "refunded"
      : "pending";

    // Find an open cash session on the order's branch (optional link)
    let cashSessionId: string | null = null;
    if (order.branch_id) {
      const { data: s } = await admin
        .from("cash_sessions").select("id")
        .eq("branch_id", order.branch_id).eq("status", "open").maybeSingle();
      cashSessionId = s?.id ?? null;
    }

    await admin.from("payments").insert({
      restaurant_id: order.restaurant_id,
      branch_id: order.branch_id,
      order_id: order.id,
      cash_session_id: cashSessionId,
      method: "mercadopago",
      amount: Number(payment.transaction_amount ?? order.total ?? 0),
      tip: 0,
      reference: mpRef,
      status,
      notes: `MP ${payment.status}${payment.status_detail ? ` · ${payment.status_detail}` : ""}`,
    });

    if (status === "approved" && order.status !== "paid") {
      await admin.from("orders").update({ status: "paid" }).eq("id", order.id);
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
