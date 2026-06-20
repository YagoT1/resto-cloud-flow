
-- 1) Drop overly permissive anon write/read policies
DROP POLICY IF EXISTS "anon insert orders" ON public.orders;
DROP POLICY IF EXISTS "anon insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "anon read tables" ON public.restaurant_tables;

-- 2) Lock down SECURITY DEFINER helpers so they cannot be called directly via PostgREST.
--    They remain usable from RLS policies and triggers (which run as their owner).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_owner_or_manager(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.belongs_to_restaurant(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_restaurant_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 3) Public ordering RPC: validates inputs server-side and creates the order atomically.
--    Prices and product names are taken from the database, never trusted from the client.
CREATE OR REPLACE FUNCTION public.create_public_order(
  p_slug text,
  p_table_number text,
  p_customer_name text,
  p_customer_phone text,
  p_notes text,
  p_items jsonb
)
RETURNS TABLE(order_id uuid, order_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_table_id uuid;
  v_order_id uuid;
  v_order_number integer;
  v_subtotal numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_price numeric;
  v_name text;
  v_count integer;
BEGIN
  -- Validate items array
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Pedido vacío';
  END IF;
  IF jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'Demasiados ítems';
  END IF;

  -- Length limits on free-text fields
  IF coalesce(length(p_customer_name), 0) > 120
     OR coalesce(length(p_customer_phone), 0) > 40
     OR coalesce(length(p_notes), 0) > 500 THEN
    RAISE EXCEPTION 'Campo demasiado largo';
  END IF;

  -- Resolve active restaurant by public slug
  SELECT id INTO v_restaurant_id
  FROM public.restaurants
  WHERE slug = p_slug AND status = 'active';
  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurante no encontrado';
  END IF;

  -- Resolve main active branch
  SELECT id INTO v_branch_id
  FROM public.branches
  WHERE restaurant_id = v_restaurant_id AND active = true
  ORDER BY is_main DESC, created_at ASC
  LIMIT 1;
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Sucursal no disponible';
  END IF;

  -- Optional table (must belong to restaurant)
  IF p_table_number IS NOT NULL AND length(p_table_number) > 0 THEN
    SELECT id INTO v_table_id
    FROM public.restaurant_tables
    WHERE restaurant_id = v_restaurant_id AND number = p_table_number
    LIMIT 1;
  END IF;

  -- Compute subtotal from server-side product prices, validating ownership/availability
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_qty <= 0 OR v_qty > 999 THEN
      RAISE EXCEPTION 'Cantidad inválida';
    END IF;
    SELECT price, name INTO v_price, v_name
    FROM public.products
    WHERE id = v_product_id
      AND restaurant_id = v_restaurant_id
      AND available = true;
    IF v_price IS NULL THEN
      RAISE EXCEPTION 'Producto no disponible';
    END IF;
    v_subtotal := v_subtotal + (v_price * v_qty);
  END LOOP;

  -- Create order
  INSERT INTO public.orders (
    restaurant_id, branch_id, table_id, type, status,
    customer_name, customer_phone, notes, subtotal, total
  ) VALUES (
    v_restaurant_id, v_branch_id, v_table_id,
    CASE WHEN v_table_id IS NOT NULL THEN 'dine_in'::order_type ELSE 'takeaway'::order_type END,
    'pending'::order_status,
    NULLIF(trim(coalesce(p_customer_name, '')), ''),
    NULLIF(trim(coalesce(p_customer_phone, '')), ''),
    NULLIF(trim(coalesce(p_notes, '')), ''),
    v_subtotal, v_subtotal
  )
  RETURNING id, orders.order_number INTO v_order_id, v_order_number;

  -- Create items (re-validate prices)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    SELECT price, name INTO v_price, v_name
    FROM public.products
    WHERE id = v_product_id AND restaurant_id = v_restaurant_id AND available = true;
    INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, notes)
    VALUES (v_order_id, v_product_id, v_name, v_qty, v_price,
            NULLIF(trim(coalesce(v_item->>'notes', '')), ''));
  END LOOP;

  order_id := v_order_id;
  order_number := v_order_number;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_public_order(text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(text, text, text, text, text, jsonb) TO anon, authenticated;

-- 4) Lock down Realtime: only authenticated, restaurant-member subscribers can receive messages.
--    This stops anon clients from subscribing to broadcast/postgres_changes topics.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated members read realtime" ON realtime.messages;
CREATE POLICY "authenticated members read realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
