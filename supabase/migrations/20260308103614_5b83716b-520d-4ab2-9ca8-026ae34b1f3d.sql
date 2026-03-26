
-- Table for payment deadlines
-- user_id NULL + role='landlord' = shared landlord deadline
-- user_id set + role='tenant' = individual tenant deadline
-- user_id set + role='landlord' = individual landlord payment confirmation
CREATE TABLE public.payment_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  role text NOT NULL DEFAULT 'tenant',
  deadline_date date NOT NULL,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  confirmed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_deadlines ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin can manage payment_deadlines"
ON public.payment_deadlines FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own deadlines
CREATE POLICY "Users can view own deadlines"
ON public.payment_deadlines FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can view shared landlord deadline
CREATE POLICY "Users can view shared deadlines"
ON public.payment_deadlines FOR SELECT TO authenticated
USING (user_id IS NULL);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_deadlines;
