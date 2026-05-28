-- Monthly finance planning separated from realized transactions.

create table if not exists public.finance_monthly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2000 and 2100),
  notes text,
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_monthly_plans enable row level security;

drop policy if exists "Users can manage own finance_monthly_plans" on public.finance_monthly_plans;
create policy "Users can manage own finance_monthly_plans"
  on public.finance_monthly_plans for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_finance_monthly_plans on public.finance_monthly_plans;
create trigger set_user_id_finance_monthly_plans
  before insert on public.finance_monthly_plans
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_finance_monthly_plans_updated_at on public.finance_monthly_plans;
create trigger update_finance_monthly_plans_updated_at
  before update on public.finance_monthly_plans
  for each row execute function public.update_updated_at_column();

create unique index if not exists idx_finance_monthly_plans_company_period
  on public.finance_monthly_plans (company_id, year, month);

create table if not exists public.finance_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  plan_id uuid not null references public.finance_monthly_plans(id) on delete cascade,
  transaction_id uuid references public.financial_transactions(id) on delete set null,
  description text not null,
  amount numeric not null default 0,
  type text not null check (type in ('income', 'expense')),
  category text,
  due_date date not null,
  status text not null default 'planned' check (status in ('planned', 'confirmed', 'skipped')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_plan_items enable row level security;

drop policy if exists "Users can manage own finance_plan_items" on public.finance_plan_items;
create policy "Users can manage own finance_plan_items"
  on public.finance_plan_items for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_finance_plan_items on public.finance_plan_items;
create trigger set_user_id_finance_plan_items
  before insert on public.finance_plan_items
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_finance_plan_items_updated_at on public.finance_plan_items;
create trigger update_finance_plan_items_updated_at
  before update on public.finance_plan_items
  for each row execute function public.update_updated_at_column();

create index if not exists idx_finance_plan_items_plan_due
  on public.finance_plan_items (plan_id, due_date);

create index if not exists idx_finance_plan_items_company_status
  on public.finance_plan_items (company_id, status);
