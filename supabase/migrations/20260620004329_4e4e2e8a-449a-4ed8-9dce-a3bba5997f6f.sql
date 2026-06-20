
-- Enums
DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash','debit','credit','transfer','mercadopago','qr','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending','approved','rejected','refunded','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cash_session_status AS ENUM ('open','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cash sessions (turnos)
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL,
  closed_by uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_amount numeric NOT NULL DEFAULT 0,
  closing_amount numeric,
  expected_cash numeric,
  difference numeric,
  notes text,
  status public.cash_session_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_session_per_branch
  ON public.cash_sessions(branch_id) WHERE status = 'open';

GRANT SELECT, INSERT, UPDATE ON public.cash_sessions TO authenticated;
GRANT ALL ON public.cash_sessions TO service_role;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read cash_sessions"
ON public.cash_sessions FOR SELECT TO authenticated
USING (public.belongs_to_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "owner manager open cash_sessions"
ON public.cash_sessions FOR INSERT TO authenticated
WITH CHECK (public.is_owner_or_manager(auth.uid(), restaurant_id) AND opened_by = auth.uid());

CREATE POLICY "owner manager update cash_sessions"
ON public.cash_sessions FOR UPDATE TO authenticated
USING (public.is_owner_or_manager(auth.uid(), restaurant_id))
WITH CHECK (public.is_owner_or_manager(auth.uid(), restaurant_id));

CREATE TRIGGER trg_cash_sessions_updated
BEFORE UPDATE ON public.cash_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  cash_session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  method public.payment_method NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  tip numeric NOT NULL DEFAULT 0 CHECK (tip >= 0),
  reference text,
  external_id text,
  status public.payment_status NOT NULL DEFAULT 'approved',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_branch_created ON public.payments(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_session ON public.payments(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);

GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read payments"
ON public.payments FOR SELECT TO authenticated
USING (public.belongs_to_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "owner manager insert payments"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (public.is_owner_or_manager(auth.uid(), restaurant_id));

CREATE POLICY "owner manager update payments"
ON public.payments FOR UPDATE TO authenticated
USING (public.is_owner_or_manager(auth.uid(), restaurant_id))
WITH CHECK (public.is_owner_or_manager(auth.uid(), restaurant_id));

CREATE TRIGGER trg_payments_updated
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: close a cash session computing expected cash and difference
CREATE OR REPLACE FUNCTION public.close_cash_session(
  p_session_id uuid,
  p_closing_amount numeric,
  p_notes text DEFAULT NULL
) RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.cash_sessions;
  v_cash_total numeric := 0;
BEGIN
  SELECT * INTO s FROM public.cash_sessions WHERE id = p_session_id;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Turno no encontrado'; END IF;
  IF s.status <> 'open' THEN RAISE EXCEPTION 'El turno ya está cerrado'; END IF;
  IF NOT public.is_owner_or_manager(auth.uid(), s.restaurant_id) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  SELECT COALESCE(SUM(amount + tip), 0) INTO v_cash_total
  FROM public.payments
  WHERE cash_session_id = p_session_id
    AND method = 'cash'
    AND status = 'approved';

  UPDATE public.cash_sessions
  SET status = 'closed',
      closed_by = auth.uid(),
      closed_at = now(),
      closing_amount = p_closing_amount,
      expected_cash = s.opening_amount + v_cash_total,
      difference = p_closing_amount - (s.opening_amount + v_cash_total),
      notes = COALESCE(p_notes, notes)
  WHERE id = p_session_id
  RETURNING * INTO s;

  RETURN s;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_cash_session(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_cash_session(uuid, numeric, text) TO authenticated;
