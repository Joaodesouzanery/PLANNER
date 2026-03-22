
-- ============ FACULDADE_DISCIPLINAS ============
create table if not exists public.faculdade_disciplinas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  professor text,
  color text default 'blue',
  notes text,
  user_id uuid references auth.users(id) not null default auth.uid(),
  created_at timestamptz default now()
);

alter table public.faculdade_disciplinas enable row level security;

create policy "Users own their disciplinas"
  on public.faculdade_disciplinas
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============ FACULDADE_PROVAS ============
create table if not exists public.faculdade_provas (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid references public.faculdade_disciplinas(id) on delete cascade,
  title text not null,
  exam_date date not null,
  priority text default 'medium',
  status text default 'pending',
  notes text,
  grade numeric(5,2),
  user_id uuid references auth.users(id) not null default auth.uid(),
  created_at timestamptz default now()
);

alter table public.faculdade_provas enable row level security;

create policy "Users own their provas"
  on public.faculdade_provas
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============ FACULDADE_TAREFAS ============
create table if not exists public.faculdade_tarefas (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid references public.faculdade_disciplinas(id) on delete set null,
  title text not null,
  description text,
  due_date date,
  priority text default 'medium',
  status text default 'pending',
  user_id uuid references auth.users(id) not null default auth.uid(),
  created_at timestamptz default now()
);

alter table public.faculdade_tarefas enable row level security;

create policy "Users own their tarefas"
  on public.faculdade_tarefas
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Projects: add notes and checklist columns if not already added
alter table public.projects add column if not exists notes text;
alter table public.projects add column if not exists checklist jsonb default '[]'::jsonb;
