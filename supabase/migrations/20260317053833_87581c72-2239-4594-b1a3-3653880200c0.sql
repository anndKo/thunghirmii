CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.settings
  FOR SELECT TO public USING (true);

CREATE POLICY "Admin can manage settings" ON public.settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.settings (key, value)
VALUES ('time_window', '{"enabled": false, "start": null, "end": null}'::jsonb);
