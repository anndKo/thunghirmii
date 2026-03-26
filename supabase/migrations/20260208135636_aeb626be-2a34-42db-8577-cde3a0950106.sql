-- Provide an RLS-safe way for any authenticated user to find the admin user id
-- (Direct SELECT on user_roles is blocked by RLS for non-admin users.)

CREATE OR REPLACE FUNCTION public.get_admin_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::public.app_role
  ORDER BY ur.id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_user_id() TO authenticated;
