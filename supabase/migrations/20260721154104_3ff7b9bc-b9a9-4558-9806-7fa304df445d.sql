CREATE TABLE public.restaurant_integration_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  ciphertext bytea NOT NULL,
  iv bytea NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, provider)
);

-- No grants to anon or authenticated: only service_role (edge functions) may access.
GRANT ALL ON public.restaurant_integration_secrets TO service_role;

ALTER TABLE public.restaurant_integration_secrets ENABLE ROW LEVEL SECURITY;

-- Explicit deny-by-default: no policies for anon/authenticated means no access.
-- service_role bypasses RLS by design.

CREATE TRIGGER restaurant_integration_secrets_updated_at
  BEFORE UPDATE ON public.restaurant_integration_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();