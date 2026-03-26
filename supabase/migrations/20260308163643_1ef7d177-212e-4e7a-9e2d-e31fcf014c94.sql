CREATE OR REPLACE FUNCTION public.handle_new_user_signup(
  _user_id uuid,
  _full_name text,
  _role app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (_user_id, _full_name)
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create user settings with display ID
  INSERT INTO public.user_settings (user_id, display_id)
  VALUES (_user_id, generate_display_id())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;