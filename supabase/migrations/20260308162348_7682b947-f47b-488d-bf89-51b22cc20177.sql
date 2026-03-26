CREATE TABLE public.device_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  phone text NOT NULL,
  message text,
  fingerprint_hash text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert support requests" ON public.device_support_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin can view support requests" ON public.device_support_requests
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update support requests" ON public.device_support_requests
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete support requests" ON public.device_support_requests
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));