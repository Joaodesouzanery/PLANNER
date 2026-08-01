-- 1) Encerra recorrências antigas duplicadas pelo seed (mantém histórico, para de projetar em dobro)
UPDATE public.financial_transactions
SET is_recurring = false, recurrence_end_date = '2026-07-31'
WHERE id IN (
  '464e937e-3283-401c-8498-79279f118f66', -- CIRCLE - Pagamento
  'b4c87c1e-6867-4893-99cd-a78fc7510f53', -- IRIS - Pagamento
  '5a16bcdd-a24b-4e39-9491-f81d6b1f117d', -- Pagamento Compizzo (2500/2)
  'd69ca27e-267e-412b-8f6f-1fa5685f2141', -- Pagamento CONAB
  '90846a9d-9f20-4f06-8083-5320581c3111', -- Pagamento RAONI
  'ab69432a-17b9-42d2-9c00-2954272a974a', -- Macbook (1/10)
  '58372e91-0c42-4f4f-82bf-05846d186d9e'  -- Seguro Macbook
);

-- 2) Conta fantasma criada pelo seed -> vira item de patrimônio (não some com os R$ 3.000)
INSERT INTO public.finance_networth_items (kind, label, category, value, user_id)
SELECT 'asset', 'Guardado (reserva)', 'reserva', 3000, a.user_id
FROM public.finance_accounts a
WHERE lower(a.name) = 'guardado (reserva)'
AND NOT EXISTS (
  SELECT 1 FROM public.finance_networth_items WHERE lower(label) = 'guardado (reserva)'
);

DELETE FROM public.finance_accounts
WHERE lower(name) = 'guardado (reserva)' AND account_type = 'savings';
