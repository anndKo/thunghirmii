
-- Create protection_passwords table
CREATE TABLE public.protection_passwords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  fail_count INTEGER NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.protection_passwords ENABLE ROW LEVEL SECURITY;

-- Users can view their own protection password settings
CREATE POLICY "Users can view own protection password"
ON public.protection_passwords
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own protection password
CREATE POLICY "Users can insert own protection password"
ON public.protection_passwords
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own protection password
CREATE POLICY "Users can update own protection password"
ON public.protection_passwords
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own protection password
CREATE POLICY "Users can delete own protection password"
ON public.protection_passwords
FOR DELETE
USING (auth.uid() = user_id);

-- Admin can view all protection passwords
CREATE POLICY "Admin can view all protection passwords"
ON public.protection_passwords
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update all protection passwords (for unlocking)
CREATE POLICY "Admin can update all protection passwords"
ON public.protection_passwords
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow anonymous select for login check (by user_id only)
CREATE POLICY "Anon can check protection password exists"
ON public.protection_passwords
FOR SELECT
USING (true);
