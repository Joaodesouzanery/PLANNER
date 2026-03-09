CREATE TABLE public.company_commercial_structure (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  section TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, section)
);

ALTER TABLE public.company_commercial_structure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on company_commercial_structure"
  ON public.company_commercial_structure
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_company_commercial_structure_updated_at
  BEFORE UPDATE ON public.company_commercial_structure
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();