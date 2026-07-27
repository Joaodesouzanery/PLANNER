-- CRM · Realtime: garante que as tabelas do kanban estão na publicação supabase_realtime, pra os
-- postgres_changes dispararem (useCrmRealtime). Idempotente e seguro: só age se a publicação for de
-- tabelas específicas (puballtables=false); se for FOR ALL TABLES, já cobre tudo e vira no-op. Duplicatas
-- são engolidas. Não falha se a publicação não existir.

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = false) then
    foreach t in array array['project_opportunities', 'contacts', 'finance_clientes', 'crm_stages', 'crm_stage_events'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception
        when duplicate_object then null; -- já está na publicação
        when undefined_table then null;  -- tabela ainda não existe neste ambiente
      end;
    end loop;
  end if;
end $$;
