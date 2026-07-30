-- Impacto financeiro previsto vindo do CRM: negócio GANHO vira um "previsto" (não caixa).
-- Adiciona data/status p/ o impacto aparecer no forecast (Futuro/Cenários) e a origem (deal)
-- p/ upsert idempotente (1 impacto por negócio). Índice único simples: NULLs (impactos manuais)
-- são distintos no Postgres, então continuam livres; só source_deal_id preenchido é único.
alter table public.project_financial_impacts add column if not exists expected_date date;
alter table public.project_financial_impacts add column if not exists status text default 'planned';
alter table public.project_financial_impacts add column if not exists source_deal_id uuid;
create unique index if not exists project_financial_impacts_source_deal_id_key
  on public.project_financial_impacts (source_deal_id);
