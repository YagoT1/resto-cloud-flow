CREATE TABLE public.mp_secret_rotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  rotated_by uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mp_secret_rotations_restaurant_idx
  ON public.mp_secret_rotations (restaurant_id, created_at DESC);

GRANT SELECT, INSERT ON public.mp_secret_rotations TO authenticated;
GRANT ALL ON public.mp_secret_rotations TO service_role;

ALTER TABLE public.mp_secret_rotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/managers can view rotations of their restaurant"
  ON public.mp_secret_rotations
  FOR SELECT
  TO authenticated
  USING (public.is_owner_or_manager(auth.uid(), restaurant_id));

CREATE POLICY "Owners/managers can log rotations for their restaurant"
  ON public.mp_secret_rotations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_owner_or_manager(auth.uid(), restaurant_id)
    AND rotated_by = auth.uid()
  );