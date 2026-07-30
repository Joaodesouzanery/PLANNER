-- Pró-labore mensal (PJ→PF): valor de referência p/ a DRE (linha "= Lucro da empresa")
-- e p/ o painel "gasto pessoal (PF) × pró-labore → sobra". Só config — não lança transferência.
alter table public.finance_settings add column if not exists prolabore_mensal numeric;
