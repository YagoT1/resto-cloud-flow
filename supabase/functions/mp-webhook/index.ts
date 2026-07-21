import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptSecret, pgByteaToUint8 } from "../_shared/integrationSecrets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

async function verifyMpSignature(
  secret: string,
  req: Request,
  rawBody: string,
  dataId: string | null,
): Promise<boolean> {
  const sigHeader = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id");
  if (!sigHeader || !requestId) return false;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = dataId
    ? `id:${dataId};request-id:${requestId};ts:${ts};`
    : `request-id:${requestId};ts:${ts};${rawBody}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const computed = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computed.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};

    const type = body?.type ?? body?.action?.split(".")[0] ?? url.searchParams.get("type");
    const paymentId =
      body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) return json({ error: "MP no configurado" }, 500);

    // Fetch payment first so we can resolve the restaurant and use its per-restaurant secret.
    if (type !== "payment" || !paymentId) {
      return json({ ok: true, ignored: true });
    }

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

    // Resolve signature secret: per-restaurant override wins, env fallback otherwise.
    let secret: string | null = null;
    const { data: row } = await admin
      .from("restaurant_integration_secrets")
      .select("ciphertext, iv")
      .eq("restaurant_id", order.restaurant_id)
      .eq("provider", "mercadopago_webhook")
      .maybeSingle();
    if (row?.ciphertext && row?.iv) {
      try {
        secret = await decryptSecret(pgByteaToUint8(row.ciphertext), pgByteaToUint8(row.iv));
      } catch (e) {
        console.error("decrypt error", e);
      }
    }
    if (!secret) secret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") ?? null;
    if (!secret) return json({ error: "Signing secret not configured" }, 401);

    const ok = await verifyMpSignature(secret, req, rawBody, paymentId ? String(paymentId) : null);
    if (!ok) return json({ error: "Invalid signature" }, 401);

    const mpRef = String(payment.id);
    const status = payment.status === "approved" ? "approved"
      : payment.status === "rejected" ? "rejected"
      : payment.status === "refunded" ? "refunded"
      : "pending";

    // Idempotency guard #1: dedicated event log keyed by MP payment_id.
    const { error: evtErr } = await admin
      .from("mp_webhook_events")
      .insert({ payment_id: mpRef, order_id: orderId, status, raw: payment });
    if (evtErr) {
      if ((evtErr as { code?: string }).code === "23505") {
        return json({ ok: true, already: true });
      }
      console.error("event log insert error", evtErr);
      return json({ error: "event log error" }, 500);
    }

    let cashSessionId: string | null = null;
    if (order.branch_id) {
      const { data: s } = await admin
        .from("cash_sessions").select("id")
        .eq("branch_id", order.branch_id).eq("status", "open").maybeSingle();
      cashSessionId = s?.id ?? null;
    }

    // Idempotency guard #2: upsert on (method, reference) unique index.
    await admin.from("payments").upsert({
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
    }, { onConflict: "method,reference" });

    const orderPatch: Record<string, string> = { payment_status: status };
    if (status === "approved" && order.status !== "paid") {
      orderPatch.status = "paid";
    }
    await admin.from("orders").update(orderPatch).eq("id", order.id);

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
