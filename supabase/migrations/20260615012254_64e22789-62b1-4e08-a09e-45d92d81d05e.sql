ALTER TABLE public.finance_plan_items
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS goal_kind text NOT NULL DEFAULT 'standard';

ALTER TABLE public.finance_plan_items DROP CONSTRAINT IF EXISTS finance_plan_items_goal_kind_check;
ALTER TABLE public.finance_plan_items
  ADD CONSTRAINT finance_plan_items_goal_kind_check
  CHECK (goal_kind IN ('standard', 'savings'));