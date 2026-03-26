
-- Create guides table
CREATE TABLE public.guides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;

-- Admin can manage all guides
CREATE POLICY "Admin can manage guides" ON public.guides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can view guides for their role
CREATE POLICY "Users can view guides for their role" ON public.guides
  FOR SELECT TO authenticated
  USING (true);

-- Create storage bucket for guide videos
INSERT INTO storage.buckets (id, name, public) VALUES ('guide-videos', 'guide-videos', true);

-- Storage policies for guide videos
CREATE POLICY "Admin can upload guide videos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'guide-videos' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete guide videos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'guide-videos' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view guide videos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'guide-videos');
