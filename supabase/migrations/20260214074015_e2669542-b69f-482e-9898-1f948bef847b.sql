-- ================================
-- EXTENSIONS
-- ================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================
-- PROFILES
-- ================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
CREATE POLICY "Anyone can read profiles"
ON public.profiles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ================================
-- USER ROLES
-- ================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'tenant',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read user_roles" ON public.user_roles;
CREATE POLICY "Anyone can read user_roles"
ON public.user_roles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
CREATE POLICY "Users can insert own role"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ================================
-- USER SETTINGS
-- ================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_id text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read user_settings" ON public.user_settings;
CREATE POLICY "Anyone can read user_settings"
ON public.user_settings FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
ON public.user_settings FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
ON public.user_settings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ================================
-- ROOMS
-- ================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  room_number text NOT NULL DEFAULT '',
  room_code text,
  description text,
  price numeric NOT NULL DEFAULT 0,
  area numeric,
  province text,
  district text,
  ward text,
  address_detail text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  amenities text[],
  images text[],
  videos text[],
  media_urls text[],
  is_available boolean NOT NULL DEFAULT true,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read rooms" ON public.rooms;
CREATE POLICY "Anyone can read rooms"
ON public.rooms FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Landlords can insert rooms" ON public.rooms;
CREATE POLICY "Landlords can insert rooms"
ON public.rooms FOR INSERT TO authenticated
WITH CHECK (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Landlords can update own rooms" ON public.rooms;
CREATE POLICY "Landlords can update own rooms"
ON public.rooms FOR UPDATE TO authenticated
USING (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Landlords can delete own rooms" ON public.rooms;
CREATE POLICY "Landlords can delete own rooms"
ON public.rooms FOR DELETE TO authenticated
USING (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Admin can update rooms" ON public.rooms;
CREATE POLICY "Admin can update rooms"
ON public.rooms FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ================================
-- ROOM REQUESTS
-- ================================
CREATE TABLE IF NOT EXISTS public.room_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  landlord_viewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.room_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read room_requests" ON public.room_requests;
CREATE POLICY "Anyone can read room_requests"
ON public.room_requests FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Tenants can insert requests" ON public.room_requests;
CREATE POLICY "Tenants can insert requests"
ON public.room_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Admin can update requests" ON public.room_requests;
CREATE POLICY "Admin can update requests"
ON public.room_requests FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ================================
-- MESSAGES
-- ================================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
CREATE POLICY "Users can read own messages"
ON public.messages FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update own received messages" ON public.messages;
CREATE POLICY "Users can update own received messages"
ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = receiver_id);

-- ================================
-- PAYMENT REQUESTS
-- ================================
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  amount numeric,
  due_day integer NOT NULL,
  note text,
  qr_url text,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own payment_requests" ON public.payment_requests;
CREATE POLICY "Users can read own payment_requests"
ON public.payment_requests FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can insert payment_requests" ON public.payment_requests;
CREATE POLICY "Users can insert payment_requests"
ON public.payment_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update own payment_requests" ON public.payment_requests;
CREATE POLICY "Users can update own payment_requests"
ON public.payment_requests FOR UPDATE TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
