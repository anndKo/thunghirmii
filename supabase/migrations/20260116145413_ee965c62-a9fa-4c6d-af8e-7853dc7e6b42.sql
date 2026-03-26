-- Add weeks_count to classes table
ALTER TABLE public.classes ADD COLUMN weeks_count integer NOT NULL DEFAULT 15;

-- Add attendance timer columns
ALTER TABLE public.classes ADD COLUMN attendance_duration_minutes integer DEFAULT NULL;
ALTER TABLE public.classes ADD COLUMN attendance_start_time timestamp with time zone DEFAULT NULL;

-- Add week_number to attendance_records
ALTER TABLE public.attendance_records ADD COLUMN week_number integer DEFAULT NULL;