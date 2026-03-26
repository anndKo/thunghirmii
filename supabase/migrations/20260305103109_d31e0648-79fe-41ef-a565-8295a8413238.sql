
-- Create room_reports table
CREATE TABLE public.room_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  reporter_id uuid,
  reporter_name text,
  reporter_phone text,
  content text NOT NULL,
  media_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.room_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can insert reports (even anonymous)
CREATE POLICY "Anyone can insert reports" ON public.room_reports
  FOR INSERT WITH CHECK (true);

-- Admins can view all reports
CREATE POLICY "Admins can view reports" ON public.room_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
    OR (reporter_id IS NOT NULL AND reporter_id = auth.uid())
  );

-- Admins can update reports
CREATE POLICY "Admins can update reports" ON public.room_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
  );

-- Anyone can view reports (for anonymous select needed for insert)
CREATE POLICY "Anyone can select own reports" ON public.room_reports
  FOR SELECT USING (reporter_id IS NULL OR reporter_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- Create storage bucket for report media
INSERT INTO storage.buckets (id, name, public) VALUES ('room-reports', 'room-reports', true);

-- Storage policies
CREATE POLICY "Anyone can upload report media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'room-reports');

CREATE POLICY "Anyone can view report media" ON storage.objects
  FOR SELECT USING (bucket_id = 'room-reports');
