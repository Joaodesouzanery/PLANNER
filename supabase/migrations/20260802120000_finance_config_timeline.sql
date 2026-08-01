-- Regra-Mestre · camada de config DATADA no tempo. Cada valor de config (pró-labore, tax_rate, …) pode
-- ter uma linha do tempo de vigências: {key, value, effective_date}. A leitura "as-of mês" pega o value de
-- maior effective_date <= fim do mês — assim a projeção de 12m honra cada mudança no mês certo (ex.: pró-labore
-- 2.310 hoje → 3.500 em jan/27). Fonte única e editável; nada hardcoded. Padrão do repo: RLS user_id OR
-- owns_company, triggers set_user_id/updated_at. Idempotente. Aditiva.

create table if not exists public.finance_config_timeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade, -- NULL = escopo pessoal/consolidado
  key text not null,                                  -- 'prolabore' | 'tax_rate' | …
  value numeric not null,
  effective_date date not null,                       -- a partir de quando este valor vale
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_config_timeline enable row level security;

drop policy if exists "Users can manage own finance_config_timeline" on public.finance_config_timeline;
create policy "Users can manage own finance_config_timeline"
  on public.finance_config_timeline for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_finance_config_timeline on public.finance_config_timeline;
create trigger set_user_id_finance_config_timeline
  before insert on public.finance_config_timeline
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_finance_config_timeline_updated_at on public.finance_config_timeline;
create trigger update_finance_config_timeline_updated_at
  before update on public.finance_config_timeline
  for each row execute function public.update_updated_at_column();

-- Uma vigência por (usuário, escopo, key, data). company_id NULL tratado como valor fixo p/ dedup
-- (unique nativo ignora NULLs), então usa coalesce.
create unique index if not exists uq_finance_config_timeline
  on public.finance_config_timeline (user_id, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), key, effective_date);

create index if not exists idx_finance_config_timeline_lookup
  on public.finance_config_timeline (user_id, key, effective_date);

-- Realtime: engole no-op/duplicata/inexistente.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = false) then
    begin
      alter publication supabase_realtime add table public.finance_config_timeline;
    exception when duplicate_object then null; when undefined_table then null;
    end;
  end if;
end $$;
