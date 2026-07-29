-- Rotinas ↔ CRM: liga (opcionalmente) um item de rotina a um módulo do CRM ou a um cliente.
-- Ex.: "analisar posts da semana" → módulo Conteúdo; "relatórios pra clientes" → cliente. As demais
-- rotinas seguem sem link (só aparecem em Rotinas). Soft (sem FK), degrada gracioso. Aditiva/idempotente.

alter table public.routine_checklist_items add column if not exists modulo_id uuid;
alter table public.routine_checklist_items add column if not exists customer_id uuid;
create index if not exists idx_routine_checklist_items_modulo on public.routine_checklist_items (modulo_id);
