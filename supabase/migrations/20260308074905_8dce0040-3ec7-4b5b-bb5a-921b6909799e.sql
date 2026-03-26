CREATE POLICY "Landlords can update viewed status on forwarded requests"
ON public.room_requests
FOR UPDATE
TO authenticated
USING (
  status = 'forwarded' AND EXISTS (
    SELECT 1 FROM public.rooms WHERE rooms.id = room_requests.room_id AND rooms.landlord_id = auth.uid()
  )
)
WITH CHECK (
  status = 'forwarded' AND EXISTS (
    SELECT 1 FROM public.rooms WHERE rooms.id = room_requests.room_id AND rooms.landlord_id = auth.uid()
  )
);