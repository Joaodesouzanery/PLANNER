
ALTER TABLE public.planning_goals
  ADD COLUMN IF NOT EXISTS okr_id uuid,
  ADD COLUMN IF NOT EXISTS project_id uuid;

CREATE INDEX IF NOT EXISTS idx_planning_goals_okr ON public.planning_goals(okr_id);
CREATE INDEX IF NOT EXISTS idx_planning_goals_project ON public.planning_goals(project_id);
