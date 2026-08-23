-- Importação da planilha financeira: registro do LOTE, para histórico e para desfazer.
--
-- A planilha (.xlsx) passa a ser a fonte da verdade das Transações. Cada importação é um SYNC
-- (cria/atualiza/remove), não um append — então precisamos guardar o que foi feito para poder
-- voltar atrás sem depender de o usuário lembrar o que mudou.
--
-- `desfazer` guarda o estado ANTERIOR de tudo que o lote tocou:
--   { criados: [id...], atualizados: [{id, antes:{...campos}}...], removidos: [{...linha inteira}] }
-- Desfazer = apagar os criados, restaurar os campos dos atualizados e reinserir os removidos.
-- Aditiva e idempotente.

create table if not exists public.finance_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  origem text not null default 'planilha',
  arquivo text,
  -- Janela (em meses inteiros) que o arquivo cobre: só aí a planilha manda.
  janela_inicio date,
  janela_fim date,
  criados integer not null default 0,
  atualizados integer not null default 0,
  removidos integer not null default 0,
  inalterados integer not null default 0,
  -- Resultado da conferência contra os totais que a própria planilha declara.
  conferencia jsonb,
  avisos jsonb not null default '[]'::jsonb,
  desfazer jsonb,
  desfeito_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_import_batches enable row level security;

drop policy if exists "Users can manage own finance_import_batches" on public.finance_import_batches;
create policy "Users can manage own finance_import_batches"
  on public.finance_import_batches for all to authenticated
  using (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id))
  with check (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id));

drop trigger if exists set_user_id_finance_import_batches on public.finance_import_batches;
create trigger set_user_id_finance_import_batches before insert on public.finance_import_batches for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_finance_import_batches_updated_at on public.finance_import_batches;
create trigger update_finance_import_batches_updated_at before update on public.finance_import_batches for each row execute function public.update_updated_at_column();

create index if not exists idx_finance_import_batches_user_created
  on public.finance_import_batches (user_id, created_at desc);

-- O sync procura as linhas da planilha por (source_type, import_fingerprint). Sem este índice,
-- toda importação viraria um seq scan em financial_transactions.
create index if not exists idx_financial_transactions_source_type
  on public.financial_transactions (user_id, source_type)
  where source_type is not null;
