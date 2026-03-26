
-- Table for landlord bank/payment info
CREATE TABLE public.landlord_payment_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  bank_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  account_holder TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landlord_payment_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment info"
  ON public.landlord_payment_info FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment info"
  ON public.landlord_payment_info FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment info"
  ON public.landlord_payment_info FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all payment info"
  ON public.landlord_payment_info FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage all payment info"
  ON public.landlord_payment_info FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Table for tenant rent payment tracking
CREATE TABLE public.rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  is_late BOOLEAN NOT NULL DEFAULT false,
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own rent payments"
  ON public.rent_payments FOR SELECT
  USING (auth.uid() = tenant_id);

CREATE POLICY "Admin can manage all rent payments"
  ON public.rent_payments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Landlords can view payments for their rooms"
  ON public.rent_payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rooms WHERE rooms.id = rent_payments.room_id AND rooms.landlord_id = auth.uid()
  ));

CREATE TRIGGER update_landlord_payment_info_updated_at
  BEFORE UPDATE ON public.landlord_payment_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rent_payments_updated_at
  BEFORE UPDATE ON public.rent_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
