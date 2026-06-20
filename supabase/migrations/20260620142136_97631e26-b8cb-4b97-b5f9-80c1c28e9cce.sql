CREATE TABLE public.finance_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  recurring_income NUMERIC NOT NULL DEFAULT 0,
  recurring_expense NUMERIC NOT NULL DEFAULT 0,
  history_window INT NOT NULL DEFAULT 3,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_scenarios TO authenticated;
GRANT ALL ON public.finance_scenarios TO service_role;

ALTER TABLE public.finance_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scenarios_owner_all" ON public.finance_scenarios
  FOR ALL TO authenticated
  USING (public.user_can_access(user_id, company_id))
  WITH CHECK (public.user_can_access(user_id, company_id));

CREATE TRIGGER set_user_id_finance_scenarios
  BEFORE INSERT ON public.finance_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

CREATE TRIGGER update_finance_scenarios_updated_at
  BEFORE UPDATE ON public.finance_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_finance_scenarios_owner ON public.finance_scenarios(user_id, company_id);