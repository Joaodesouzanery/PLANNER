-- Contratos com prazo: data de término de uma recorrência.
-- Quando preenchida, a projeção da renda/despesa recorrente para nesse mês.
-- NULL = recorrência indefinida (renda "fixa"), comportamento antigo.
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS recurrence_end_date date;
