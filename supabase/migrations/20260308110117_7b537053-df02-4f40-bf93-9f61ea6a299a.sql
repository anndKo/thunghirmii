
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
