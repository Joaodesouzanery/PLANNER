-- Conselho 360: expansao do modulo BoardCouncil para suite completa de gestao.
-- 6 tabelas novas (company-scoped). Padrao: RLS user_id OR owns_company,
-- trigger set_user_id_on_insert + update_updated_at_column (em tabelas editaveis).
-- Helpers owns_company / set_user_id_on_insert / update_updated_at_column ja existem.
-- Aditiva: nao altera nenhuma tabela existente.

-- =====================================================================
-- 1. RISCOS DO BOARD (matriz 5x5, score gerado probability*impact)
-- =====================================================================
create table if not exists public.board_risks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  description text,
  category text not null default 'operational',
  probability integer not null default 3 check (probability between 1 and 5),
  impact integer not null default 3 check (impact between 1 and 5),
  score integer generated always as (probability * impact) stored,
  owner text,
  mitigation text,
  contingency text,
  status text not null default 'open',
  review_date date,
  last_reviewed_at date,
  trend text default 'stable',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.board_risks enable row level security;

drop policy if exists "Users can manage own board_risks" on public.board_risks;
create policy "Users can manage own board_risks"
  on public.board_risks for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_board_risks on public.board_risks;
create trigger set_user_id_board_risks
  before insert on public.board_risks
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_board_risks_updated_at on public.board_risks;
create trigger update_board_risks_updated_at
  before update on public.board_risks
  for each row execute function public.update_updated_at_column();

create index if not exists idx_board_risks_company_status
  on public.board_risks (company_id, status);
create index if not exists idx_board_risks_score
  on public.board_risks (score desc);

-- =====================================================================
-- 2. OBRIGACOES (template recorrente)
-- =====================================================================
create table if not exists public.board_obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  description text,
  category text not null default 'legal',
  obligation_type text,
  frequency text not null default 'monthly',
  interval_count integer not null default 1,
  day_of_month integer,
  month_of_year integer,
  start_date date not null default current_date,
  end_date date,
  next_due_date date,
  lead_days integer not null default 15,
  responsible text,
  estimated_amount numeric,
  authority text,
  status text not null default 'active',
  attachment_id uuid references public.attachments(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.board_obligations enable row level security;

drop policy if exists "Users can manage own board_obligations" on public.board_obligations;
create policy "Users can manage own board_obligations"
  on public.board_obligations for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_board_obligations on public.board_obligations;
create trigger set_user_id_board_obligations
  before insert on public.board_obligations
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_board_obligations_updated_at on public.board_obligations;
create trigger update_board_obligations_updated_at
  before update on public.board_obligations
  for each row execute function public.update_updated_at_column();

create index if not exists idx_board_obligations_company_cat
  on public.board_obligations (company_id, category);
create index if not exists idx_board_obligations_next_due
  on public.board_obligations (next_due_date) where status = 'active';

-- =====================================================================
-- 3. OCORRENCIAS DE OBRIGACOES (vencimentos materializados)
-- =====================================================================
create table if not exists public.board_obligation_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  obligation_id uuid not null references public.board_obligations(id) on delete cascade,
  due_date date not null,
  period_label text,
  status text not null default 'pending',
  amount numeric,
  paid_at date,
  paid_amount numeric,
  notes text,
  attachment_id uuid references public.attachments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.board_obligation_occurrences enable row level security;

drop policy if exists "Users can manage own board_obligation_occurrences" on public.board_obligation_occurrences;
create policy "Users can manage own board_obligation_occurrences"
  on public.board_obligation_occurrences for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_board_obligation_occurrences on public.board_obligation_occurrences;
create trigger set_user_id_board_obligation_occurrences
  before insert on public.board_obligation_occurrences
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_board_obligation_occurrences_updated_at on public.board_obligation_occurrences;
create trigger update_board_obligation_occurrences_updated_at
  before update on public.board_obligation_occurrences
  for each row execute function public.update_updated_at_column();

create unique index if not exists idx_board_obl_occ_unique
  on public.board_obligation_occurrences (obligation_id, due_date);
create index if not exists idx_board_obl_occ_company_due
  on public.board_obligation_occurrences (company_id, due_date);
create index if not exists idx_board_obl_occ_status_due
  on public.board_obligation_occurrences (status, due_date);

-- =====================================================================
-- 4. BACKUP LOGS (append-only)
-- =====================================================================
create table if not exists public.board_backup_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  backup_type text not null default 'full',
  scope text,
  status text not null default 'success',
  started_at timestamptz,
  completed_at timestamptz,
  backup_date date not null default current_date,
  size_bytes bigint,
  destination text,
  is_automated boolean not null default false,
  retention_until date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.board_backup_logs enable row level security;

drop policy if exists "Users can manage own board_backup_logs" on public.board_backup_logs;
create policy "Users can manage own board_backup_logs"
  on public.board_backup_logs for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_board_backup_logs on public.board_backup_logs;
create trigger set_user_id_board_backup_logs
  before insert on public.board_backup_logs
  for each row execute function public.set_user_id_on_insert();

create index if not exists idx_board_backup_company_date
  on public.board_backup_logs (company_id, backup_date desc);
create index if not exists idx_board_backup_scope_date
  on public.board_backup_logs (scope, backup_date desc);

-- =====================================================================
-- 5. STACK / INVENTARIO DE FERRAMENTAS
-- IMPORTANTE: vault_reference e um PONTEIRO para o cofre (1Password/Bitwarden).
-- NUNCA armazenar senha/token aqui.
-- =====================================================================
create table if not exists public.board_stack_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  category text,
  vendor text,
  url text,
  criticality text not null default 'medium',
  status text not null default 'active',
  cost numeric,
  billing_cycle text default 'monthly',
  renewal_date date,
  auto_renew boolean not null default true,
  vault_reference text,
  owner text,
  has_backup boolean,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.board_stack_items enable row level security;

drop policy if exists "Users can manage own board_stack_items" on public.board_stack_items;
create policy "Users can manage own board_stack_items"
  on public.board_stack_items for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_board_stack_items on public.board_stack_items;
create trigger set_user_id_board_stack_items
  before insert on public.board_stack_items
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_board_stack_items_updated_at on public.board_stack_items;
create trigger update_board_stack_items_updated_at
  before update on public.board_stack_items
  for each row execute function public.update_updated_at_column();

create index if not exists idx_board_stack_company_cat
  on public.board_stack_items (company_id, category);
create index if not exists idx_board_stack_renewal
  on public.board_stack_items (renewal_date) where status = 'active';

-- =====================================================================
-- 6. SAUDE EXECUTIVA (snapshot diario, serie temporal)
-- =====================================================================
create table if not exists public.board_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  snapshot_date date not null default current_date,
  overall_score integer,
  financial_score integer,
  risk_score integer,
  governance_score integer,
  compliance_score integer,
  overall_status text,
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.board_health_snapshots enable row level security;

drop policy if exists "Users can manage own board_health_snapshots" on public.board_health_snapshots;
create policy "Users can manage own board_health_snapshots"
  on public.board_health_snapshots for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_board_health_snapshots on public.board_health_snapshots;
create trigger set_user_id_board_health_snapshots
  before insert on public.board_health_snapshots
  for each row execute function public.set_user_id_on_insert();

create unique index if not exists idx_board_health_unique
  on public.board_health_snapshots (company_id, snapshot_date);
create index if not exists idx_board_health_company_date
  on public.board_health_snapshots (company_id, snapshot_date desc);
