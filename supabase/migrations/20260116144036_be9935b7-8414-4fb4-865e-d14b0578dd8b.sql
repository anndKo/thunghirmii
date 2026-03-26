-- Create table for classes
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  attendance_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for students in each class
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  student_code TEXT NOT NULL,
  group_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for attendance records
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_code TEXT NOT NULL,
  group_number TEXT,
  photo_url TEXT NOT NULL,
  attendance_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for classes - admin can do everything, public can only read (to verify codes)
CREATE POLICY "Anyone can read classes to verify attendance code"
ON public.classes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert classes"
ON public.classes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update classes"
ON public.classes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete classes"
ON public.classes FOR DELETE TO authenticated USING (true);

-- RLS Policies for students
CREATE POLICY "Anyone can read students"
ON public.students FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert students"
ON public.students FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update students"
ON public.students FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete students"
ON public.students FOR DELETE TO authenticated USING (true);

-- RLS Policies for attendance_records
CREATE POLICY "Anyone can read attendance records"
ON public.attendance_records FOR SELECT USING (true);

CREATE POLICY "Anyone can insert attendance records"
ON public.attendance_records FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance records"
ON public.attendance_records FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete attendance records"
ON public.attendance_records FOR DELETE TO authenticated USING (true);

-- Create storage bucket for attendance photos
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-photos', 'attendance-photos', true);

-- Storage policies for attendance photos
CREATE POLICY "Anyone can upload attendance photos"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attendance-photos');

CREATE POLICY "Anyone can view attendance photos"
ON storage.objects FOR SELECT USING (bucket_id = 'attendance-photos');

CREATE POLICY "Authenticated users can delete attendance photos"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'attendance-photos');