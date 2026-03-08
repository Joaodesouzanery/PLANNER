
-- 1. Create time_entries table
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  company_id uuid REFERENCES public.companies(id),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  hours numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on time_entries"
  ON public.time_entries FOR ALL
  USING (true) WITH CHECK (true);

-- 2. Create attachments table
CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  content_type text,
  uploaded_by uuid,
  company_id uuid REFERENCES public.companies(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on attachments"
  ON public.attachments FOR ALL
  USING (true) WITH CHECK (true);

-- 3. Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

-- 4. Storage RLS policies
CREATE POLICY "Allow public read on attachments bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');

CREATE POLICY "Allow all uploads to attachments bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Allow all deletes on attachments bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'attachments');
