
-- Create top_feedbacks table for feedback between landlord and admin on top orders
CREATE TABLE public.top_feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.top_orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}'::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.top_feedbacks ENABLE ROW LEVEL SECURITY;

-- Landlords can insert feedback for their own orders
CREATE POLICY "Landlords can insert own order feedback"
ON public.top_feedbacks
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND (
    EXISTS (SELECT 1 FROM public.top_orders WHERE id = order_id AND landlord_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Landlords can view feedback on their own orders, admin can view all
CREATE POLICY "Users can view relevant feedback"
ON public.top_feedbacks
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.top_orders WHERE id = order_id AND landlord_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Admin can manage all feedback
CREATE POLICY "Admin can manage all feedback"
ON public.top_feedbacks
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for feedback
ALTER PUBLICATION supabase_realtime ADD TABLE public.top_feedbacks;

-- Create storage bucket for feedback media
INSERT INTO storage.buckets (id, name, public) VALUES ('top-feedbacks', 'top-feedbacks', true);

-- Storage policies for top-feedbacks bucket
CREATE POLICY "Authenticated users can upload feedback media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'top-feedbacks');

CREATE POLICY "Anyone can view feedback media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'top-feedbacks');
