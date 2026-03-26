
-- Add unique constraint on device_fingerprints for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_fp_user_hash ON public.device_fingerprints (user_id, fingerprint_hash);

-- Drop insecure user_credentials table (stores plaintext passwords - major security issue)
DROP TABLE IF EXISTS public.user_credentials;


-- Create the handle_new_user_signup function (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user_signup(
  _user_id UUID,
  _full_name TEXT,
  _role app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert profile if not exists
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (_user_id, _full_name)
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert role if not exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create user settings with display_id
  INSERT INTO public.user_settings (user_id, display_id)
  VALUES (_user_id, generate_display_id())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
