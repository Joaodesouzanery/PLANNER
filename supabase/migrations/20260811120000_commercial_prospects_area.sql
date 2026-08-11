-- Prospecção · coluna `area` (construcao | interesse). A "Prospecção de Interesse" (estudo das vagas de IA)
-- reusa o MESMO motor/tabela; a coluna separa as duas listas e o índice de dedup passa a permitir a MESMA
-- vaga uma vez POR ÁREA. Default 'construcao' backfilla todas as linhas existentes (nada quebra). Aditiva/idempotente.

alter table public.commercial_prospects
  add column if not exists area text not null default 'construcao';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'commercial_prospects_area_check') then
    alter table public.commercial_prospects
      add constraint commercial_prospects_area_check check (area in ('construcao', 'interesse'));
  end if;
end $$;

-- Recria o índice único de dedup incluindo `area` — a mesma vaga do LinkedIn pode existir 1× em cada área
-- sem colidir por fingerprint. Mesma expressão do índice original (20260508120000) + a coluna area.
drop index if exists commercial_prospects_unique_job_fingerprint_idx;
create unique index if not exists commercial_prospects_unique_job_fingerprint_idx
on public.commercial_prospects (
  coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
  area,
  job_fingerprint
)
where job_fingerprint is not null;

create index if not exists idx_commercial_prospects_area on public.commercial_prospects (area);
