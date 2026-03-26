-- Create table for love anniversaries
CREATE TABLE public.love_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_1 TEXT NOT NULL,
  name_2 TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT 'Chúc mừng kỷ niệm 2 năm yêu nhau ❤️',
  years INTEGER NOT NULL DEFAULT 2,
  images TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.love_memories ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (anyone with link can view)
CREATE POLICY "Anyone can view love memories" 
ON public.love_memories 
FOR SELECT 
USING (true);

-- Create policy for public insert (anyone can create)
CREATE POLICY "Anyone can create love memories" 
ON public.love_memories 
FOR INSERT 
WITH CHECK (true);

-- Create index for slug lookups
CREATE INDEX idx_love_memories_slug ON public.love_memories(slug);

-- Create storage bucket for love images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('love-images', 'love-images', true);

-- Create policy for public upload to love-images bucket
CREATE POLICY "Anyone can upload love images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'love-images');

-- Create policy for public read access to love-images
CREATE POLICY "Anyone can view love images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'love-images');