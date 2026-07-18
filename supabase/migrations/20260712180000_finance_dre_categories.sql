-- DRE: override da linha da DRE por categoria (o resto é heurística). Só correções do usuário.
create table if not exists public.finance_dre_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  category text not null,
  dre_line text not null, -- receita | deducao | custo | despesa_operacional | resultado_financeiro | depreciacao
  updated_at timestamptz default now(),
  unique (user_id, category)
);
alter table public.finance_dre_categories enable row level security;
drop policy if exists "dre_categories own" on public.finance_dre_categories;
create policy "dre_categories own" on public.finance_dre_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
