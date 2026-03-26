
ALTER TABLE public.payment_deadlines 
  ADD COLUMN IF NOT EXISTS deadline_day integer,
  ADD COLUMN IF NOT EXISTS paid_month text;

-- Migrate existing deadline_date to deadline_day
UPDATE public.payment_deadlines 
SET deadline_day = EXTRACT(DAY FROM deadline_date)::integer 
WHERE deadline_date IS NOT NULL AND deadline_day IS NULL;
