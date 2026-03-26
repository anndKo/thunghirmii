-- Fix signup bootstrap so profile/role creation happens when auth.users is created.
-- This avoids failures when email confirmation is enabled and no session exists yet.

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

  IF public.is_first_user() THEN
    effective_role := 'admin'::public.app_role;
  ELSE
    effective_role := requested_role;
  END IF;

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
