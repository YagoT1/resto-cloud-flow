
-- Grant Data API access (was missing — RLS alone is not enough)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;
GRANT SELECT ON public.restaurants TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
GRANT SELECT ON public.branches TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT SELECT ON public.categories TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT SELECT ON public.products TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;
GRANT SELECT ON public.restaurant_tables TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT INSERT, SELECT ON public.orders TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
GRANT INSERT, SELECT ON public.order_items TO anon;

-- Allow anyone to read basic restaurant info (needed to render public menu by slug)
DO $$ BEGIN
  CREATE POLICY "anon read restaurants" ON public.restaurants FOR SELECT TO anon USING (status = 'active');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
