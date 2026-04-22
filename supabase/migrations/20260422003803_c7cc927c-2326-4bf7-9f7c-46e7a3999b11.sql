
-- 1. commercial_structure_items: items para Roteiro Onboarding, Roteiro Implementação, KPIs
CREATE TABLE public.commercial_structure_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID,
  category TEXT NOT NULL, -- 'onboarding_roteiro' | 'implementation_roteiro' | 'kpi_before_after'
  title TEXT NOT NULL,
  description TEXT,
  value_before TEXT,
  value_after TEXT,
  unit TEXT,
  status TEXT DEFAULT 'pending',
  order_index INTEGER DEFAULT 0,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_structure_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own commercial_structure_items"
  ON public.commercial_structure_items FOR ALL TO authenticated
  USING ((user_id = auth.uid()) OR public.owns_company(auth.uid(), company_id))
  WITH CHECK ((user_id = auth.uid()) OR public.owns_company(auth.uid(), company_id));
CREATE TRIGGER set_user_id_commercial_structure_items
  BEFORE INSERT ON public.commercial_structure_items
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER update_commercial_structure_items_updated_at
  BEFORE UPDATE ON public.commercial_structure_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_csi_company_category ON public.commercial_structure_items(company_id, category, order_index);

-- 2. agile_implementation_steps: etapas de implementação ágil
CREATE TABLE public.agile_implementation_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  sprint_number INTEGER,
  status TEXT DEFAULT 'pending', -- 'pending' | 'in_progress' | 'completed'
  checklist JSONB DEFAULT '[]'::jsonb,
  attachment_url TEXT,
  attachment_name TEXT,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agile_implementation_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own agile_implementation_steps"
  ON public.agile_implementation_steps FOR ALL TO authenticated
  USING ((user_id = auth.uid()) OR public.owns_company(auth.uid(), company_id))
  WITH CHECK ((user_id = auth.uid()) OR public.owns_company(auth.uid(), company_id));
CREATE TRIGGER set_user_id_agile_steps
  BEFORE INSERT ON public.agile_implementation_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER update_agile_steps_updated_at
  BEFORE UPDATE ON public.agile_implementation_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_agile_company_order ON public.agile_implementation_steps(company_id, order_index);

-- 3. ai_generations: biblioteca de mensagens/posts gerados
CREATE TABLE public.ai_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'linkedin_outreach' | 'linkedin_post' | 'chat'
  title TEXT,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}'::text[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ai_generations"
  ON public.ai_generations FOR ALL TO authenticated
  USING ((user_id = auth.uid()) OR public.owns_company(auth.uid(), company_id))
  WITH CHECK ((user_id = auth.uid()) OR public.owns_company(auth.uid(), company_id));
CREATE TRIGGER set_user_id_ai_generations
  BEFORE INSERT ON public.ai_generations
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE INDEX idx_ai_gen_user_type ON public.ai_generations(user_id, type, created_at DESC);
CREATE INDEX idx_ai_gen_tags ON public.ai_generations USING GIN(tags);
