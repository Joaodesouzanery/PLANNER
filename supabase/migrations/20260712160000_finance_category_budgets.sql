-- CFO v2 · Fase 3: orçado × realizado por categoria (teto mensal por categoria).
create table if not exists public.finance_category_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  category text not null,
  year int not null,
  month int not null,
  teto numeric not null default 0,
  updated_at timestamptz default now(),
  unique (user_id, category, year, month)
);
alter table public.finance_category_budgets enable row level security;
create policy "budgets own" on public.finance_category_budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
