-- Payment status enum
DO $$ BEGIN
  CREATE TYPE public.order_payment_status AS ENUM ('pending','approved','rejected','refunded','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status public.order_payment_status NOT NULL DEFAULT 'pending';

-- Ensure realtime delivers full row on updates
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Add to realtime publication (idempotent)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;