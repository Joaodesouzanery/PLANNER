CREATE TABLE IF NOT EXISTS public.finance_cost_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  company_id uuid,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'outro',
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cost_buckets TO authenticated;
GRANT ALL ON public.finance_cost_buckets TO service_role;

ALTER TABLE public.finance_cost_buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own cost buckets" ON public.finance_cost_buckets;
CREATE POLICY "own cost buckets" ON public.finance_cost_buckets
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS set_user_id_finance_cost_buckets ON public.finance_cost_buckets;
CREATE TRIGGER set_user_id_finance_cost_buckets BEFORE INSERT ON public.finance_cost_buckets
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS update_finance_cost_buckets_updated_at ON public.finance_cost_buckets;
CREATE TRIGGER update_finance_cost_buckets_updated_at BEFORE UPDATE ON public.finance_cost_buckets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS cost_bucket_id uuid REFERENCES public.finance_cost_buckets(id) ON DELETE SET NULL;

INSERT INTO public.finance_cost_buckets (user_id, name, kind, color, sort_order)
SELECT u.user_id, v.name, v.kind, v.color, v.sort_order
FROM (SELECT DISTINCT user_id FROM public.financial_transactions WHERE user_id IS NOT NULL) u
CROSS JOIN (VALUES ('Custos Fixos','fixo','#38bdf8',0), ('Custos Variáveis','variavel','#f59e0b',1)) AS v(name, kind, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.finance_cost_buckets b WHERE b.user_id = u.user_id AND b.name = v.name
);