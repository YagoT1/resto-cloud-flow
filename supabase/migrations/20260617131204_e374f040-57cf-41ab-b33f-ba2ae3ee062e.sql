
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('owner','manager','waiter','kitchen','cashier','customer');
CREATE TYPE public.subscription_plan AS ENUM ('trial','basic','pro','enterprise');
CREATE TYPE public.restaurant_status AS ENUM ('active','suspended','cancelled');
CREATE TYPE public.table_status AS ENUM ('available','occupied','reserved','cleaning');
CREATE TYPE public.order_status AS ENUM ('pending','confirmed','preparing','ready','delivered','cancelled','paid');
CREATE TYPE public.order_type AS ENUM ('dine_in','takeaway','delivery');

-- ============ updated_at helper ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ RESTAURANTS ============
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  plan public.subscription_plan NOT NULL DEFAULT 'trial',
  status public.restaurant_status NOT NULL DEFAULT 'active',
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_restaurants_updated BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  email text,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, restaurant_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _restaurant_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND restaurant_id = _restaurant_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.belongs_to_restaurant(_user_id uuid, _restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND restaurant_id = _restaurant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_manager(_user_id uuid, _restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND restaurant_id = _restaurant_id
      AND role IN ('owner','manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT restaurant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============ BRANCHES ============
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  is_main boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RESTAURANT_TABLES ============
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  number text NOT NULL,
  capacity int NOT NULL DEFAULT 4,
  qr_code text,
  status public.table_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT SELECT ON public.restaurant_tables TO anon;
GRANT ALL ON public.restaurant_tables TO service_role;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tables_updated BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT ON public.categories TO anon;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  order_number serial,
  status public.order_status NOT NULL DEFAULT 'pending',
  type public.order_type NOT NULL DEFAULT 'dine_in',
  customer_name text,
  customer_phone text,
  notes text,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT ON public.orders TO anon;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ORDER_ITEMS ============
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT, INSERT ON public.order_items TO anon;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
-- restaurants
CREATE POLICY "members read own restaurant" ON public.restaurants FOR SELECT TO authenticated
  USING (public.belongs_to_restaurant(auth.uid(), id));
CREATE POLICY "owner manager update restaurant" ON public.restaurants FOR UPDATE TO authenticated
  USING (public.is_owner_or_manager(auth.uid(), id));
CREATE POLICY "anyone can insert restaurant on signup" ON public.restaurants FOR INSERT TO authenticated
  WITH CHECK (true);

-- profiles
CREATE POLICY "users read own profile or same restaurant" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (restaurant_id IS NOT NULL AND public.belongs_to_restaurant(auth.uid(), restaurant_id)));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- user_roles
CREATE POLICY "members read roles of own restaurant" ON public.user_roles FOR SELECT TO authenticated
  USING (public.belongs_to_restaurant(auth.uid(), restaurant_id));

-- branches
CREATE POLICY "members read branches" ON public.branches FOR SELECT TO authenticated
  USING (public.belongs_to_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "anon read active branches" ON public.branches FOR SELECT TO anon USING (active = true);
CREATE POLICY "owner manager manage branches" ON public.branches FOR ALL TO authenticated
  USING (public.is_owner_or_manager(auth.uid(), restaurant_id))
  WITH CHECK (public.is_owner_or_manager(auth.uid(), restaurant_id));

GRANT SELECT ON public.branches TO anon;

-- restaurant_tables
CREATE POLICY "members read tables" ON public.restaurant_tables FOR SELECT TO authenticated
  USING (public.belongs_to_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "anon read tables" ON public.restaurant_tables FOR SELECT TO anon USING (true);
CREATE POLICY "owner manager manage tables" ON public.restaurant_tables FOR ALL TO authenticated
  USING (public.is_owner_or_manager(auth.uid(), restaurant_id))
  WITH CHECK (public.is_owner_or_manager(auth.uid(), restaurant_id));

-- categories
CREATE POLICY "members read categories" ON public.categories FOR SELECT TO authenticated
  USING (public.belongs_to_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "anon read active categories" ON public.categories FOR SELECT TO anon USING (active = true);
CREATE POLICY "owner manager manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.is_owner_or_manager(auth.uid(), restaurant_id))
  WITH CHECK (public.is_owner_or_manager(auth.uid(), restaurant_id));

-- products
CREATE POLICY "members read products" ON public.products FOR SELECT TO authenticated
  USING (public.belongs_to_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "anon read available products" ON public.products FOR SELECT TO anon USING (available = true);
CREATE POLICY "owner manager manage products" ON public.products FOR ALL TO authenticated
  USING (public.is_owner_or_manager(auth.uid(), restaurant_id))
  WITH CHECK (public.is_owner_or_manager(auth.uid(), restaurant_id));

-- orders
CREATE POLICY "members read orders" ON public.orders FOR SELECT TO authenticated
  USING (public.belongs_to_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "members insert orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.belongs_to_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "members update orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.belongs_to_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "anon insert orders" ON public.orders FOR INSERT TO anon WITH CHECK (true);

-- order_items
CREATE POLICY "members read order_items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.belongs_to_restaurant(auth.uid(), o.restaurant_id)));
CREATE POLICY "members manage order_items" ON public.order_items FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.belongs_to_restaurant(auth.uid(), o.restaurant_id)))
  WITH CHECK (EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.belongs_to_restaurant(auth.uid(), o.restaurant_id)));
CREATE POLICY "anon insert order_items" ON public.order_items FOR INSERT TO anon WITH CHECK (true);

-- ============ SIGNUP TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_restaurant_name text;
  v_full_name text;
  v_restaurant_id uuid;
  v_branch_id uuid;
  v_slug text;
BEGIN
  v_restaurant_name := COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'Mi Restaurante');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  v_slug := regexp_replace(lower(v_restaurant_name), '[^a-z0-9]+', '-', 'g') || '-' || substr(NEW.id::text, 1, 8);

  INSERT INTO public.restaurants(name, slug) VALUES (v_restaurant_name, v_slug)
    RETURNING id INTO v_restaurant_id;

  INSERT INTO public.profiles(id, restaurant_id, email, full_name)
    VALUES (NEW.id, v_restaurant_id, NEW.email, v_full_name);

  INSERT INTO public.user_roles(user_id, restaurant_id, role)
    VALUES (NEW.id, v_restaurant_id, 'owner');

  INSERT INTO public.branches(restaurant_id, name, is_main)
    VALUES (v_restaurant_id, 'Principal', true)
    RETURNING id INTO v_branch_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
