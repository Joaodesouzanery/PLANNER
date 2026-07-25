-- CRM · Fase 1: finance_clientes vira o SPINE do cliente (cadastro central), ancorado na receita.
-- Contatos (pessoas), rotinas e deals passam a apontar pra ele. Idempotente.

-- 1. Campos CRM no cadastro central.
alter table public.finance_clientes add column if not exists stage text default 'active';         -- new|onboarding|active|expansion|risk|recovery (alinhado ao ClientRelationshipKanban)
alter table public.finance_clientes add column if not exists health text default 'green';          -- green|yellow|red
alter table public.finance_clientes add column if not exists priority text default 'medium';       -- low|medium|high
alter table public.finance_clientes add column if not exists next_action_date date;
alter table public.finance_clientes add column if not exists next_action_desc text;
alter table public.finance_clientes add column if not exists segment text;
alter table public.finance_clientes add column if not exists tier text;                             -- ex.: A/B/C
alter table public.finance_clientes add column if not exists owner text;
alter table public.finance_clientes add column if not exists notes text;

-- 2. Ligações dos satélites ao spine.
alter table public.contacts add column if not exists customer_id uuid references public.finance_clientes(id) on delete set null;
alter table public.routine_clients add column if not exists customer_id uuid references public.finance_clientes(id) on delete set null;
alter table public.project_opportunities add column if not exists customer_id uuid references public.finance_clientes(id) on delete set null;

-- 3. Seed best-effort: casa por nome (contatos e rotinas) com o cadastro central.
update public.contacts c set customer_id = fc.id
from public.finance_clientes fc
where c.customer_id is null and fc.user_id = c.user_id
  and (c.company ilike '%' || fc.nome || '%' or c.name ilike '%' || fc.nome || '%');

update public.routine_clients rc set customer_id = fc.id
from public.finance_clientes fc
where rc.customer_id is null and fc.user_id = rc.user_id
  and rc.name ilike '%' || fc.nome || '%';

create index if not exists idx_contacts_customer on public.contacts (customer_id);
create index if not exists idx_routine_clients_customer on public.routine_clients (customer_id);
create index if not exists idx_project_opportunities_customer on public.project_opportunities (customer_id);
