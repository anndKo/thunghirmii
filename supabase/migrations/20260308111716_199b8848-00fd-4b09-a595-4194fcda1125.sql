ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'payment';
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS transfer_content text;