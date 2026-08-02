-- ============ B1: produtos como dimensão (reversível: nada é apagado) ============
CREATE TABLE IF NOT EXISTS public.finance_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, -- empresa-mãe atual (Nery Geral)
  legacy_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, -- origem histórica
  name text NOT NULL,
  slug text NOT NULL,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_produtos TO authenticated;
GRANT ALL ON public.finance_produtos TO service_role;

ALTER TABLE public.finance_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own produtos"
  ON public.finance_produtos FOR ALL
  TO authenticated
  USING (public.user_can_access(user_id, company_id))
  WITH CHECK (public.user_can_access(user_id, company_id));

DROP TRIGGER IF EXISTS set_user_id_finance_produtos ON public.finance_produtos;
CREATE TRIGGER set_user_id_finance_produtos
  BEFORE INSERT ON public.finance_produtos
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS update_finance_produtos_updated_at ON public.finance_produtos;
CREATE TRIGGER update_finance_produtos_updated_at
  BEFORE UPDATE ON public.finance_produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS finance_produtos_user_slug_key
  ON public.finance_produtos (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

-- ============ colunas de dimensão nas tabelas existentes ============
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES public.finance_produtos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escopo text;

ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_escopo_check;
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_escopo_check CHECK (escopo IS NULL OR escopo IN ('pf','pj'));

ALTER TABLE public.finance_clientes
  ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES public.finance_produtos(id) ON DELETE SET NULL;

ALTER TABLE public.finance_accounts
  ADD COLUMN IF NOT EXISTS escopo text;
ALTER TABLE public.finance_accounts
  DROP CONSTRAINT IF EXISTS finance_accounts_escopo_check;
ALTER TABLE public.finance_accounts
  ADD CONSTRAINT finance_accounts_escopo_check CHECK (escopo IS NULL OR escopo IN ('pf','pj'));

CREATE INDEX IF NOT EXISTS idx_financial_transactions_produto ON public.financial_transactions(produto_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_escopo ON public.financial_transactions(escopo);
CREATE INDEX IF NOT EXISTS idx_finance_clientes_produto ON public.finance_clientes(produto_id);

-- ============ seed dos produtos (idempotente) ============
DO $$
DECLARE
  v_user uuid;
  v_mae uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.companies WHERE name = 'NERY GERAL' LIMIT 1;
  SELECT id INTO v_mae FROM public.companies WHERE name = 'NERY GERAL' LIMIT 1;

  INSERT INTO public.finance_produtos (user_id, company_id, legacy_company_id, name, slug, color, is_active)
  SELECT v_user, v_mae, c.id, p.name, p.slug, p.color, p.active
  FROM (VALUES
    ('ConstruData','construdata','orange', true,  'CONSTRUDATA'),
    ('IRIS','iris','pink', true,             'IRIS/ CIRCLE'),
    ('Circle','circle','cyan', true,          NULL),
    ('AgroTorre','agrotorre','green', true,   'NERY AGRO'),
    ('Nery Jornal','nery-jornal','red', true, 'NERY JORNAL'),
    ('Grupo Nery','grupo-nery','primary', true, 'NERY GERAL')
  ) AS p(name, slug, color, active, legacy_name)
  LEFT JOIN public.companies c ON c.name = p.legacy_name
  ON CONFLICT DO NOTHING;
END $$;

-- ============ backfill (histórico intacto, só classificação) ============
UPDATE public.financial_transactions t
SET produto_id = p.id
FROM public.finance_produtos p
WHERE t.produto_id IS NULL
  AND t.company_id IS NOT NULL
  AND p.legacy_company_id = t.company_id;

UPDATE public.finance_clientes c
SET produto_id = p.id
FROM public.finance_produtos p
WHERE c.produto_id IS NULL
  AND c.company_id IS NOT NULL
  AND p.legacy_company_id = c.company_id;

UPDATE public.finance_accounts a
SET escopo = CASE WHEN e.entity_type = 'cpf' THEN 'pf' ELSE 'pj' END
FROM public.finance_entities e
WHERE a.escopo IS NULL AND a.entity_id = e.id;

UPDATE public.financial_transactions t
SET escopo = a.escopo
FROM public.finance_accounts a
WHERE t.escopo IS NULL AND t.finance_account_id = a.id AND a.escopo IS NOT NULL;

UPDATE public.financial_transactions
SET escopo = 'pj'
WHERE escopo IS NULL AND company_id IS NOT NULL;