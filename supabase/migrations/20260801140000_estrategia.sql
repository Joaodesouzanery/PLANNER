-- Estratégia · cascata BHAG → Objetivo anual → KR trimestral → Ação quinzenal (+ ciclos e revisões).
-- Princípio: o "atual"/progresso NUNCA é coluna — é sempre DERIVADO (metas financeiras leem o dado real
-- canônico: mrr/reserva/patrimônio/sobra; operacionais somam ações feitas). Aqui só guardamos a estrutura
-- e os ALVOS. Padrão do repo: RLS user_id OR owns_company, triggers set_user_id_on_insert +
-- update_updated_at_column (helpers já existem). Idempotente. Aditiva.

-- 1) VISÃO / BHAG (10–15 anos) ------------------------------------------------------------------------
create table if not exists public.estrategia_visao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade, -- NULL = visão pessoal/global
  titulo text not null,
  horizonte text not null default '10-15a',          -- rótulo livre do horizonte
  metrica_alvo text,                                 -- financeira: mrr|reserva|patrimonio|sobra (auto)
  valor_alvo numeric,
  prazo date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) OBJETIVO ANUAL (aposta do ano) -------------------------------------------------------------------
create table if not exists public.estrategia_objetivo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade,
  visao_id uuid references public.estrategia_visao(id) on delete set null,
  ano integer,
  titulo text not null,
  tipo text not null default 'operacional',          -- financeira | operacional
  metrica text,                                      -- financeira: mrr|reserva|patrimonio|sobra
  alvo numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) KEY RESULT TRIMESTRAL ----------------------------------------------------------------------------
create table if not exists public.estrategia_kr (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade,
  objetivo_id uuid references public.estrategia_objetivo(id) on delete cascade,
  trimestre text,                                    -- ex.: '2026-Q1'
  descricao text not null,
  tipo text not null default 'operacional',          -- financeira | operacional
  metrica text,                                      -- financeira: mrr|reserva|patrimonio|sobra
  alvo numeric,
  unidade text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) AÇÃO QUINZENAL (a menor unidade executável) ------------------------------------------------------
create table if not exists public.estrategia_acao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade,
  key_result_id uuid references public.estrategia_kr(id) on delete cascade,
  quinzena text,                                     -- ex.: '2026-Q1-1'
  descricao text not null,
  status text not null default 'todo',               -- todo | doing | done
  custo_estimado numeric,
  transacao_id uuid,                                 -- soft ref a financial_transactions (custo → fluxo)
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) CICLO (a cadência de revisão) --------------------------------------------------------------------
create table if not exists public.estrategia_ciclo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade,
  horizonte text not null default 'trimestral',      -- quinzenal|mensal|trimestral|semestral|anual
  inicio date,
  fim date,
  status text not null default 'aberto',             -- aberto | fechado
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6) REVISÃO (o que aprendi → manter/ajustar/pivotar) -------------------------------------------------
create table if not exists public.estrategia_revisao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade,
  ciclo_id uuid references public.estrategia_ciclo(id) on delete cascade,
  data date not null default current_date,
  fiz text,
  aprendi text,
  nota text,
  decisao text not null default 'manter',            -- manter | ajustar | pivotar
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS + triggers + índices + realtime, um por tabela ------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'estrategia_visao','estrategia_objetivo','estrategia_kr',
    'estrategia_acao','estrategia_ciclo','estrategia_revisao'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "Users can manage own %1$s" on public.%1$I;', t);
    execute format(
      'create policy "Users can manage own %1$s" on public.%1$I for all to authenticated '
      || 'using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id)) '
      || 'with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));', t);

    execute format('drop trigger if exists set_user_id_%1$s on public.%1$I;', t);
    execute format(
      'create trigger set_user_id_%1$s before insert on public.%1$I '
      || 'for each row execute function public.set_user_id_on_insert();', t);

    execute format('drop trigger if exists update_%1$s_updated_at on public.%1$I;', t);
    execute format(
      'create trigger update_%1$s_updated_at before update on public.%1$I '
      || 'for each row execute function public.update_updated_at_column();', t);

    -- realtime: engole no-op/duplicata/inexistente
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = false) then
      begin
        execute format('alter publication supabase_realtime add table public.%I;', t);
      exception when duplicate_object then null; when undefined_table then null;
      end;
    end if;
  end loop;
end $$;

create index if not exists idx_estrategia_visao_company on public.estrategia_visao (company_id);
create index if not exists idx_estrategia_objetivo_visao on public.estrategia_objetivo (visao_id, ano);
create index if not exists idx_estrategia_kr_objetivo on public.estrategia_kr (objetivo_id, trimestre);
create index if not exists idx_estrategia_acao_kr on public.estrategia_acao (key_result_id, ordem);
create index if not exists idx_estrategia_ciclo_company on public.estrategia_ciclo (company_id, status);
create index if not exists idx_estrategia_revisao_ciclo on public.estrategia_revisao (ciclo_id);
