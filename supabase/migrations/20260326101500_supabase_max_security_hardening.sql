-- MAX SECURITY HARDENING
-- Principle: default deny, minimal grants, server-side bootstrap only.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Harden helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_role(_uid uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _uid
      AND ur.role::text = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_first_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'::public.app_role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_first_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_signup(uuid, text, public.app_role) FROM PUBLIC, anon, authenticated;

-- Keep only the explicit authenticated RPC the app still needs.
GRANT EXECUTE ON FUNCTION public.get_admin_user_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Force RLS on sensitive tables
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settings FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.banned_users FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.device_support_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.protection_passwords FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.security_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blocked_devices FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Lock down user_roles completely except owner read + admin manage
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Roles read" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_authenticated" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_authenticated" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can read user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role" ON user_roles;
DROP POLICY IF EXISTS "user can insert own role" ON user_roles;
DROP POLICY IF EXISTS "insert own role" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert_admin_or_first" ON public.user_roles;
DROP POLICY IF EXISTS "Only admin or first user can insert roles" ON public.user_roles;

CREATE POLICY "user_roles_select_self"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_roles_admin_all"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Lock down user_settings
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view all user settings" ON public.user_settings;
DROP POLICY IF EXISTS "Anyone can read user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_select_authenticated" ON public.user_settings;
DROP POLICY IF EXISTS "Authenticated users can view user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_select_own" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_select_admin" ON public.user_settings;
DROP POLICY IF EXISTS "Users can create their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_insert_own" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_update_own" ON public.user_settings;
DROP POLICY IF EXISTS "Admin can view all settings" ON public.user_settings;

CREATE POLICY "user_settings_select_self"
  ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings_select_admin"
  ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "user_settings_insert_self"
  ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update_self"
  ON public.user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Lock down settings to authenticated read, admin write only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can read settings" ON public.settings;
DROP POLICY IF EXISTS "Users view settings" ON public.settings;
DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.settings;
DROP POLICY IF EXISTS "Admin can manage settings" ON public.settings;
DROP POLICY IF EXISTS "Admin manage all settings" ON public.settings;
DROP POLICY IF EXISTS "Admin manage settings" ON public.settings;

CREATE POLICY "settings_select_authenticated"
  ON public.settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "settings_admin_all"
  ON public.settings
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. Lock down ban + support flows
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own ban" ON public.banned_users;
DROP POLICY IF EXISTS "Users can check own ban status" ON public.banned_users;
DROP POLICY IF EXISTS "Admin can manage bans" ON public.banned_users;
DROP POLICY IF EXISTS "Anon can check ban by user_id" ON public.banned_users;

CREATE POLICY "banned_users_select_self"
  ON public.banned_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "banned_users_admin_all"
  ON public.banned_users
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can insert support requests" ON public.device_support_requests;
DROP POLICY IF EXISTS "Authenticated users can insert support requests" ON public.device_support_requests;
DROP POLICY IF EXISTS "device_support_insert_authenticated" ON public.device_support_requests;
DROP POLICY IF EXISTS "Admin can view support requests" ON public.device_support_requests;
DROP POLICY IF EXISTS "device_support_select_admin" ON public.device_support_requests;
DROP POLICY IF EXISTS "Admin can update support requests" ON public.device_support_requests;
DROP POLICY IF EXISTS "device_support_update_admin" ON public.device_support_requests;
DROP POLICY IF EXISTS "Admin can delete support requests" ON public.device_support_requests;
DROP POLICY IF EXISTS "device_support_delete_admin" ON public.device_support_requests;

CREATE POLICY "device_support_insert_authenticated"
  ON public.device_support_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "device_support_admin_all"
  ON public.device_support_requests
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 7. Protection passwords: owner full access, admin read only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own protection password" ON public.protection_passwords;
DROP POLICY IF EXISTS "Users can view own protection" ON public.protection_passwords;
DROP POLICY IF EXISTS "Users can insert own protection password" ON public.protection_passwords;
DROP POLICY IF EXISTS "Users can insert own protection" ON public.protection_passwords;
DROP POLICY IF EXISTS "Users can update own protection password" ON public.protection_passwords;
DROP POLICY IF EXISTS "Users can update own protection" ON public.protection_passwords;
DROP POLICY IF EXISTS "Users can delete own protection password" ON public.protection_passwords;
DROP POLICY IF EXISTS "Admin can view all protection passwords" ON public.protection_passwords;
DROP POLICY IF EXISTS "Admin can view all protection" ON public.protection_passwords;
DROP POLICY IF EXISTS "Admin can update all protection passwords" ON public.protection_passwords;
DROP POLICY IF EXISTS "Anon can check protection password exists" ON public.protection_passwords;

CREATE POLICY "protection_passwords_select_self"
  ON public.protection_passwords
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "protection_passwords_insert_self"
  ON public.protection_passwords
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "protection_passwords_update_self"
  ON public.protection_passwords
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "protection_passwords_delete_self"
  ON public.protection_passwords
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "protection_passwords_admin_read"
  ON public.protection_passwords
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 8. Safe signup bootstrap only from auth.users trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role public.app_role;
  effective_role public.app_role;
  meta_full_name text;
  meta_phone text;
BEGIN
  PERFORM pg_advisory_xact_lock(20260326);

  meta_full_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), '');
  meta_phone := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), '');

  BEGIN
    requested_role := COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'role', '')::public.app_role, 'tenant'::public.app_role);
  EXCEPTION
    WHEN others THEN
      requested_role := 'tenant'::public.app_role;
  END;

  effective_role := CASE
    WHEN public.is_first_user() THEN 'admin'::public.app_role
    ELSE requested_role
  END;

  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, COALESCE(meta_full_name, split_part(NEW.email, '@', 1), 'User'), meta_phone)
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, effective_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_settings (user_id, display_id)
  VALUES (NEW.id, public.generate_display_id())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap ON auth.users;

CREATE TRIGGER on_auth_user_created_bootstrap
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_created();

COMMIT;
