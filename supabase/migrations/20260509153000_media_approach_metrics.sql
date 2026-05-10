create table if not exists public.media_approach_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  week_start date not null,
  approach text not null,
  channel text not null default 'LinkedIn',
  impressions integer not null default 0 check (impressions >= 0),
  engagements integer not null default 0 check (engagements >= 0),
  leads integer not null default 0 check (leads >= 0),
  meetings integer not null default 0 check (meetings >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.media_approach_metrics enable row level security;

drop policy if exists "Users can manage own media_approach_metrics" on public.media_approach_metrics;
create policy "Users can manage own media_approach_metrics"
  on public.media_approach_metrics for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_media_approach_metrics on public.media_approach_metrics;
create trigger set_user_id_media_approach_metrics
  before insert on public.media_approach_metrics
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_media_approach_metrics_updated_at on public.media_approach_metrics;
create trigger update_media_approach_metrics_updated_at
  before update on public.media_approach_metrics
  for each row execute function public.update_updated_at_column();

create index if not exists idx_media_approach_metrics_company_week on public.media_approach_metrics(company_id, week_start);
create index if not exists idx_media_approach_metrics_user_week on public.media_approach_metrics(user_id, week_start desc);
create index if not exists idx_media_approach_metrics_approach on public.media_approach_metrics(approach);
