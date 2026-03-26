
-- Add visibility column to mini_games
ALTER TABLE public.mini_games ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'all';

-- Reward actions table (admin-created tasks users can do for points)
CREATE TABLE public.reward_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL, -- 'find_nearby', 'view_room', 'send_request'
  points integer NOT NULL DEFAULT 1,
  max_per_day integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

ALTER TABLE public.reward_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can do all on reward_actions" ON public.reward_actions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

CREATE POLICY "Anyone can view active reward_actions" ON public.reward_actions
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Reward history table
CREATE TABLE public.reward_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  points integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own reward_history" ON public.reward_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own reward_history" ON public.reward_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all reward_history" ON public.reward_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
