-- Camada CFO 2: patrimônio (ativos/passivos) + sinking funds (provisões p/ gastos grandes).
create table if not exists public.finance_networth_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null default 'asset',   -- asset | liability
  label text not null,
  category text,                          -- caixa | investimento | bem | divida | outro
  value numeric not null default 0,
  sort_order int default 0,
  updated_at timestamptz default now()
);

create table if not exists public.finance_sinking_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  target numeric not null default 0,
  due_date date,
  monthly numeric default 0,
  balance numeric default 0,
  updated_at timestamptz default now()
);

alter table public.finance_networth_items enable row level security;
alter table public.finance_sinking_funds enable row level security;
create policy "networth own" on public.finance_networth_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sinking own" on public.finance_sinking_funds for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
