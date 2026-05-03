-- Saved finance installment simulations and project opportunity links.

create table if not exists public.finance_saved_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  item_name text not null,
  item_price numeric not null default 0,
  monthly_income numeric,
  monthly_expenses numeric,
  option_label text not null,
  risk_level text,
  installments integer not null,
  monthly_payment numeric not null,
  percent_of_income numeric,
  remains_after numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.finance_saved_installments enable row level security;

drop policy if exists "Users can manage own finance_saved_installments" on public.finance_saved_installments;
create policy "Users can manage own finance_saved_installments"
  on public.finance_saved_installments for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_finance_saved_installments on public.finance_saved_installments;
create trigger set_user_id_finance_saved_installments
  before insert on public.finance_saved_installments
  for each row execute function public.set_user_id_on_insert();

create index if not exists idx_finance_saved_installments_company_created
  on public.finance_saved_installments (company_id, created_at desc);

create table if not exists public.project_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  value numeric,
  stage text default 'nova',
  probability numeric,
  expected_close_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_opportunities enable row level security;

drop policy if exists "Users can manage own project_opportunities" on public.project_opportunities;
create policy "Users can manage own project_opportunities"
  on public.project_opportunities for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_project_opportunities on public.project_opportunities;
create trigger set_user_id_project_opportunities
  before insert on public.project_opportunities
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_project_opportunities_updated_at on public.project_opportunities;
create trigger update_project_opportunities_updated_at
  before update on public.project_opportunities
  for each row execute function public.update_updated_at_column();

create index if not exists idx_project_opportunities_project_created
  on public.project_opportunities (project_id, created_at desc);

create index if not exists idx_project_opportunities_company_stage
  on public.project_opportunities (company_id, stage);
