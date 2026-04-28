-- Client relationship fields for the Comercial > Clientes kanban
alter table public.companies
  add column if not exists relationship_stage text default 'new',
  add column if not exists relationship_priority text default 'medium',
  add column if not exists relationship_health text default 'green',
  add column if not exists relationship_next_action_date date,
  add column if not exists relationship_notes text;

-- Daily Report executive journal
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  report_date date not null,
  project_id uuid references public.projects(id) on delete set null,
  area text default 'geral',
  decisions text,
  notes text,
  blockers text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_reports enable row level security;

drop policy if exists "Users can manage own daily_reports" on public.daily_reports;
create policy "Users can manage own daily_reports"
  on public.daily_reports for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_daily_reports on public.daily_reports;
create trigger set_user_id_daily_reports
  before insert on public.daily_reports
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_daily_reports_updated_at on public.daily_reports;
create trigger update_daily_reports_updated_at
  before update on public.daily_reports
  for each row execute function public.update_updated_at_column();

create unique index if not exists idx_daily_reports_scope
  on public.daily_reports (user_id, report_date, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), area);

create index if not exists idx_daily_reports_date_company
  on public.daily_reports (report_date, company_id);

-- Conselho de Administracao: flexible governance records
create table if not exists public.governance_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  category text not null,
  title text not null,
  description text,
  status text default 'open',
  priority text default 'medium',
  owner text,
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.governance_items enable row level security;

drop policy if exists "Users can manage own governance_items" on public.governance_items;
create policy "Users can manage own governance_items"
  on public.governance_items for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_governance_items on public.governance_items;
create trigger set_user_id_governance_items
  before insert on public.governance_items
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_governance_items_updated_at on public.governance_items;
create trigger update_governance_items_updated_at
  before update on public.governance_items
  for each row execute function public.update_updated_at_column();

create index if not exists idx_governance_items_category_due
  on public.governance_items (category, due_date);

create index if not exists idx_governance_items_company_category
  on public.governance_items (company_id, category);

create table if not exists public.governance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  item_id uuid references public.governance_items(id) on delete cascade,
  category text not null,
  title text not null,
  notes text,
  happened_at date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.governance_logs enable row level security;

drop policy if exists "Users can manage own governance_logs" on public.governance_logs;
create policy "Users can manage own governance_logs"
  on public.governance_logs for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_governance_logs on public.governance_logs;
create trigger set_user_id_governance_logs
  before insert on public.governance_logs
  for each row execute function public.set_user_id_on_insert();

create index if not exists idx_governance_logs_category_date
  on public.governance_logs (category, happened_at desc);

create table if not exists public.governance_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  category text not null,
  metric_date date not null default current_date,
  name text not null,
  value numeric,
  unit text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.governance_metrics enable row level security;

drop policy if exists "Users can manage own governance_metrics" on public.governance_metrics;
create policy "Users can manage own governance_metrics"
  on public.governance_metrics for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_governance_metrics on public.governance_metrics;
create trigger set_user_id_governance_metrics
  before insert on public.governance_metrics
  for each row execute function public.set_user_id_on_insert();

create index if not exists idx_governance_metrics_category_date
  on public.governance_metrics (category, metric_date desc);
