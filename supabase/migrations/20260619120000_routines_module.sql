-- Rotinas module: clientes por segmento, NF, checklists diarios e tarefas/andamentos
-- Tabelas por usuario (sem company_id). RLS: user_id = auth.uid().

-- 1. Segmentos (Construcao, Regulacao, CONAB, Nery Agro)
create table if not exists public.routine_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  color text default '#6366f1',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.routine_segments enable row level security;

drop policy if exists "Users can manage own routine_segments" on public.routine_segments;
create policy "Users can manage own routine_segments"
  on public.routine_segments for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists set_user_id_routine_segments on public.routine_segments;
create trigger set_user_id_routine_segments
  before insert on public.routine_segments
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_routine_segments_updated_at on public.routine_segments;
create trigger update_routine_segments_updated_at
  before update on public.routine_segments
  for each row execute function public.update_updated_at_column();

create index if not exists idx_routine_segments_user_sort
  on public.routine_segments (user_id, sort_order);

-- 2. Clientes
create table if not exists public.routine_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  segment_id uuid references public.routine_segments(id) on delete cascade,
  name text not null,
  color text default '#6366f1',
  invoice_day integer,
  invoice_notes text,
  status text not null default 'active',
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.routine_clients enable row level security;

drop policy if exists "Users can manage own routine_clients" on public.routine_clients;
create policy "Users can manage own routine_clients"
  on public.routine_clients for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists set_user_id_routine_clients on public.routine_clients;
create trigger set_user_id_routine_clients
  before insert on public.routine_clients
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_routine_clients_updated_at on public.routine_clients;
create trigger update_routine_clients_updated_at
  before update on public.routine_clients
  for each row execute function public.update_updated_at_column();

create index if not exists idx_routine_clients_segment_sort
  on public.routine_clients (segment_id, sort_order);

-- 3. Itens dos checklists diarios (templates): conferencia | tarefa
create table if not exists public.routine_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  client_id uuid references public.routine_clients(id) on delete cascade,
  kind text not null default 'tarefa',
  title text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.routine_checklist_items enable row level security;

drop policy if exists "Users can manage own routine_checklist_items" on public.routine_checklist_items;
create policy "Users can manage own routine_checklist_items"
  on public.routine_checklist_items for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists set_user_id_routine_checklist_items on public.routine_checklist_items;
create trigger set_user_id_routine_checklist_items
  before insert on public.routine_checklist_items
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_routine_checklist_items_updated_at on public.routine_checklist_items;
create trigger update_routine_checklist_items_updated_at
  before update on public.routine_checklist_items
  for each row execute function public.update_updated_at_column();

create index if not exists idx_routine_checklist_items_client
  on public.routine_checklist_items (client_id, kind, sort_order);

-- 4. Marcacao por dia (reset diario)
create table if not exists public.routine_checklist_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  client_id uuid references public.routine_clients(id) on delete cascade,
  item_id uuid references public.routine_checklist_items(id) on delete cascade,
  log_date date not null default current_date,
  done boolean not null default true,
  done_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.routine_checklist_logs enable row level security;

drop policy if exists "Users can manage own routine_checklist_logs" on public.routine_checklist_logs;
create policy "Users can manage own routine_checklist_logs"
  on public.routine_checklist_logs for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists set_user_id_routine_checklist_logs on public.routine_checklist_logs;
create trigger set_user_id_routine_checklist_logs
  before insert on public.routine_checklist_logs
  for each row execute function public.set_user_id_on_insert();

create unique index if not exists idx_routine_checklist_logs_unique
  on public.routine_checklist_logs (user_id, item_id, log_date);

create index if not exists idx_routine_checklist_logs_client_date
  on public.routine_checklist_logs (client_id, log_date);

-- 5. Tarefas / andamentos / pendencias / proximas etapas (nao-diarias)
create table if not exists public.routine_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  client_id uuid references public.routine_clients(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending',
  priority text not null default 'medium',
  due_date date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.routine_tasks enable row level security;

drop policy if exists "Users can manage own routine_tasks" on public.routine_tasks;
create policy "Users can manage own routine_tasks"
  on public.routine_tasks for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists set_user_id_routine_tasks on public.routine_tasks;
create trigger set_user_id_routine_tasks
  before insert on public.routine_tasks
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_routine_tasks_updated_at on public.routine_tasks;
create trigger update_routine_tasks_updated_at
  before update on public.routine_tasks
  for each row execute function public.update_updated_at_column();

create index if not exists idx_routine_tasks_client_status
  on public.routine_tasks (client_id, status);
