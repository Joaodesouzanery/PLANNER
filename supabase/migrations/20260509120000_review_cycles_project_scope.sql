alter table public.review_cycles
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists idx_review_cycles_project_period
  on public.review_cycles(project_id, period_start desc);
