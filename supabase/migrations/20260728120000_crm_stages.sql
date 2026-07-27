-- CRM · Funil DB-backed: etapas (colunas) customizáveis do kanban de deals, por empresa.
-- Antes as etapas eram hardcoded no DealKanban; agora viram linhas editáveis (add/renomear/reordenar/
-- recolorir). project_opportunities.stage guarda a `key` da etapa. Padrão do repo: RLS user_id OR
-- owns_company, triggers set_user_id_on_insert + update_updated_at_column. Idempotente. Aditiva.

create table if not exists public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade,
  key text not null,                            -- slug estável gravado em project_opportunities.stage
  title text not null,
  order_index integer not null default 0,
  color text,                                   -- classes tailwind do gradiente da coluna
  outcome text,                                 -- null | won | lost
  is_offtrack boolean not null default false,   -- Perdido / Em nutrição (fora da esteira)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_stages enable row level security;

drop policy if exists "Users can manage own crm_stages" on public.crm_stages;
create policy "Users can manage own crm_stages"
  on public.crm_stages for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_crm_stages on public.crm_stages;
create trigger set_user_id_crm_stages
  before insert on public.crm_stages
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_crm_stages_updated_at on public.crm_stages;
create trigger update_crm_stages_updated_at
  before update on public.crm_stages
  for each row execute function public.update_updated_at_column();

-- Uma etapa por (usuário, empresa, key). company_id NULL usa sentinela p/ não duplicar (funil "global"/"todas").
create unique index if not exists idx_crm_stages_key
  on public.crm_stages (user_id, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), key);
create index if not exists idx_crm_stages_company_order
  on public.crm_stages (company_id, order_index);
