CREATE POLICY "Admin can delete protection passwords"
ON public.protection_passwords
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));