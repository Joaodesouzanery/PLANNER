-- CRM · Rotina semanal por canal: a semana operacional (Seg=topo, Ter–Qui=contato, Sex=fechar) com cada
-- bloco amarrado a um canal e opcionalmente a um módulo. "Feito nesta semana" = done_week na 2ª-feira atual
-- (reseta sozinho toda semana, sem tabela de log). Padrão do repo: RLS user_id OR owns_company, triggers.
-- Idempotente. Aditiva.

create table if not exists public.crm_rotina_blocos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete cascade, -- o produto
  weekday integer not null default 1,               -- 1=Seg .. 7=Dom
  canal text,
  titulo text not null,
  modulo_id uuid,                                    -- soft ref a crm_modulos; NULL = geral
  order_index integer not null default 0,
  done_week date,                                    -- 2ª-feira da semana em que foi marcado feito
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_rotina_blocos enable row level security;

drop policy if exists "Users can manage own crm_rotina_blocos" on public.crm_rotina_blocos;
create policy "Users can manage own crm_rotina_blocos"
  on public.crm_rotina_blocos for all to authenticated
  using (user_id = auth.uid() or public.owns_company(auth.uid(), company_id))
  with check (user_id = auth.uid() or public.owns_company(auth.uid(), company_id));

drop trigger if exists set_user_id_crm_rotina_blocos on public.crm_rotina_blocos;
create trigger set_user_id_crm_rotina_blocos
  before insert on public.crm_rotina_blocos
  for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_crm_rotina_blocos_updated_at on public.crm_rotina_blocos;
create trigger update_crm_rotina_blocos_updated_at
  before update on public.crm_rotina_blocos
  for each row execute function public.update_updated_at_column();

create index if not exists idx_crm_rotina_blocos_company on public.crm_rotina_blocos (company_id, weekday, order_index);

-- Realtime: garante crm_rotina_blocos na publicação (no-op se FOR ALL TABLES; engole duplicata/inexistente).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = false) then
    begin
      alter publication supabase_realtime add table public.crm_rotina_blocos;
    exception when duplicate_object then null; when undefined_table then null;
    end;
  end if;
end $$;
