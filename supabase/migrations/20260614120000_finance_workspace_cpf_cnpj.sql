-- Financial workspace: CPF/CNPJ entities, accounts, transfers, cards and cash-flow metadata.

create table if not exists public.finance_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('cpf', 'cnpj')),
  name text not null,
  color text default 'primary',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((entity_type = 'cpf' and company_id is null) or entity_type = 'cnpj')
);

create unique index if not exists idx_finance_entities_company
  on public.finance_entities(company_id) where company_id is not null;
create unique index if not exists idx_finance_entities_personal_user
  on public.finance_entities(user_id) where entity_type = 'cpf';

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  entity_id uuid not null references public.finance_entities(id) on delete cascade,
  name text not null,
  account_type text not null default 'checking'
    check (account_type in ('checking', 'savings', 'cash', 'investment', 'credit_card')),
  opening_balance numeric not null default 0,
  opening_balance_date date not null default current_date,
  credit_limit numeric,
  closing_day integer check (closing_day between 1 and 31),
  due_day integer check (due_day between 1 and 31),
  color text default 'primary',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finance_accounts_entity on public.finance_accounts(entity_id, is_active);
create unique index if not exists idx_finance_accounts_default_entity
  on public.finance_accounts(entity_id) where is_default;

create table if not exists public.finance_card_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  card_account_id uuid not null references public.finance_accounts(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  closing_date date not null,
  due_date date not null,
  amount numeric not null default 0,
  status text not null default 'open' check (status in ('open', 'closed', 'paid')),
  paid_at timestamptz,
  payment_transfer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(card_account_id, period_start, period_end)
);

create table if not exists public.finance_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  from_account_id uuid not null references public.finance_accounts(id) on delete restrict,
  to_account_id uuid not null references public.finance_accounts(id) on delete restrict,
  amount numeric not null check (amount > 0),
  transfer_date date not null default current_date,
  description text,
  status text not null default 'confirmed' check (status in ('planned', 'confirmed', 'reconciled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

alter table public.finance_card_invoices
  drop constraint if exists finance_card_invoices_payment_transfer_id_fkey;
alter table public.finance_card_invoices
  add constraint finance_card_invoices_payment_transfer_id_fkey
  foreign key (payment_transfer_id) references public.finance_transfers(id) on delete set null;

alter table public.financial_transactions
  add column if not exists finance_account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists due_date date,
  add column if not exists settled_at timestamptz,
  add column if not exists status text default 'confirmed',
  add column if not exists card_invoice_id uuid references public.finance_card_invoices(id) on delete set null,
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists import_fingerprint text;

update public.financial_transactions set due_date = date where due_date is null;
update public.financial_transactions set status = 'confirmed' where status is null;

alter table public.finance_monthly_plans
  add column if not exists entity_id uuid references public.finance_entities(id) on delete set null,
  add column if not exists account_id uuid references public.finance_accounts(id) on delete set null;
alter table public.finance_plan_items
  add column if not exists entity_id uuid references public.finance_entities(id) on delete set null,
  add column if not exists account_id uuid references public.finance_accounts(id) on delete set null;
alter table public.finance_saved_installments
  add column if not exists entity_id uuid references public.finance_entities(id) on delete set null,
  add column if not exists account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists added_to_flow_at timestamptz;

-- Create a CNPJ entity and a main account for every existing company.
insert into public.finance_entities (user_id, company_id, entity_type, name, color, is_default)
select c.user_id, c.id, 'cnpj', c.name, c.color, true
from public.companies c
where not exists (select 1 from public.finance_entities e where e.company_id = c.id);

insert into public.finance_accounts (user_id, company_id, entity_id, name, account_type, is_default)
select e.user_id, e.company_id, e.id, 'Conta principal', 'checking', true
from public.finance_entities e
where e.entity_type = 'cnpj'
  and not exists (select 1 from public.finance_accounts a where a.entity_id = e.id and a.is_default);

-- Existing personal data creates the first CPF entity. Users without data are bootstrapped by the client.
insert into public.finance_entities (user_id, entity_type, name, is_default)
select distinct t.user_id, 'cpf', 'Pessoal', true
from public.financial_transactions t
where t.user_id is not null and t.company_id is null
  and not exists (
    select 1 from public.finance_entities e where e.user_id = t.user_id and e.entity_type = 'cpf'
  );

insert into public.finance_accounts (user_id, entity_id, name, account_type, is_default)
select e.user_id, e.id, 'Conta pessoal', 'checking', true
from public.finance_entities e
where e.entity_type = 'cpf'
  and not exists (select 1 from public.finance_accounts a where a.entity_id = e.id and a.is_default);

update public.financial_transactions t
set finance_account_id = a.id
from public.finance_entities e
join public.finance_accounts a on a.entity_id = e.id and a.is_default
where t.finance_account_id is null
  and ((t.company_id is not null and e.company_id = t.company_id)
    or (t.company_id is null and e.entity_type = 'cpf' and e.user_id = t.user_id));

create unique index if not exists idx_financial_transactions_import_fingerprint
  on public.financial_transactions(user_id, import_fingerprint)
  where import_fingerprint is not null;
create index if not exists idx_financial_transactions_account_due
  on public.financial_transactions(finance_account_id, due_date, status);
create index if not exists idx_finance_transfers_accounts_date
  on public.finance_transfers(from_account_id, to_account_id, transfer_date);
create index if not exists idx_finance_card_invoices_due
  on public.finance_card_invoices(card_account_id, due_date, status);

alter table public.finance_entities enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_transfers enable row level security;
alter table public.finance_card_invoices enable row level security;

drop policy if exists "Users can manage own finance_entities" on public.finance_entities;
create policy "Users can manage own finance_entities" on public.finance_entities for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop policy if exists "Users can manage own finance_accounts" on public.finance_accounts;
create policy "Users can manage own finance_accounts" on public.finance_accounts for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop policy if exists "Users can manage own finance_transfers" on public.finance_transfers;
create policy "Users can manage own finance_transfers" on public.finance_transfers for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop policy if exists "Users can manage own finance_card_invoices" on public.finance_card_invoices;
create policy "Users can manage own finance_card_invoices" on public.finance_card_invoices for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_finance_entities on public.finance_entities;
create trigger set_user_id_finance_entities before insert on public.finance_entities
  for each row execute function public.set_user_id_on_insert();
drop trigger if exists set_user_id_finance_accounts on public.finance_accounts;
create trigger set_user_id_finance_accounts before insert on public.finance_accounts
  for each row execute function public.set_user_id_on_insert();
drop trigger if exists set_user_id_finance_transfers on public.finance_transfers;
create trigger set_user_id_finance_transfers before insert on public.finance_transfers
  for each row execute function public.set_user_id_on_insert();
drop trigger if exists set_user_id_finance_card_invoices on public.finance_card_invoices;
create trigger set_user_id_finance_card_invoices before insert on public.finance_card_invoices
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_finance_entities_updated_at on public.finance_entities;
create trigger update_finance_entities_updated_at before update on public.finance_entities
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_finance_accounts_updated_at on public.finance_accounts;
create trigger update_finance_accounts_updated_at before update on public.finance_accounts
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_finance_transfers_updated_at on public.finance_transfers;
create trigger update_finance_transfers_updated_at before update on public.finance_transfers
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_finance_card_invoices_updated_at on public.finance_card_invoices;
create trigger update_finance_card_invoices_updated_at before update on public.finance_card_invoices
  for each row execute function public.update_updated_at_column();

grant select, insert, update, delete on public.finance_entities to authenticated;
grant select, insert, update, delete on public.finance_accounts to authenticated;
grant select, insert, update, delete on public.finance_transfers to authenticated;
grant select, insert, update, delete on public.finance_card_invoices to authenticated;
