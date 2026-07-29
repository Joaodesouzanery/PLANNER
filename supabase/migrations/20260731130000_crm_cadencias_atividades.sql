-- CRM · Cadências + log de atividades (a parte nova do spec AgroTorre — o motor de followup).
-- Cadência = template de toques (passos com dia_offset). Aplicar a um deal gera atividades com
-- data_prevista = hoje + dia_offset. A "fila do dia" = atividades pendentes com data_prevista <= hoje.
-- Padrão do repo: RLS user_id OR owns_company, triggers. Idempotente. Aditiva.

-- ===== CADÊNCIAS (templates) =====
create table if not exists public.crm_cadencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade,
  nome text not null,
  tipo text not null default 'outbound_frio', -- inbound | outbound_frio | expansao | reativacao
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_cadencia_passos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade,
  cadencia_id uuid not null references public.crm_cadencias(id) on delete cascade,
  passo_n integer not null default 1,
  canal text not null default 'email', -- whatsapp | ligacao | email | reuniao | nota
  dia_offset integer not null default 0,
  modelo_mensagem text,
  created_at timestamptz not null default now()
);

-- ===== ATIVIDADES (log de toque + agenda de followup) =====
create table if not exists public.crm_atividades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade,
  deal_id uuid references public.project_opportunities(id) on delete cascade,
  tipo text not null default 'email',       -- whatsapp | ligacao | email | reuniao | nota
  direcao text,                             -- enviado | recebido
  status text not null default 'pendente',  -- pendente | feito | sem_resposta
  data_prevista date,
  data_feito timestamptz,
  cadencia_id uuid,
  passo_n integer,
  resultado text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS + triggers para as 3 tabelas.
do $$
declare t text;
begin
  foreach t in array array['crm_cadencias', 'crm_cadencia_passos', 'crm_atividades'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own %1$s" on public.%1$s', t);
    execute format('create policy "own %1$s" on public.%1$s for all to authenticated using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id)) with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))', t);
    execute format('drop trigger if exists set_user_id_%1$s on public.%1$s', t);
    execute format('create trigger set_user_id_%1$s before insert on public.%1$s for each row execute function public.set_user_id_on_insert()', t);
  end loop;
end $$;

drop trigger if exists update_crm_cadencias_updated_at on public.crm_cadencias;
create trigger update_crm_cadencias_updated_at before update on public.crm_cadencias for each row execute function public.update_updated_at_column();
drop trigger if exists update_crm_atividades_updated_at on public.crm_atividades;
create trigger update_crm_atividades_updated_at before update on public.crm_atividades for each row execute function public.update_updated_at_column();

create index if not exists idx_crm_cadencia_passos_cadencia on public.crm_cadencia_passos (cadencia_id, passo_n);
create index if not exists idx_crm_atividades_fila on public.crm_atividades (company_id, status, data_prevista);
create index if not exists idx_crm_atividades_deal on public.crm_atividades (deal_id);

-- Realtime: garante crm_atividades na publicação (no-op se FOR ALL TABLES).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = false) then
    begin alter publication supabase_realtime add table public.crm_atividades; exception when duplicate_object then null; when undefined_table then null; end;
    begin alter publication supabase_realtime add table public.crm_cadencias; exception when duplicate_object then null; when undefined_table then null; end;
  end if;
end $$;
