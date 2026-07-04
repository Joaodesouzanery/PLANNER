-- Rotinas como guia do mês: recorrência (diária/semanal/mensal) + subtarefas/subobrigações.
-- Itens existentes ficam frequency='daily' -> comportamento antigo preservado.
alter table public.routine_checklist_items
  add column if not exists frequency text default 'daily',   -- 'daily' | 'weekly' | 'monthly'
  add column if not exists day_of_month int,                 -- 1..31 (mensal)
  add column if not exists weekday int,                      -- 0=dom .. 6=sáb (semanal)
  add column if not exists parent_item_id uuid references public.routine_checklist_items(id) on delete cascade;

alter table public.routine_tasks
  add column if not exists parent_task_id uuid references public.routine_tasks(id) on delete cascade;
