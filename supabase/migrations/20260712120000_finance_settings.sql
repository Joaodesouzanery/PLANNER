-- Camada CFO: config financeira por usuário (imposto, reserva, CDI).
-- Uma linha por usuário. Frontend usa defaults (6% / 6 meses / 0.9%) se a tabela não existir ainda.
create table if not exists public.finance_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  tax_regime text default 'simples',        -- simples | presumido | mei | pf
  tax_rate numeric default 6,               -- % efetivo (Simples ~6% no início)
  reserve_months integer default 6,         -- meses de custo para a reserva de emergência
  cdi_monthly_liquid numeric default 0.9,   -- % ao mês líquido (após IR) para projeção de aportes
  opening_bank_balance numeric,             -- saldo bancário conciliado (âncora), opcional
  updated_at timestamptz default now(),
  unique (user_id)
);

alter table public.finance_settings enable row level security;

create policy "finance_settings own" on public.finance_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
