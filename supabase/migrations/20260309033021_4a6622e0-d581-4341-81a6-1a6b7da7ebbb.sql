
-- Top packages created by admin
CREATE TABLE public.top_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  features text NOT NULL,
  description text,
  price numeric NOT NULL,
  duration_days integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.top_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active packages"
ON public.top_packages FOR SELECT TO authenticated
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can manage packages"
ON public.top_packages FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin payment settings for top packages
CREATE TABLE public.top_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  account_holder text NOT NULL DEFAULT '',
  qr_image_url text,
  transfer_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.top_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view payment settings"
ON public.top_payment_settings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin can manage payment settings"
ON public.top_payment_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Top orders from landlords
CREATE TABLE public.top_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.top_packages(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  price numeric NOT NULL,
  bill_url text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.top_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all orders"
ON public.top_orders FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Landlords can view own orders"
ON public.top_orders FOR SELECT TO authenticated
USING (auth.uid() = landlord_id);

CREATE POLICY "Landlords can insert own orders"
ON public.top_orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = landlord_id);

-- Create storage bucket for top bills
INSERT INTO storage.buckets (id, name, public) VALUES ('top-bills', 'top-bills', true);

CREATE POLICY "Authenticated users can upload top bills"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'top-bills');

CREATE POLICY "Anyone can view top bills"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'top-bills');

-- Create storage bucket for top QR images
INSERT INTO storage.buckets (id, name, public) VALUES ('top-qr', 'top-qr', true);

CREATE POLICY "Admin can upload QR images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'top-qr' AND (SELECT has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Anyone can view QR images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'top-qr');
