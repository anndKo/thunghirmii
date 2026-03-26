
-- Add room_code column with unique 6-digit code
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS room_code text;

-- Create function to generate unique 6-digit room code
CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  IF NEW.room_code IS NULL OR NEW.room_code = '' THEN
    LOOP
      new_code := lpad(floor(random() * 1000000)::text, 6, '0');
      SELECT EXISTS(SELECT 1 FROM public.rooms WHERE room_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.room_code := new_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-generate room_code on insert
CREATE TRIGGER set_room_code
BEFORE INSERT ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.generate_room_code();

-- Generate codes for existing rooms
UPDATE public.rooms SET room_code = lpad(floor(random() * 1000000)::text, 6, '0') WHERE room_code IS NULL;

-- Add unique constraint
ALTER TABLE public.rooms ALTER COLUMN room_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_room_code ON public.rooms(room_code);
