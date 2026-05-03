alter table public.decision_logs
  add column if not exists category text,
  add column if not exists tags text[] default '{}',
  add column if not exists decision_criteria text,
  add column if not exists involved_people text,
  add column if not exists result text;

create table if not exists public.planning_north_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  metric_name text not null,
  product_area text,
  current_value numeric default 0,
  quarter_target numeric default 0,
  unit text,
  history_note text,
  change_reason text,
  levers text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.okr_key_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  okr_id uuid references public.okrs(id) on delete cascade,
  title text not null,
  target_value numeric default 0,
  current_value numeric default 0,
  unit text,
  confidence text default 'medium',
  owner text,
  cycle text,
  project_id uuid references public.projects(id) on delete set null,
  not_doing text,
  learning text,
  retrospective text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_assumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  assumption text not null,
  product_area text,
  criticality text default 'medium',
  test_plan text,
  status text default 'not_tested',
  learning text,
  plan_impact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_risks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  risk text not null,
  product_area text,
  probability text default 'medium',
  impact text default 'medium',
  score integer generated always as (
    (case probability when 'high' then 3 when 'medium' then 2 else 1 end) *
    (case impact when 'high' then 3 when 'medium' then 2 else 1 end)
  ) stored,
  mitigation text,
  contingency_plan text,
  owner text,
  status text default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_time_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  week_start date not null,
  category text not null,
  product_area text,
  project_id uuid references public.projects(id) on delete set null,
  horizon text default 'h1',
  planned_hours numeric default 0,
  actual_hours numeric default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planning_north_metrics enable row level security;
alter table public.okr_key_results enable row level security;
alter table public.planning_assumptions enable row level security;
alter table public.planning_risks enable row level security;
alter table public.planning_time_allocations enable row level security;

drop policy if exists "Users can manage own planning_north_metrics" on public.planning_north_metrics;
create policy "Users can manage own planning_north_metrics"
  on public.planning_north_metrics for all to authenticated
  using (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id))
  with check (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id));

drop policy if exists "Users can manage own okr_key_results" on public.okr_key_results;
create policy "Users can manage own okr_key_results"
  on public.okr_key_results for all to authenticated
  using (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id))
  with check (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id));

drop policy if exists "Users can manage own planning_assumptions" on public.planning_assumptions;
create policy "Users can manage own planning_assumptions"
  on public.planning_assumptions for all to authenticated
  using (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id))
  with check (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id));

drop policy if exists "Users can manage own planning_risks" on public.planning_risks;
create policy "Users can manage own planning_risks"
  on public.planning_risks for all to authenticated
  using (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id))
  with check (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id));

drop policy if exists "Users can manage own planning_time_allocations" on public.planning_time_allocations;
create policy "Users can manage own planning_time_allocations"
  on public.planning_time_allocations for all to authenticated
  using (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id))
  with check (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id));

drop trigger if exists set_user_id_planning_north_metrics on public.planning_north_metrics;
create trigger set_user_id_planning_north_metrics before insert on public.planning_north_metrics for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_planning_north_metrics_updated_at on public.planning_north_metrics;
create trigger update_planning_north_metrics_updated_at before update on public.planning_north_metrics for each row execute function public.update_updated_at_column();

drop trigger if exists set_user_id_okr_key_results on public.okr_key_results;
create trigger set_user_id_okr_key_results before insert on public.okr_key_results for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_okr_key_results_updated_at on public.okr_key_results;
create trigger update_okr_key_results_updated_at before update on public.okr_key_results for each row execute function public.update_updated_at_column();

drop trigger if exists set_user_id_planning_assumptions on public.planning_assumptions;
create trigger set_user_id_planning_assumptions before insert on public.planning_assumptions for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_planning_assumptions_updated_at on public.planning_assumptions;
create trigger update_planning_assumptions_updated_at before update on public.planning_assumptions for each row execute function public.update_updated_at_column();

drop trigger if exists set_user_id_planning_risks on public.planning_risks;
create trigger set_user_id_planning_risks before insert on public.planning_risks for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_planning_risks_updated_at on public.planning_risks;
create trigger update_planning_risks_updated_at before update on public.planning_risks for each row execute function public.update_updated_at_column();

drop trigger if exists set_user_id_planning_time_allocations on public.planning_time_allocations;
create trigger set_user_id_planning_time_allocations before insert on public.planning_time_allocations for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_planning_time_allocations_updated_at on public.planning_time_allocations;
create trigger update_planning_time_allocations_updated_at before update on public.planning_time_allocations for each row execute function public.update_updated_at_column();

create index if not exists idx_planning_north_metrics_company on public.planning_north_metrics(company_id, created_at desc);
create index if not exists idx_okr_key_results_okr on public.okr_key_results(okr_id);
create index if not exists idx_okr_key_results_company on public.okr_key_results(company_id, created_at desc);
create index if not exists idx_planning_assumptions_company_status on public.planning_assumptions(company_id, status);
create index if not exists idx_planning_risks_company_score on public.planning_risks(company_id, score desc);
create index if not exists idx_planning_time_allocations_week on public.planning_time_allocations(company_id, week_start desc);
create index if not exists idx_decision_logs_category on public.decision_logs(company_id, category);

grant select, insert, update, delete on public.planning_north_metrics to authenticated;
grant select, insert, update, delete on public.okr_key_results to authenticated;
grant select, insert, update, delete on public.planning_assumptions to authenticated;
grant select, insert, update, delete on public.planning_risks to authenticated;
grant select, insert, update, delete on public.planning_time_allocations to authenticated;
