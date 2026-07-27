-- Conselho · Central de Atenção: estado persistido por item (antes era só localStorage efêmero).
-- Marcações resolvido/adiado/ignorado + soneca (snooze). Padrão do repo: RLS user_id OR owns_company,
-- trigger set_user_id_on_insert + update_updated_at_column. Idempotente. Aditiva.

create table if not exists public.board_attention_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  item_key text not null,                 -- id determinístico do item (ex.: 'obr:<uuid>', 'fin:<key>', 'cli:<uuid>')
  state text not null default 'open',     -- open | resolved | deferred | ignored
  snooze_until date,                      -- se no futuro, o item some da fila até essa data
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.board_attention_state enable row level security;

drop policy if exists "Users can manage own board_attention_state" on public.board_attention_state;
create policy "Users can manage own board_attention_state"
  on public.board_attention_state for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_board_attention_state on public.board_attention_state;
create trigger set_user_id_board_attention_state
  before insert on public.board_attention_state
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_board_attention_state_updated_at on public.board_attention_state;
create trigger update_board_attention_state_updated_at
  before update on public.board_attention_state
  for each row execute function public.update_updated_at_column();

-- Um estado por (usuário, empresa, item). company_id NULL usa um sentinela para não duplicar —
-- itens de fontes company-scoped (ex.: alertas financeiros de key estática) ficam isolados por empresa.
create unique index if not exists idx_board_attention_state_key
  on public.board_attention_state (user_id, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), item_key);
create index if not exists idx_board_attention_state_company
  on public.board_attention_state (company_id, state);
