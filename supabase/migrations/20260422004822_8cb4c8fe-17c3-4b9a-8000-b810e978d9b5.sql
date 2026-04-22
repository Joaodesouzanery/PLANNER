-- Conference stages (e.g. Segurança, QA, Performance, Backup, etc.)
CREATE TABLE public.conference_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'shield-check',
  color TEXT DEFAULT 'primary',
  order_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conference_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conference_stages"
ON public.conference_stages
FOR ALL
TO authenticated
USING ((user_id = auth.uid()) OR owns_company(auth.uid(), company_id))
WITH CHECK ((user_id = auth.uid()) OR owns_company(auth.uid(), company_id));

CREATE TRIGGER set_user_id_conference_stages
BEFORE INSERT ON public.conference_stages
FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

CREATE TRIGGER update_conference_stages_updated_at
BEFORE UPDATE ON public.conference_stages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Conference items: documents/texts/prompts attached to each stage
CREATE TABLE public.conference_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.conference_stages(id) ON DELETE CASCADE,
  user_id UUID,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text', -- 'text' | 'prompt' | 'document'
  title TEXT NOT NULL,
  content TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  tags TEXT[] DEFAULT '{}',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conference_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conference_items"
ON public.conference_items
FOR ALL
TO authenticated
USING ((user_id = auth.uid()) OR owns_company(auth.uid(), company_id))
WITH CHECK ((user_id = auth.uid()) OR owns_company(auth.uid(), company_id));

CREATE TRIGGER set_user_id_conference_items
BEFORE INSERT ON public.conference_items
FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

CREATE TRIGGER update_conference_items_updated_at
BEFORE UPDATE ON public.conference_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_conference_items_stage ON public.conference_items(stage_id);
CREATE INDEX idx_conference_stages_company ON public.conference_stages(company_id);