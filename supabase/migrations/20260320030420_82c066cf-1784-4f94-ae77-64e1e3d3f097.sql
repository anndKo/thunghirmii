
-- 1. Device fingerprint columns
ALTER TABLE public.daily_checkins ADD COLUMN IF NOT EXISTS device_fingerprint text;
ALTER TABLE public.reward_history ADD COLUMN IF NOT EXISTS device_fingerprint text;

-- 2. User unlocks table
CREATE TABLE IF NOT EXISTS public.user_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid,
  feature_type text NOT NULL,
  points_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, room_id, feature_type)
);
ALTER TABLE public.user_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own unlocks" ON public.user_unlocks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own unlocks" ON public.user_unlocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. Fix missing approval_status on rooms
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

-- 4. Fix missing avatar_url on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 5. Create missing banned_users table
CREATE TABLE IF NOT EXISTS public.banned_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ban" ON public.banned_users FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage bans" ON public.banned_users FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- 6. Create missing protection_passwords table
CREATE TABLE IF NOT EXISTS public.protection_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  password_hash text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.protection_passwords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own protection" ON public.protection_passwords FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own protection" ON public.protection_passwords FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own protection" ON public.protection_passwords FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin can view all protection" ON public.protection_passwords FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- 7. Create handle_new_user_signup function
CREATE OR REPLACE FUNCTION public.handle_new_user_signup(
  _user_id uuid,
  _full_name text,
  _role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name) VALUES (_user_id, _full_name);
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
END;
$$;

-- 8. Function to check device fingerprint usage today (cross-user)
CREATE OR REPLACE FUNCTION public.check_device_reward_today(
  _fingerprint text,
  _action_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _action_type IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.daily_checkins
      WHERE device_fingerprint = _fingerprint
      AND checkin_date = CURRENT_DATE
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM public.reward_history
      WHERE device_fingerprint = _fingerprint
      AND action_type = _action_type
      AND created_at >= CURRENT_DATE::timestamptz
      AND created_at < (CURRENT_DATE + interval '1 day')::timestamptz
    );
  END IF;
END;
$$;
