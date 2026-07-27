-- CRM · Dimensão de MÓDULO (land & expand): catálogo de módulos por PRODUTO (company).
-- Cada módulo é uma cunha (dor/comprador/canal próprios) dentro de um produto (ConstruData, AgroTorre…).
-- Deals ganham modulo_id (tag). Padrão do repo: RLS user_id OR owns_company, triggers set_user_id_on_insert
-- + update_updated_at_column. Idempotente. Aditiva.

create table if not exists public.crm_modulos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade, -- o produto (guarda-chuva)
  key text not null,                                -- slug estável
  name text not null,
  dor text,                                         -- a dor que o módulo resolve
  comprador text,                                   -- quem compra (cargo/tipo)
  canal_forte text,                                 -- canal mais forte (outbound/conteúdo/scraping…)
  tipo text not null default 'aquisicao',           -- aquisicao | retencao
  color text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_modulos enable row level security;

drop policy if exists "Users can manage own crm_modulos" on public.crm_modulos;
create policy "Users can manage own crm_modulos"
  on public.crm_modulos for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_crm_modulos on public.crm_modulos;
create trigger set_user_id_crm_modulos
  before insert on public.crm_modulos
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_crm_modulos_updated_at on public.crm_modulos;
create trigger update_crm_modulos_updated_at
  before update on public.crm_modulos
  for each row execute function public.update_updated_at_column();

-- Um módulo por (usuário, produto, key). company_id NULL usa sentinela p/ não duplicar.
create unique index if not exists idx_crm_modulos_key
  on public.crm_modulos (user_id, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), key);
create index if not exists idx_crm_modulos_company_order
  on public.crm_modulos (company_id, order_index);

-- Tag de módulo no deal (soft: sem FK, degrada se o módulo for removido → deal cai em "sem módulo").
alter table public.project_opportunities add column if not exists modulo_id uuid;
create index if not exists idx_project_opportunities_modulo on public.project_opportunities (modulo_id);

-- Realtime: garante crm_modulos na publicação (no-op se FOR ALL TABLES; engole duplicata/inexistente).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = false) then
    begin
      alter publication supabase_realtime add table public.crm_modulos;
    exception when duplicate_object then null; when undefined_table then null;
    end;
  end if;
end $$;
