
-- Helper: check if user owns a company
CREATE OR REPLACE FUNCTION public.owns_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND user_id = _user_id
  )
$$;

-- Helper: check if user owns resource (by user_id) or owns the company
CREATE OR REPLACE FUNCTION public.user_can_access(_resource_user_id uuid, _resource_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    _resource_user_id = auth.uid()
    OR public.owns_company(auth.uid(), _resource_company_id)
  )
$$;

-- ============ COMPANIES ============
DROP POLICY IF EXISTS "Authenticated users can manage companies" ON public.companies;
CREATE POLICY "Users can manage own companies" ON public.companies
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============ PROJECTS ============
DROP POLICY IF EXISTS "Authenticated users can manage projects" ON public.projects;
CREATE POLICY "Users can manage own projects" ON public.projects
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ TASKS ============
DROP POLICY IF EXISTS "Authenticated users can manage tasks" ON public.tasks;
CREATE POLICY "Users can manage own tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ CONTACTS ============
DROP POLICY IF EXISTS "Authenticated users can manage contacts" ON public.contacts;
CREATE POLICY "Users can manage own contacts" ON public.contacts
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ FINANCIAL_TRANSACTIONS ============
DROP POLICY IF EXISTS "Authenticated users can manage financial_transactions" ON public.financial_transactions;
CREATE POLICY "Users can manage own financial_transactions" ON public.financial_transactions
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ OKRS ============
DROP POLICY IF EXISTS "Authenticated users can manage okrs" ON public.okrs;
CREATE POLICY "Users can manage own okrs" ON public.okrs
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ PLANNING_GOALS ============
DROP POLICY IF EXISTS "Authenticated users can manage planning_goals" ON public.planning_goals;
CREATE POLICY "Users can manage own planning_goals" ON public.planning_goals
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ PLANNING_MILESTONES ============
DROP POLICY IF EXISTS "Authenticated users can manage planning_milestones" ON public.planning_milestones;
CREATE POLICY "Users can manage own planning_milestones" ON public.planning_milestones
  FOR ALL TO authenticated
  USING (public.owns_company(auth.uid(), company_id))
  WITH CHECK (public.owns_company(auth.uid(), company_id));

-- ============ CALENDAR_EVENTS ============
DROP POLICY IF EXISTS "Authenticated users can manage calendar_events" ON public.calendar_events;
CREATE POLICY "Users can manage own calendar_events" ON public.calendar_events
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ TIME_ENTRIES ============
DROP POLICY IF EXISTS "Authenticated users can manage time_entries" ON public.time_entries;
CREATE POLICY "Users can manage own time_entries" ON public.time_entries
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ QUICK_NOTES ============
DROP POLICY IF EXISTS "Authenticated users can manage quick_notes" ON public.quick_notes;
CREATE POLICY "Users can manage own quick_notes" ON public.quick_notes
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ EXECUTION_RECORDS ============
DROP POLICY IF EXISTS "Authenticated users can manage execution_records" ON public.execution_records;
CREATE POLICY "Users can manage own execution_records" ON public.execution_records
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ ROADMAPS ============
DROP POLICY IF EXISTS "Authenticated users can manage roadmaps" ON public.roadmaps;
CREATE POLICY "Users can manage own roadmaps" ON public.roadmaps
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ STRATEGIC_PILLARS ============
DROP POLICY IF EXISTS "Authenticated users can manage strategic_pillars" ON public.strategic_pillars;
CREATE POLICY "Users can manage own strategic_pillars" ON public.strategic_pillars
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ MONTHLY_FOCUS ============
DROP POLICY IF EXISTS "Authenticated users can manage monthly_focus" ON public.monthly_focus;
CREATE POLICY "Users can manage own monthly_focus" ON public.monthly_focus
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ KANBAN_COLUMNS ============
DROP POLICY IF EXISTS "Authenticated users can manage kanban_columns" ON public.kanban_columns;
CREATE POLICY "Users can manage own kanban_columns" ON public.kanban_columns
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ ORG_CHART_NODES ============
DROP POLICY IF EXISTS "Authenticated users can manage org_chart_nodes" ON public.org_chart_nodes;
CREATE POLICY "Users can manage own org_chart_nodes" ON public.org_chart_nodes
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ COMMERCIAL_PHASES ============
DROP POLICY IF EXISTS "Authenticated users can manage commercial_phases" ON public.commercial_phases;
CREATE POLICY "Users can manage own commercial_phases" ON public.commercial_phases
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ COMMERCIAL_ITEMS ============
DROP POLICY IF EXISTS "Authenticated users can manage commercial_items" ON public.commercial_items;
CREATE POLICY "Users can manage own commercial_items" ON public.commercial_items
  FOR ALL TO authenticated
  USING (public.owns_company(auth.uid(), company_id))
  WITH CHECK (public.owns_company(auth.uid(), company_id));

-- ============ ONBOARDING_STEPS ============
DROP POLICY IF EXISTS "Authenticated users can manage onboarding_steps" ON public.onboarding_steps;
CREATE POLICY "Users can manage own onboarding_steps" ON public.onboarding_steps
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ ATTACHMENTS ============
DROP POLICY IF EXISTS "Authenticated users can manage attachments" ON public.attachments;
CREATE POLICY "Users can manage own attachments" ON public.attachments
  FOR ALL TO authenticated
  USING (uploaded_by = auth.uid() OR public.owns_company(auth.uid(), company_id))
  WITH CHECK (uploaded_by = auth.uid() OR public.owns_company(auth.uid(), company_id));

-- ============ COMPANY_COMMERCIAL_STRUCTURE ============
DROP POLICY IF EXISTS "Authenticated users can manage company_commercial_structure" ON public.company_commercial_structure;
CREATE POLICY "Users can manage own company_commercial_structure" ON public.company_commercial_structure
  FOR ALL TO authenticated
  USING (public.owns_company(auth.uid(), company_id))
  WITH CHECK (public.owns_company(auth.uid(), company_id));

-- ============ TABLES WITHOUT user_id: use company ownership ============

-- CONTACT_COMMERCIAL_TRACKING
DROP POLICY IF EXISTS "Authenticated users can manage contact_commercial_tracking" ON public.contact_commercial_tracking;
CREATE POLICY "Users can manage own contact_commercial_tracking" ON public.contact_commercial_tracking
  FOR ALL TO authenticated
  USING (public.owns_company(auth.uid(), company_id))
  WITH CHECK (public.owns_company(auth.uid(), company_id));

-- CONTACT_INTERACTIONS (no company_id, link through contact)
DROP POLICY IF EXISTS "Authenticated users can manage contact_interactions" ON public.contact_interactions;
CREATE POLICY "Users can manage own contact_interactions" ON public.contact_interactions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND (c.user_id = auth.uid() OR public.owns_company(auth.uid(), c.company_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND (c.user_id = auth.uid() OR public.owns_company(auth.uid(), c.company_id))
  ));

-- TASK_NOTES (no company_id, link through task)
DROP POLICY IF EXISTS "Authenticated users can manage task_notes" ON public.task_notes;
CREATE POLICY "Users can manage own task_notes" ON public.task_notes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (t.user_id = auth.uid() OR public.owns_company(auth.uid(), t.company_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (t.user_id = auth.uid() OR public.owns_company(auth.uid(), t.company_id))
  ));

-- COMMERCIAL_CONTACT_META (no company_id, link through contact)
DROP POLICY IF EXISTS "Authenticated users can manage commercial_contact_meta" ON public.commercial_contact_meta;
CREATE POLICY "Users can manage own commercial_contact_meta" ON public.commercial_contact_meta
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND (c.user_id = auth.uid() OR public.owns_company(auth.uid(), c.company_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND (c.user_id = auth.uid() OR public.owns_company(auth.uid(), c.company_id))
  ));

-- CONTACT_ONBOARDING_TRACKING (no company_id, link through contact)
DROP POLICY IF EXISTS "Authenticated users can manage contact_onboarding_tracking" ON public.contact_onboarding_tracking;
CREATE POLICY "Users can manage own contact_onboarding_tracking" ON public.contact_onboarding_tracking
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND (c.user_id = auth.uid() OR public.owns_company(auth.uid(), c.company_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND (c.user_id = auth.uid() OR public.owns_company(auth.uid(), c.company_id))
  ));

-- CONTACT_ONBOARDING_DOCUMENTS (no company_id, link through contact)
DROP POLICY IF EXISTS "Authenticated users can manage contact_onboarding_documents" ON public.contact_onboarding_documents;
CREATE POLICY "Users can manage own contact_onboarding_documents" ON public.contact_onboarding_documents
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND (c.user_id = auth.uid() OR public.owns_company(auth.uid(), c.company_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND (c.user_id = auth.uid() OR public.owns_company(auth.uid(), c.company_id))
  ));

-- ONBOARDING_DOCUMENTS (no user_id/company_id, link through step)
DROP POLICY IF EXISTS "Authenticated users can manage onboarding_documents" ON public.onboarding_documents;
CREATE POLICY "Users can manage own onboarding_documents" ON public.onboarding_documents
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.onboarding_steps s WHERE s.id = step_id AND (s.user_id = auth.uid() OR public.owns_company(auth.uid(), s.company_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.onboarding_steps s WHERE s.id = step_id AND (s.user_id = auth.uid() OR public.owns_company(auth.uid(), s.company_id))
  ));
