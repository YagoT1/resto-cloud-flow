-- Add a dedicated table to track processed MP webhook events for strong idempotency
CREATE TABLE IF NOT EXISTS public.mp_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.mp_webhook_events TO service_role;

ALTER TABLE public.mp_webhook_events ENABLE ROW LEVEL SECURITY;

-- No client-side access; only service_role (edge functions) touches this table.

-- Reinforce idempotency on payments: unique per method + reference (ignore NULL refs for cash/other)
CREATE UNIQUE INDEX IF NOT EXISTS payments_method_reference_uidx
  ON public.payments (method, reference)
  WHERE reference IS NOT NULL;
