-- CRM · Fase 5: Campaign Management — segmentos, campanhas e recipients. Idempotente.
-- Adapta o pilar "Campaign Management" das telas de referência ao negócio: outreach por
-- segmento dinâmico, com propensão (do crmScores) e funil de resposta/conversão.

-- 0. Deal do CRM pode existir SEM projeto. project_opportunities.project_id era NOT NULL
--    (criado na migration de installments) — isso quebrava "Criar deal" no CRM e a conversão
--    de prospect. Torna nullable. (drop not null é no-op se já for nullable.)
alter table public.project_opportunities alter column project_id drop not null;

-- 1. Segmentos: filtros dinâmicos salvos (resolvidos ao vivo contra o spine).
create table if not exists public.crm_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  filters jsonb not null default '{}'::jsonb,   -- {health:[],stage:[],tier:[],segment:[],recorrente:bool,minMrr:number}
  created_at timestamptz default now()
);
alter table public.crm_segments enable row level security;
drop policy if exists "crm_segments own" on public.crm_segments;
create policy "crm_segments own" on public.crm_segments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Campanhas: outreach sobre um segmento (objetivo/canal/mensagem/status).
create table if not exists public.crm_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  objective text,
  channel text default 'email',                 -- email|whatsapp|call|linkedin
  status text default 'draft',                  -- draft|active|paused|done
  segment_id uuid references public.crm_segments(id) on delete set null,
  message text,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);
alter table public.crm_campaigns enable row level security;
drop policy if exists "crm_campaigns own" on public.crm_campaigns;
create policy "crm_campaigns own" on public.crm_campaigns for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Recipients: destinatários da campanha com status da oferta + propensão + receita prevista.
create table if not exists public.crm_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  campaign_id uuid not null references public.crm_campaigns(id) on delete cascade,
  customer_id uuid references public.finance_clientes(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  offer_status text default 'pending',          -- pending|sent|opened|responded|converted
  propensity int,
  predicted_revenue numeric,
  responded_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz default now()
);
alter table public.crm_campaign_recipients enable row level security;
drop policy if exists "crm_campaign_recipients own" on public.crm_campaign_recipients;
create policy "crm_campaign_recipients own" on public.crm_campaign_recipients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_crm_segments_company on public.crm_segments (company_id);
create index if not exists idx_crm_campaigns_company on public.crm_campaigns (company_id);
create index if not exists idx_crm_campaigns_segment on public.crm_campaigns (segment_id);
create index if not exists idx_crm_campaign_recipients_campaign on public.crm_campaign_recipients (campaign_id);
create index if not exists idx_crm_campaign_recipients_customer on public.crm_campaign_recipients (customer_id);
