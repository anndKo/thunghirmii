
-- Storage policies for feedback-media bucket with unique names
CREATE POLICY "feedback_media_upload_authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'feedback-media');

CREATE POLICY "feedback_media_view_public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'feedback-media');
