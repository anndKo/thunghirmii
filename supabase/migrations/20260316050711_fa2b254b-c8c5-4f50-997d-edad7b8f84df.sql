
-- Storage policies for feedback-media bucket with unique names
CREATE POLICY "Auth users can upload to feedback-media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'feedback-media');

CREATE POLICY "Public can view feedback-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'feedback-media');

CREATE POLICY "Users can delete own feedback-media files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'feedback-media' AND (storage.foldername(name))[1] = auth.uid()::text);
