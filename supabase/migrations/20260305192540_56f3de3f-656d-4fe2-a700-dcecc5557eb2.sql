CREATE TABLE public.roadmaps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  paths jsonb DEFAULT '[]'::jsonb,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on roadmaps" ON public.roadmaps FOR ALL USING (true) WITH CHECK (true);