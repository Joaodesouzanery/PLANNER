-- Scope conference and org chart records by project while preserving company-level base templates.

alter table public.conference_stages
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.conference_items
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.org_chart_nodes
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

create index if not exists idx_conference_stages_project
  on public.conference_stages(project_id);

create index if not exists idx_conference_items_project
  on public.conference_items(project_id);

create index if not exists idx_org_chart_nodes_project
  on public.org_chart_nodes(project_id);
