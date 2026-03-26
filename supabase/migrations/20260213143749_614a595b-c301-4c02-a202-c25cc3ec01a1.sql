
-- Add missing columns to rooms table
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS room_number TEXT NOT NULL DEFAULT '';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT NULL;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS videos TEXT[] DEFAULT NULL;

-- Create room_requests table
CREATE TABLE IF NOT EXISTS public.room_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.room_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their own requests" ON public.room_requests FOR SELECT USING (auth.uid() = tenant_id);
CREATE POLICY "Tenants can create requests" ON public.room_requests FOR INSERT WITH CHECK (auth.uid() = tenant_id);
CREATE POLICY "Admin can view all requests" ON public.room_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin can update requests" ON public.room_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
