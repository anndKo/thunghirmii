
-- Create table to store user credentials (passwords)
CREATE TABLE public.user_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

-- Only admins can view credentials
CREATE POLICY "Only admins can view credentials"
ON public.user_credentials
FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- Anyone can insert (for signup flow)
CREATE POLICY "Anyone can insert credentials"
ON public.user_credentials
FOR INSERT
WITH CHECK (true);

-- Anyone can update (for password change flow)
CREATE POLICY "Anyone can update own credentials"
ON public.user_credentials
FOR UPDATE
USING (auth.uid() = user_id);

-- Admin can also update credentials
CREATE POLICY "Admins can update any credentials"
ON public.user_credentials
FOR UPDATE
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
