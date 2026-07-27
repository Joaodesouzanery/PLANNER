-- CRM · Instrumentação do funil: log de transição de etapa do kanban de deals (append-only).
-- Cada movimento entre colunas grava um evento com timestamp — a espinha do documento. Alimenta:
-- histórico, undo/redo e as métricas (tempo por etapa, win rate, ciclo em dias). Padrão do repo:
-- RLS user_id OR owns_company, trigger set_user_id_on_insert. Idempotente. Aditiva.

create table if not exists public.crm_stage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade,
  deal_id uuid references public.project_opportunities(id) on delete cascade,
  from_stage text,
  to_stage text,
  from_outcome text,
  to_outcome text,
  moved_at timestamptz not null default now()
);

alter table public.crm_stage_events enable row level security;

drop policy if exists "Users can manage own crm_stage_events" on public.crm_stage_events;
create policy "Users can manage own crm_stage_events"
  on public.crm_stage_events for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_crm_stage_events on public.crm_stage_events;
create trigger set_user_id_crm_stage_events
  before insert on public.crm_stage_events
  for each row execute function public.set_user_id_on_insert();

create index if not exists idx_crm_stage_events_company_moved
  on public.crm_stage_events (company_id, moved_at desc);
create index if not exists idx_crm_stage_events_deal
  on public.crm_stage_events (deal_id, moved_at);
