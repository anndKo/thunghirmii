
-- Allow authenticated users to read any profile (name, avatar) for chat display
CREATE POLICY "profiles_select_authenticated"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to read any user's role for chat display
CREATE POLICY "user_roles_select_authenticated"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
