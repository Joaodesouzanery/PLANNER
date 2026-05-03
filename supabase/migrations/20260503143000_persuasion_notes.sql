create table if not exists public.persuasion_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  category text default 'principio',
  principle text,
  content text,
  example text,
  source text,
  tags text[] default '{}',
  confidence text default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.persuasion_notes enable row level security;

drop policy if exists "Users can manage own persuasion_notes" on public.persuasion_notes;
create policy "Users can manage own persuasion_notes"
  on public.persuasion_notes for all to authenticated
  using (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id))
  with check (user_id = (select auth.uid()) or public.owns_company((select auth.uid()), company_id));

drop trigger if exists set_user_id_persuasion_notes on public.persuasion_notes;
create trigger set_user_id_persuasion_notes before insert on public.persuasion_notes for each row execute function public.set_user_id_on_insert();

drop trigger if exists update_persuasion_notes_updated_at on public.persuasion_notes;
create trigger update_persuasion_notes_updated_at before update on public.persuasion_notes for each row execute function public.update_updated_at_column();

create index if not exists idx_persuasion_notes_company_updated on public.persuasion_notes(company_id, updated_at desc);
create index if not exists idx_persuasion_notes_category on public.persuasion_notes(company_id, category);
create index if not exists idx_persuasion_notes_tags on public.persuasion_notes using gin(tags);

grant select, insert, update, delete on public.persuasion_notes to authenticated;
