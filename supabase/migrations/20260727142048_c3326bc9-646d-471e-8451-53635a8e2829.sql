CREATE TABLE public.crm_boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  segment TEXT,
  stages JSONB NOT NULL DEFAULT '[{"id":"novo","title":"Novo"},{"id":"contatado","title":"Contatado"},{"id":"qualificado","title":"Qualificado"},{"id":"proposta","title":"Proposta"},{"id":"negociacao","title":"Negociação"},{"id":"fechado","title":"Fechado"}]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_boards TO authenticated;
GRANT ALL ON public.crm_boards TO service_role;
ALTER TABLE public.crm_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_boards_owner_all" ON public.crm_boards FOR ALL TO authenticated
  USING (public.user_can_access(user_id, company_id)) WITH CHECK (public.user_can_access(user_id, company_id));
CREATE TRIGGER crm_boards_set_user_id BEFORE INSERT ON public.crm_boards FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER crm_boards_updated_at BEFORE UPDATE ON public.crm_boards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.crm_board_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  board_id UUID NOT NULL REFERENCES public.crm_boards(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL DEFAULT 'novo',
  order_index INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (board_id, contact_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_board_contacts TO authenticated;
GRANT ALL ON public.crm_board_contacts TO service_role;
ALTER TABLE public.crm_board_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_board_contacts_owner_all" ON public.crm_board_contacts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER crm_board_contacts_set_user_id BEFORE INSERT ON public.crm_board_contacts FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER crm_board_contacts_updated_at BEFORE UPDATE ON public.crm_board_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_crm_board_contacts_board ON public.crm_board_contacts(board_id);