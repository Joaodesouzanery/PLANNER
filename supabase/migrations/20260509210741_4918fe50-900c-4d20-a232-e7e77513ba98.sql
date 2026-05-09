
-- =========================================================================
-- 1) CLIENTES & DAILY REPORT (20260428143000)
-- =========================================================================
alter table public.companies
  add column if not exists relationship_stage text default 'new',
  add column if not exists relationship_priority text default 'medium',
  add column if not exists relationship_health text default 'green',
  add column if not exists relationship_next_action_date date,
  add column if not exists relationship_notes text;

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
create policy "Users can manage own daily_reports" on public.daily_reports for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_daily_reports on public.daily_reports;
create trigger set_user_id_daily_reports before insert on public.daily_reports for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_daily_reports_updated_at on public.daily_reports;
create trigger update_daily_reports_updated_at before update on public.daily_reports for each row execute function public.update_updated_at_column();
create index if not exists idx_daily_reports_date_company on public.daily_reports (report_date, company_id);

-- governance_items
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
create policy "Users can manage own governance_items" on public.governance_items for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_governance_items on public.governance_items;
create trigger set_user_id_governance_items before insert on public.governance_items for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_governance_items_updated_at on public.governance_items;
create trigger update_governance_items_updated_at before update on public.governance_items for each row execute function public.update_updated_at_column();

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
create policy "Users can manage own governance_logs" on public.governance_logs for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_governance_logs on public.governance_logs;
create trigger set_user_id_governance_logs before insert on public.governance_logs for each row execute function public.set_user_id_on_insert();

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
create policy "Users can manage own governance_metrics" on public.governance_metrics for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_governance_metrics on public.governance_metrics;
create trigger set_user_id_governance_metrics before insert on public.governance_metrics for each row execute function public.set_user_id_on_insert();

-- =========================================================================
-- 2) ATTACHMENTS, TRUE_NORTH, INBOX, DECISIONS, REVIEWS, CAPACITY, AUTOMATIONS (20260428170000)
-- =========================================================================
alter table public.attachments
  add column if not exists document_type text default 'other',
  add column if not exists client_company_id uuid references public.companies(id) on delete set null,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists governance_item_id uuid references public.governance_items(id) on delete set null,
  add column if not exists expires_at date,
  add column if not exists alert_days integer default 30,
  add column if not exists notes text;

create table if not exists public.true_north (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  vision text,
  three_year_goal text,
  values text[] default '{}',
  decision_principles text[] default '{}',
  current_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.true_north enable row level security;
drop policy if exists "Users can manage own true_north" on public.true_north;
create policy "Users can manage own true_north" on public.true_north for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_true_north on public.true_north;
create trigger set_user_id_true_north before insert on public.true_north for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_true_north_updated_at on public.true_north;
create trigger update_true_north_updated_at before update on public.true_north for each row execute function public.update_updated_at_column();

create table if not exists public.unified_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  content text,
  source text default 'manual',
  status text default 'new',
  target_type text,
  target_id uuid,
  priority text default 'medium',
  due_date date,
  created_at timestamptz not null default now(),
  triaged_at timestamptz
);
alter table public.unified_inbox enable row level security;
drop policy if exists "Users can manage own unified_inbox" on public.unified_inbox;
create policy "Users can manage own unified_inbox" on public.unified_inbox for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_unified_inbox on public.unified_inbox;
create trigger set_user_id_unified_inbox before insert on public.unified_inbox for each row execute function public.set_user_id_on_insert();

create table if not exists public.decision_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  governance_item_id uuid references public.governance_items(id) on delete set null,
  title text not null,
  context text,
  options_considered text,
  decision text,
  expected_result text,
  review_date date,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.decision_logs enable row level security;
drop policy if exists "Users can manage own decision_logs" on public.decision_logs;
create policy "Users can manage own decision_logs" on public.decision_logs for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_decision_logs on public.decision_logs;
create trigger set_user_id_decision_logs before insert on public.decision_logs for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_decision_logs_updated_at on public.decision_logs;
create trigger update_decision_logs_updated_at before update on public.decision_logs for each row execute function public.update_updated_at_column();

create table if not exists public.review_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  cycle_type text not null,
  period_start date not null,
  period_end date not null,
  agenda text,
  summary text,
  decisions text,
  next_actions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.review_cycles enable row level security;
drop policy if exists "Users can manage own review_cycles" on public.review_cycles;
create policy "Users can manage own review_cycles" on public.review_cycles for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_review_cycles on public.review_cycles;
create trigger set_user_id_review_cycles before insert on public.review_cycles for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_review_cycles_updated_at on public.review_cycles;
create trigger update_review_cycles_updated_at before update on public.review_cycles for each row execute function public.update_updated_at_column();
create index if not exists idx_review_cycles_project_period on public.review_cycles(project_id, period_start desc);

create table if not exists public.capacity_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  checkin_date date not null default current_date,
  energy integer not null default 3,
  workload integer not null default 3,
  focus integer not null default 3,
  mood text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.capacity_checkins enable row level security;
drop policy if exists "Users can manage own capacity_checkins" on public.capacity_checkins;
create policy "Users can manage own capacity_checkins" on public.capacity_checkins for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_capacity_checkins on public.capacity_checkins;
create trigger set_user_id_capacity_checkins before insert on public.capacity_checkins for each row execute function public.set_user_id_on_insert();

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  description text,
  trigger_type text not null,
  conditions jsonb not null default '{}'::jsonb,
  action_type text not null,
  action_payload jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.automation_rules enable row level security;
drop policy if exists "Users can manage own automation_rules" on public.automation_rules;
create policy "Users can manage own automation_rules" on public.automation_rules for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_automation_rules on public.automation_rules;
create trigger set_user_id_automation_rules before insert on public.automation_rules for each row execute function public.set_user_id_on_insert();

create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  rule_id uuid references public.automation_rules(id) on delete set null,
  source_type text,
  source_id uuid,
  action_type text,
  status text default 'logged',
  result text,
  created_at timestamptz not null default now()
);
alter table public.automation_events enable row level security;
drop policy if exists "Users can manage own automation_events" on public.automation_events;
create policy "Users can manage own automation_events" on public.automation_events for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_automation_events on public.automation_events;
create trigger set_user_id_automation_events before insert on public.automation_events for each row execute function public.set_user_id_on_insert();

-- =========================================================================
-- 3) FINANCE INSTALLMENTS & PROJECT OPPORTUNITIES (20260502180000)
-- =========================================================================
alter table public.financial_transactions
  add column if not exists installment_total integer,
  add column if not exists installment_number integer,
  add column if not exists installment_group_id uuid,
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.projects
  add column if not exists next_invoice_date date,
  add column if not exists invoice_alert_days integer default 7,
  add column if not exists invoice_notes text;

create table if not exists public.project_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  description text,
  estimated_value numeric default 0,
  status text default 'open',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_opportunities enable row level security;
drop policy if exists "Users can manage own project_opportunities" on public.project_opportunities;
create policy "Users can manage own project_opportunities" on public.project_opportunities for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_project_opportunities on public.project_opportunities;
create trigger set_user_id_project_opportunities before insert on public.project_opportunities for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_project_opportunities_updated_at on public.project_opportunities;
create trigger update_project_opportunities_updated_at before update on public.project_opportunities for each row execute function public.update_updated_at_column();

-- =========================================================================
-- 4) PROJECT-SCOPED CONFERENCE & ORG CHART (20260502183000)
-- =========================================================================
alter table public.conference_stages add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.conference_items add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.org_chart_nodes add column if not exists project_id uuid references public.projects(id) on delete cascade;

-- =========================================================================
-- 5) OPERATIONAL PLANNING COCKPIT (20260503120000)
-- =========================================================================
create table if not exists public.operational_focus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  focus_date date not null default current_date,
  title text not null,
  description text,
  priority text default 'medium',
  status text default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.operational_focus enable row level security;
drop policy if exists "Users can manage own operational_focus" on public.operational_focus;
create policy "Users can manage own operational_focus" on public.operational_focus for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_operational_focus on public.operational_focus;
create trigger set_user_id_operational_focus before insert on public.operational_focus for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_operational_focus_updated_at on public.operational_focus;
create trigger update_operational_focus_updated_at before update on public.operational_focus for each row execute function public.update_updated_at_column();

-- =========================================================================
-- 6) PROJECT PLANNING FINANCIAL IMPACTS (20260503133000)
-- =========================================================================
create table if not exists public.project_financial_impacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  goal_id uuid,
  title text not null,
  amount numeric default 0,
  impact_type text default 'revenue',
  notes text,
  created_at timestamptz not null default now()
);
alter table public.project_financial_impacts enable row level security;
drop policy if exists "Users can manage own project_financial_impacts" on public.project_financial_impacts;
create policy "Users can manage own project_financial_impacts" on public.project_financial_impacts for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_project_financial_impacts on public.project_financial_impacts;
create trigger set_user_id_project_financial_impacts before insert on public.project_financial_impacts for each row execute function public.set_user_id_on_insert();

create table if not exists public.planning_risks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  goal_id uuid,
  risk text not null,
  mitigation text,
  severity text default 'medium',
  created_at timestamptz not null default now()
);
alter table public.planning_risks enable row level security;
drop policy if exists "Users can manage own planning_risks" on public.planning_risks;
create policy "Users can manage own planning_risks" on public.planning_risks for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_planning_risks on public.planning_risks;
create trigger set_user_id_planning_risks before insert on public.planning_risks for each row execute function public.set_user_id_on_insert();

create table if not exists public.planning_assumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  goal_id uuid,
  assumption text not null,
  confidence text default 'medium',
  created_at timestamptz not null default now()
);
alter table public.planning_assumptions enable row level security;
drop policy if exists "Users can manage own planning_assumptions" on public.planning_assumptions;
create policy "Users can manage own planning_assumptions" on public.planning_assumptions for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_planning_assumptions on public.planning_assumptions;
create trigger set_user_id_planning_assumptions before insert on public.planning_assumptions for each row execute function public.set_user_id_on_insert();

-- =========================================================================
-- 7) PERSUASION NOTES (20260503143000)
-- =========================================================================
create table if not exists public.persuasion_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  content text,
  category text default 'general',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.persuasion_notes enable row level security;
drop policy if exists "Users can manage own persuasion_notes" on public.persuasion_notes;
create policy "Users can manage own persuasion_notes" on public.persuasion_notes for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_persuasion_notes on public.persuasion_notes;
create trigger set_user_id_persuasion_notes before insert on public.persuasion_notes for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_persuasion_notes_updated_at on public.persuasion_notes;
create trigger update_persuasion_notes_updated_at before update on public.persuasion_notes for each row execute function public.update_updated_at_column();

-- =========================================================================
-- 8) DASHBOARD REMINDERS + CONTACTS RELATIONSHIP + FACULDADE GEO (20260508133000)
-- =========================================================================
create table if not exists public.dashboard_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  phrase text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dashboard_reminders enable row level security;
drop policy if exists "Users can manage own dashboard_reminders" on public.dashboard_reminders;
create policy "Users can manage own dashboard_reminders" on public.dashboard_reminders for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_dashboard_reminders on public.dashboard_reminders;
create trigger set_user_id_dashboard_reminders before insert on public.dashboard_reminders for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_dashboard_reminders_updated_at on public.dashboard_reminders;
create trigger update_dashboard_reminders_updated_at before update on public.dashboard_reminders for each row execute function public.update_updated_at_column();

alter table public.contacts
  add column if not exists relationship_stage text default 'new',
  add column if not exists relationship_priority text default 'medium',
  add column if not exists relationship_health text default 'green',
  add column if not exists relationship_next_action_date date,
  add column if not exists relationship_notes text;

alter table public.faculdade_disciplinas
  add column if not exists address text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;

-- =========================================================================
-- 9) NEW: GRATITUDE JOURNAL (Diário de Gratidão)
-- =========================================================================
create table if not exists public.gratitude_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  entry_date date not null default current_date,
  content text not null,
  mood text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gratitude_entries enable row level security;
drop policy if exists "Users can manage own gratitude_entries" on public.gratitude_entries;
create policy "Users can manage own gratitude_entries" on public.gratitude_entries for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_gratitude_entries on public.gratitude_entries;
create trigger set_user_id_gratitude_entries before insert on public.gratitude_entries for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_gratitude_entries_updated_at on public.gratitude_entries;
create trigger update_gratitude_entries_updated_at before update on public.gratitude_entries for each row execute function public.update_updated_at_column();
create index if not exists idx_gratitude_entries_user_date on public.gratitude_entries(user_id, entry_date desc);

-- =========================================================================
-- 10) NEW: MEDIA PLANNING (Comercial > Mídia)
-- =========================================================================
create table if not exists public.media_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  week_start date not null,
  posts_target integer default 0,
  reels_target integer default 0,
  stories_target integer default 0,
  videos_target integer default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.media_plans enable row level security;
drop policy if exists "Users can manage own media_plans" on public.media_plans;
create policy "Users can manage own media_plans" on public.media_plans for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_media_plans on public.media_plans;
create trigger set_user_id_media_plans before insert on public.media_plans for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_media_plans_updated_at on public.media_plans;
create trigger update_media_plans_updated_at before update on public.media_plans for each row execute function public.update_updated_at_column();
create index if not exists idx_media_plans_project_week on public.media_plans(project_id, week_start desc);

create table if not exists public.media_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  plan_id uuid references public.media_plans(id) on delete set null,
  posted_at date not null default current_date,
  format text not null default 'post',
  title text not null,
  copy text,
  approach text,
  reach integer default 0,
  likes integer default 0,
  comments integer default 0,
  shares integer default 0,
  saves integer default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.media_posts enable row level security;
drop policy if exists "Users can manage own media_posts" on public.media_posts;
create policy "Users can manage own media_posts" on public.media_posts for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_media_posts on public.media_posts;
create trigger set_user_id_media_posts before insert on public.media_posts for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_media_posts_updated_at on public.media_posts;
create trigger update_media_posts_updated_at before update on public.media_posts for each row execute function public.update_updated_at_column();
create index if not exists idx_media_posts_project_date on public.media_posts(project_id, posted_at desc);
