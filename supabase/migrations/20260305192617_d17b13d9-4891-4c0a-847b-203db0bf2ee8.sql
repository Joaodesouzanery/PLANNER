-- Add missing columns to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'lead';

-- Add missing columns to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS labels text[] DEFAULT '{}';

-- Add missing columns to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;

-- Create quick_notes table
CREATE TABLE IF NOT EXISTS public.quick_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  color text DEFAULT 'default',
  pinned boolean DEFAULT false,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.quick_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on quick_notes" ON public.quick_notes FOR ALL USING (true) WITH CHECK (true);

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  start_date text NOT NULL,
  end_date text,
  all_day boolean DEFAULT true,
  color text DEFAULT 'blue',
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on calendar_events" ON public.calendar_events FOR ALL USING (true) WITH CHECK (true);

-- Create contact_interactions table
CREATE TABLE IF NOT EXISTS public.contact_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  description text NOT NULL,
  date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on contact_interactions" ON public.contact_interactions FOR ALL USING (true) WITH CHECK (true);

-- Create task_notes table
CREATE TABLE IF NOT EXISTS public.task_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on task_notes" ON public.task_notes FOR ALL USING (true) WITH CHECK (true);