create table if not exists public.dashboard_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  company_id uuid references public.companies(id) on delete set null,
  phrase text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dashboard_reminders enable row level security;

drop policy if exists "Users can manage own dashboard reminders" on public.dashboard_reminders;
create policy "Users can manage own dashboard reminders"
  on public.dashboard_reminders
  for all
  to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists update_dashboard_reminders_updated_at on public.dashboard_reminders;
create trigger update_dashboard_reminders_updated_at
  before update on public.dashboard_reminders
  for each row execute function public.update_updated_at_column();

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

create index if not exists faculdade_disciplinas_location_idx
  on public.faculdade_disciplinas(latitude, longitude)
  where latitude is not null and longitude is not null;
