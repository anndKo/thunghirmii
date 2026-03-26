
-- Add priority column to rooms for top listing feature
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;
