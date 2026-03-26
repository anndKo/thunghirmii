
-- Add approval_status column to rooms table
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';

-- Set all existing rooms to approved
UPDATE public.rooms SET approval_status = 'approved' WHERE approval_status = 'pending';

-- Update the public read policy to only show approved rooms
DROP POLICY IF EXISTS "Public can read rooms basic info" ON rooms;
DROP POLICY IF EXISTS "Anyone can view available rooms" ON rooms;

CREATE POLICY "Public can view approved rooms" ON rooms
  FOR SELECT USING (
    (approval_status = 'approved')
    OR (landlord_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );
