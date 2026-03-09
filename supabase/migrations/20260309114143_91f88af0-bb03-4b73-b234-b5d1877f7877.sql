
-- Auto-set user_id on INSERT for all tables that have user_id column
CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger to all tables with user_id
CREATE TRIGGER set_user_id_companies BEFORE INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_projects BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_tasks BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_contacts BEFORE INSERT ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_financial_transactions BEFORE INSERT ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_okrs BEFORE INSERT ON public.okrs FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_planning_goals BEFORE INSERT ON public.planning_goals FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_calendar_events BEFORE INSERT ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_time_entries BEFORE INSERT ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_quick_notes BEFORE INSERT ON public.quick_notes FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_execution_records BEFORE INSERT ON public.execution_records FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_roadmaps BEFORE INSERT ON public.roadmaps FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_strategic_pillars BEFORE INSERT ON public.strategic_pillars FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_monthly_focus BEFORE INSERT ON public.monthly_focus FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_kanban_columns BEFORE INSERT ON public.kanban_columns FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_org_chart_nodes BEFORE INSERT ON public.org_chart_nodes FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_commercial_phases BEFORE INSERT ON public.commercial_phases FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
CREATE TRIGGER set_user_id_onboarding_steps BEFORE INSERT ON public.onboarding_steps FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

-- Also set uploaded_by for attachments
CREATE OR REPLACE FUNCTION public.set_uploaded_by_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.uploaded_by IS NULL THEN
    NEW.uploaded_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_uploaded_by_attachments BEFORE INSERT ON public.attachments FOR EACH ROW EXECUTE FUNCTION public.set_uploaded_by_on_insert();

-- Backfill existing data: set user_id to the first admin user for orphaned records
-- This ensures existing data isn't locked out
DO $$
DECLARE
  admin_uid uuid;
BEGIN
  SELECT user_id INTO admin_uid FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_uid IS NOT NULL THEN
    UPDATE public.companies SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.projects SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.tasks SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.contacts SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.financial_transactions SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.okrs SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.planning_goals SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.calendar_events SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.time_entries SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.quick_notes SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.execution_records SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.roadmaps SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.strategic_pillars SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.monthly_focus SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.kanban_columns SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.org_chart_nodes SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.commercial_phases SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.onboarding_steps SET user_id = admin_uid WHERE user_id IS NULL;
    UPDATE public.attachments SET uploaded_by = admin_uid WHERE uploaded_by IS NULL;
  END IF;
END;
$$;
