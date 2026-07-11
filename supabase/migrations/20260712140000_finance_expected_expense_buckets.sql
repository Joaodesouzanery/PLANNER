-- CFO v2 · Fase 0: despesa esperada em 3 baldes (editável; null = usar sugestão da projeção).
alter table public.finance_settings add column if not exists expected_expense_fixo numeric;
alter table public.finance_settings add column if not exists expected_expense_variavel numeric;
alter table public.finance_settings add column if not exists expected_expense_anual numeric;
