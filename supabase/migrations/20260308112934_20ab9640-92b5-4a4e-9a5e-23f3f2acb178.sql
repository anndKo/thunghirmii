CREATE POLICY "Admin can delete payment_requests"
ON public.payment_requests
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));