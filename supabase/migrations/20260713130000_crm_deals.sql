-- CRM · Fase 2: project_opportunities vira o deal do CRM (ligado a cliente + contato + desfecho).
alter table public.project_opportunities add column if not exists status_outcome text; -- won | lost | null (aberto)
alter table public.project_opportunities add column if not exists close_reason text;
alter table public.project_opportunities add column if not exists contact_id uuid references public.contacts(id) on delete set null;
