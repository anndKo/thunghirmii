
-- Friend help tracking table
CREATE TABLE public.friend_helps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  helper_id UUID NOT NULL,
  helped_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.friend_helps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own helps" ON public.friend_helps
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = helper_id);

CREATE POLICY "Users can view own helps" ON public.friend_helps
  FOR SELECT TO authenticated USING (auth.uid() = helper_id);

-- Friend help config in settings table (admin manages via settings)
-- No schema change needed, uses existing settings table with key 'friend_help_config'
