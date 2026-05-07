CREATE TABLE IF NOT EXISTS public.commercial_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  location TEXT,
  linkedin_job_url TEXT,
  job_title TEXT,
  job_about TEXT,
  contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  operational_diagnosis JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT NOT NULL DEFAULT 'medium',
  meeting_date DATE,
  notes TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own commercial_prospects" ON public.commercial_prospects;
CREATE POLICY "Users can manage own commercial_prospects" ON public.commercial_prospects
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

CREATE INDEX IF NOT EXISTS commercial_prospects_company_id_idx ON public.commercial_prospects(company_id);
CREATE INDEX IF NOT EXISTS commercial_prospects_user_id_idx ON public.commercial_prospects(user_id);
CREATE INDEX IF NOT EXISTS commercial_prospects_status_idx ON public.commercial_prospects(status);

DROP TRIGGER IF EXISTS update_commercial_prospects_updated_at ON public.commercial_prospects;
CREATE TRIGGER update_commercial_prospects_updated_at
BEFORE UPDATE ON public.commercial_prospects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_user_id_commercial_prospects ON public.commercial_prospects;
CREATE TRIGGER set_user_id_commercial_prospects
BEFORE INSERT ON public.commercial_prospects
FOR EACH ROW
EXECUTE FUNCTION public.set_user_id_on_insert();
