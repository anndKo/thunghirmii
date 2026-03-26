
-- Add messaging features: reply, edit, recall
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_recalled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Allow users to update their own messages (for edit/recall)
CREATE POLICY "Users can update their own messages"
ON public.messages
FOR UPDATE
USING (auth.uid() = sender_id);
