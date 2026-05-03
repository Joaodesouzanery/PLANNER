alter table public.planning_north_metrics
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.planning_assumptions
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.planning_risks
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.decision_logs
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create table if not exists public.planning_financial_impacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  okr_id uuid references public.okrs(id) on delete set null,
  goal_id uuid references public.planning_goals(id) on delete set null,
  key_result_id uuid references public.okr_key_results(id) on delete set null,
  title text not null,
  impact_type text not null default 'revenue',
  expected_amount numeric not null default 0,
  expected_date date,
  confidence text default 'medium',
  status text default 'planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planning_financial_impacts enable row level security;

drop policy if exists "Users can manage own planning_financial_impacts" on public.planning_financial_impacts;
create policy "Users can manage own planning_financial_impacts"
  on public.planning_financial_impacts for all to authenticated
  using (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id))
  with check (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id));

drop trigger if exists set_user_id_planning_financial_impacts on public.planning_financial_impacts;
create trigger set_user_id_planning_financial_impacts before insert on public.planning_financial_impacts for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_planning_financial_impacts_updated_at on public.planning_financial_impacts;
create trigger update_planning_financial_impacts_updated_at before update on public.planning_financial_impacts for each row execute function public.update_updated_at_column();

create index if not exists idx_planning_north_metrics_project on public.planning_north_metrics(project_id);
create index if not exists idx_planning_assumptions_project on public.planning_assumptions(project_id, status);
create index if not exists idx_planning_risks_project on public.planning_risks(project_id, score desc);
create index if not exists idx_decision_logs_project on public.decision_logs(project_id, created_at desc);
create index if not exists idx_planning_financial_impacts_company_date on public.planning_financial_impacts(company_id, expected_date);
create index if not exists idx_planning_financial_impacts_project on public.planning_financial_impacts(project_id, status);

grant select, insert, update, delete on public.planning_financial_impacts to authenticated;
