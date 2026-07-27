-- CRM · Motor de Prova: cada resultado de cliente vira dado estruturado (caso · resultado R$ · evidência ·
-- permissão de uso). É o motor que realimenta a seção "prova" dos PDFs-ímã — o único dos 3 motores sem casa
-- até aqui. Padrão do repo: RLS user_id OR owns_company, triggers set_user_id + updated_at. Idempotente.

create table if not exists public.crm_provas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade, -- o produto
  customer_id uuid references public.finance_clientes(id) on delete set null, -- a conta que teve o resultado
  modulo_id uuid,                                    -- soft ref a crm_modulos; NULL = geral
  titulo text not null,
  resultado_valor numeric,                           -- resultado em R$ (economia/ganho medido)
  evidencia text,                                    -- link/print/descrição da evidência
  permissao_uso boolean not null default false,      -- pode usar como prova pública?
  data date,
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_provas enable row level security;

drop policy if exists "Users can manage own crm_provas" on public.crm_provas;
create policy "Users can manage own crm_provas"
  on public.crm_provas for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_crm_provas on public.crm_provas;
create trigger set_user_id_crm_provas
  before insert on public.crm_provas
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_crm_provas_updated_at on public.crm_provas;
create trigger update_crm_provas_updated_at
  before update on public.crm_provas
  for each row execute function public.update_updated_at_column();

create index if not exists idx_crm_provas_company on public.crm_provas (company_id, customer_id);

-- Realtime: garante crm_provas na publicação (no-op se FOR ALL TABLES; engole duplicata/inexistente).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = false) then
    begin
      alter publication supabase_realtime add table public.crm_provas;
    exception when duplicate_object then null; when undefined_table then null;
    end;
  end if;
end $$;
