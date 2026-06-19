
CREATE POLICY "owners manage user_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner_or_manager(auth.uid(), restaurant_id));

CREATE POLICY "owners update user_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_owner_or_manager(auth.uid(), restaurant_id))
  WITH CHECK (public.is_owner_or_manager(auth.uid(), restaurant_id));

CREATE POLICY "owners delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    public.is_owner_or_manager(auth.uid(), restaurant_id)
    AND user_id <> auth.uid()
  );

CREATE POLICY "owners update teammate profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    restaurant_id IS NOT NULL
    AND public.is_owner_or_manager(auth.uid(), restaurant_id)
  )
  WITH CHECK (
    restaurant_id IS NOT NULL
    AND public.is_owner_or_manager(auth.uid(), restaurant_id)
  );
