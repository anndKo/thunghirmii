
CREATE TABLE public.pin_reset_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pin_reset_requests ENABLE ROW LEVEL SECURITY;

-- Users can submit their own requests
CREATE POLICY "Users can insert own pin reset requests"
ON public.pin_reset_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view own requests
CREATE POLICY "Users can view own pin reset requests"
ON public.pin_reset_requests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admin can view all
CREATE POLICY "Admin can view all pin reset requests"
ON public.pin_reset_requests FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update
CREATE POLICY "Admin can update pin reset requests"
ON public.pin_reset_requests FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete
CREATE POLICY "Admin can delete pin reset requests"
ON public.pin_reset_requests FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
