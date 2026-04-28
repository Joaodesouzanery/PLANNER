-- Turn attachments into a global document index while keeping the same storage bucket.
alter table public.attachments
  add column if not exists document_type text default 'other',
  add column if not exists client_company_id uuid references public.companies(id) on delete set null,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists governance_item_id uuid references public.governance_items(id) on delete set null,
  add column if not exists expires_at date,
  add column if not exists alert_days integer default 30,
  add column if not exists notes text;

create index if not exists idx_attachments_document_type on public.attachments(document_type);
create index if not exists idx_attachments_client_project on public.attachments(client_company_id, project_id);
create index if not exists idx_attachments_expires_at on public.attachments(expires_at);

update public.attachments
set document_type = case
  when entity_type = 'project_contract' then 'contract'
  when entity_type = 'project_invoice' then 'invoice'
  when entity_type = 'governance' then 'governance'
  else coalesce(document_type, 'other')
end
where document_type is null or document_type = 'other';

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
create policy "Users can manage own true_north"
  on public.true_north for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_true_north on public.true_north;
create trigger set_user_id_true_north before insert on public.true_north for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_true_north_updated_at on public.true_north;
create trigger update_true_north_updated_at before update on public.true_north for each row execute function public.update_updated_at_column();
create unique index if not exists idx_true_north_scope
  on public.true_north(user_id, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid));

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
create policy "Users can manage own unified_inbox"
  on public.unified_inbox for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_unified_inbox on public.unified_inbox;
create trigger set_user_id_unified_inbox before insert on public.unified_inbox for each row execute function public.set_user_id_on_insert();
create index if not exists idx_unified_inbox_status_due on public.unified_inbox(status, due_date);

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
create policy "Users can manage own decision_logs"
  on public.decision_logs for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_decision_logs on public.decision_logs;
create trigger set_user_id_decision_logs before insert on public.decision_logs for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_decision_logs_updated_at on public.decision_logs;
create trigger update_decision_logs_updated_at before update on public.decision_logs for each row execute function public.update_updated_at_column();
create index if not exists idx_decision_logs_review_date on public.decision_logs(review_date);

create table if not exists public.review_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
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
create policy "Users can manage own review_cycles"
  on public.review_cycles for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_review_cycles on public.review_cycles;
create trigger set_user_id_review_cycles before insert on public.review_cycles for each row execute function public.set_user_id_on_insert();
drop trigger if exists update_review_cycles_updated_at on public.review_cycles;
create trigger update_review_cycles_updated_at before update on public.review_cycles for each row execute function public.update_updated_at_column();
create index if not exists idx_review_cycles_type_period on public.review_cycles(cycle_type, period_start desc);

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
create policy "Users can manage own capacity_checkins"
  on public.capacity_checkins for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_capacity_checkins on public.capacity_checkins;
create trigger set_user_id_capacity_checkins before insert on public.capacity_checkins for each row execute function public.set_user_id_on_insert();
create index if not exists idx_capacity_checkins_date on public.capacity_checkins(checkin_date desc);

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
create policy "Users can manage own automation_rules"
  on public.automation_rules for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_automation_rules on public.automation_rules;
create trigger set_user_id_automation_rules before insert on public.automation_rules for each row execute function public.set_user_id_on_insert();
create index if not exists idx_automation_rules_enabled on public.automation_rules(enabled, trigger_type);

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
create policy "Users can manage own automation_events"
  on public.automation_events for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_automation_events on public.automation_events;
create trigger set_user_id_automation_events before insert on public.automation_events for each row execute function public.set_user_id_on_insert();
create index if not exists idx_automation_events_created on public.automation_events(created_at desc);

create table if not exists public.ai_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  briefing_date date not null default current_date,
  title text,
  content text not null,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_briefings enable row level security;
drop policy if exists "Users can manage own ai_briefings" on public.ai_briefings;
create policy "Users can manage own ai_briefings"
  on public.ai_briefings for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));
drop trigger if exists set_user_id_ai_briefings on public.ai_briefings;
create trigger set_user_id_ai_briefings before insert on public.ai_briefings for each row execute function public.set_user_id_on_insert();
create index if not exists idx_ai_briefings_date on public.ai_briefings(briefing_date desc);
