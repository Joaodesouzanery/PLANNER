-- CRM · Matriz de ativos de conteúdo: cada PDF/VSL/vídeo/post é uma linha rastreável por produto+módulo.
-- modulo_id NULL = ativo de nível empresa (guarda-chuva: PDF geral, VSL). Métrica de DECISÃO = leads_gerados
-- (passo adiante); impressions/views/opens = diagnóstico. Padrão do repo: RLS user_id OR owns_company,
-- triggers set_user_id_on_insert + update_updated_at_column. Idempotente. Aditiva.

create table if not exists public.crm_ativos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade, -- o produto
  modulo_id uuid,                                    -- soft ref a crm_modulos; NULL = guarda-chuva
  tipo text not null default 'post',                 -- pdf | vsl | video | post
  titulo text not null,
  angulo_de_dor text,
  variante_de_copy text,
  canal text,
  data date,
  leads_gerados integer not null default 0,          -- métrica de decisão
  impressions integer,                               -- diagnóstico
  views integer,
  opens integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_ativos enable row level security;

drop policy if exists "Users can manage own crm_ativos" on public.crm_ativos;
create policy "Users can manage own crm_ativos"
  on public.crm_ativos for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_crm_ativos on public.crm_ativos;
create trigger set_user_id_crm_ativos
  before insert on public.crm_ativos
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_crm_ativos_updated_at on public.crm_ativos;
create trigger update_crm_ativos_updated_at
  before update on public.crm_ativos
  for each row execute function public.update_updated_at_column();

create index if not exists idx_crm_ativos_company on public.crm_ativos (company_id, modulo_id);

-- Realtime: garante crm_ativos na publicação (no-op se FOR ALL TABLES; engole duplicata/inexistente).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = false) then
    begin
      alter publication supabase_realtime add table public.crm_ativos;
    exception when duplicate_object then null; when undefined_table then null;
    end;
  end if;
end $$;
