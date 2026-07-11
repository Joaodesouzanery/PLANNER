-- CFO v2 · Fase 1: receita por cliente + concentração.
create table if not exists public.finance_clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nome text not null,
  recorrente boolean not null default true,
  updated_at timestamptz default now(),
  unique (user_id, nome)
);
alter table public.finance_clientes enable row level security;
create policy "clientes own" on public.finance_clientes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.financial_transactions add column if not exists cliente_id uuid references public.finance_clientes(id) on delete set null;

-- Seed best-effort: cria clientes a partir dos nomes conhecidos das ENTRADAS e marca as transações.
insert into public.finance_clientes (user_id, nome, recorrente)
select distinct t.user_id, x.nome, x.recorrente
from (values ('CONAB', true), ('RAONI', true), ('IRIS', true), ('CIRCLE', true), ('Compizzo', false)) as x(nome, recorrente)
join public.financial_transactions t
  on t.type = 'income' and t.description ilike '%' || x.nome || '%'
on conflict (user_id, nome) do nothing;

update public.financial_transactions t
set cliente_id = c.id
from public.finance_clientes c
where t.type = 'income' and t.cliente_id is null
  and c.user_id = t.user_id and t.description ilike '%' || c.nome || '%';
