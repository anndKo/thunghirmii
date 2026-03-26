
-- Create tenant removal history table
CREATE TABLE public.tenant_removal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  tenant_name TEXT,
  tenant_phone TEXT,
  reason TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  removed_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_removal_history ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "admin_manage_removal_history" ON public.tenant_removal_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for removal evidence
INSERT INTO storage.buckets (id, name, public) VALUES ('removal-evidence', 'removal-evidence', true);

-- Storage policies for removal evidence
CREATE POLICY "admin_upload_evidence" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'removal-evidence' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "anyone_read_evidence" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'removal-evidence');
