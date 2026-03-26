-- Create table for payment requests sent via chat
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,            -- admin sending the request
  receiver_id uuid NOT NULL,          -- tenant/landlord receiving request
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  due_day int NOT NULL,               -- day of month payment is due
  amount numeric,                     -- optional suggested amount
  note text,                          -- optional note
  status text NOT NULL DEFAULT 'pending', -- pending | paid | rejected | cancelled
  receipt_url text,                   -- URL of receipt image (uploaded by receiver)
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- Admin can manage all payment requests
CREATE POLICY "Admin manage payment_requests" ON public.payment_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Receiver can view their own payment requests
CREATE POLICY "Receiver can view own payment_requests" ON public.payment_requests
FOR SELECT
USING (auth.uid() = receiver_id);

-- Receiver can update (to submit receipt / cancel)
CREATE POLICY "Receiver can update own payment_requests" ON public.payment_requests
FOR UPDATE
USING (auth.uid() = receiver_id);
