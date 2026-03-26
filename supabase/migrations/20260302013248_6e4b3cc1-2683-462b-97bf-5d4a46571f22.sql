
-- Create attendance_records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_code TEXT NOT NULL,
  group_number TEXT,
  photo_url TEXT,
  attendance_code TEXT NOT NULL,
  week_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read attendance_records" ON public.attendance_records FOR SELECT USING (true);
CREATE POLICY "Anyone can insert attendance_records" ON public.attendance_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update attendance_records" ON public.attendance_records FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete attendance_records" ON public.attendance_records FOR DELETE USING (true);

-- Add landlord_viewed column to room_requests
ALTER TABLE public.room_requests ADD COLUMN IF NOT EXISTS landlord_viewed BOOLEAN DEFAULT false;
