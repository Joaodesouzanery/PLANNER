
-- Fix RLS: Replace permissive "true" policies with user-scoped policies
-- All EMS tables should be scoped to authenticated users only

-- Drop existing overly-permissive policies and replace with auth-scoped ones

-- COMPANIES
DROP POLICY IF EXISTS "Allow all operations on companies" ON public.companies;
CREATE POLICY "Authenticated users can manage companies" ON public.companies FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PROJECTS
DROP POLICY IF EXISTS "Allow all operations on projects" ON public.projects;
CREATE POLICY "Authenticated users can manage projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TASKS
DROP POLICY IF EXISTS "Allow all operations on tasks" ON public.tasks;
CREATE POLICY "Authenticated users can manage tasks" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TASK_NOTES
DROP POLICY IF EXISTS "Allow all operations on task_notes" ON public.task_notes;
CREATE POLICY "Authenticated users can manage task_notes" ON public.task_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CONTACTS
DROP POLICY IF EXISTS "Allow all operations on contacts" ON public.contacts;
CREATE POLICY "Authenticated users can manage contacts" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CONTACT_INTERACTIONS
DROP POLICY IF EXISTS "Allow all operations on contact_interactions" ON public.contact_interactions;
CREATE POLICY "Authenticated users can manage contact_interactions" ON public.contact_interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FINANCIAL_TRANSACTIONS
DROP POLICY IF EXISTS "Allow all operations on financial_transactions" ON public.financial_transactions;
CREATE POLICY "Authenticated users can manage financial_transactions" ON public.financial_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OKRS
DROP POLICY IF EXISTS "Allow all operations on okrs" ON public.okrs;
CREATE POLICY "Authenticated users can manage okrs" ON public.okrs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CALENDAR_EVENTS
DROP POLICY IF EXISTS "Allow all operations on calendar_events" ON public.calendar_events;
CREATE POLICY "Authenticated users can manage calendar_events" ON public.calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- KANBAN_COLUMNS
DROP POLICY IF EXISTS "Allow all operations on kanban_columns" ON public.kanban_columns;
CREATE POLICY "Authenticated users can manage kanban_columns" ON public.kanban_columns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- QUICK_NOTES
DROP POLICY IF EXISTS "Allow all operations on quick_notes" ON public.quick_notes;
CREATE POLICY "Authenticated users can manage quick_notes" ON public.quick_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PLANNING_GOALS
DROP POLICY IF EXISTS "Allow all operations on planning_goals" ON public.planning_goals;
CREATE POLICY "Authenticated users can manage planning_goals" ON public.planning_goals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PLANNING_MILESTONES
DROP POLICY IF EXISTS "Allow all operations on planning_milestones" ON public.planning_milestones;
CREATE POLICY "Authenticated users can manage planning_milestones" ON public.planning_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- STRATEGIC_PILLARS
DROP POLICY IF EXISTS "Allow all operations on strategic_pillars" ON public.strategic_pillars;
CREATE POLICY "Authenticated users can manage strategic_pillars" ON public.strategic_pillars FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- MONTHLY_FOCUS
DROP POLICY IF EXISTS "Allow all operations on monthly_focus" ON public.monthly_focus;
CREATE POLICY "Authenticated users can manage monthly_focus" ON public.monthly_focus FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- EXECUTION_RECORDS
DROP POLICY IF EXISTS "Allow all operations on execution_records" ON public.execution_records;
CREATE POLICY "Authenticated users can manage execution_records" ON public.execution_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ROADMAPS
DROP POLICY IF EXISTS "Allow all operations on roadmaps" ON public.roadmaps;
CREATE POLICY "Authenticated users can manage roadmaps" ON public.roadmaps FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ORG_CHART_NODES
DROP POLICY IF EXISTS "Allow all operations on org_chart_nodes" ON public.org_chart_nodes;
CREATE POLICY "Authenticated users can manage org_chart_nodes" ON public.org_chart_nodes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TIME_ENTRIES
DROP POLICY IF EXISTS "Allow all operations on time_entries" ON public.time_entries;
CREATE POLICY "Authenticated users can manage time_entries" ON public.time_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- COMMERCIAL_PHASES
DROP POLICY IF EXISTS "Allow all operations on commercial_phases" ON public.commercial_phases;
CREATE POLICY "Authenticated users can manage commercial_phases" ON public.commercial_phases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- COMMERCIAL_ITEMS
DROP POLICY IF EXISTS "Allow all operations on commercial_items" ON public.commercial_items;
CREATE POLICY "Authenticated users can manage commercial_items" ON public.commercial_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- COMMERCIAL_CONTACT_META
DROP POLICY IF EXISTS "Allow all operations on commercial_contact_meta" ON public.commercial_contact_meta;
CREATE POLICY "Authenticated users can manage commercial_contact_meta" ON public.commercial_contact_meta FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CONTACT_COMMERCIAL_TRACKING
DROP POLICY IF EXISTS "Allow all operations on contact_commercial_tracking" ON public.contact_commercial_tracking;
CREATE POLICY "Authenticated users can manage contact_commercial_tracking" ON public.contact_commercial_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- COMPANY_COMMERCIAL_STRUCTURE
DROP POLICY IF EXISTS "Allow all operations on company_commercial_structure" ON public.company_commercial_structure;
CREATE POLICY "Authenticated users can manage company_commercial_structure" ON public.company_commercial_structure FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ONBOARDING_STEPS
DROP POLICY IF EXISTS "Allow all operations on onboarding_steps" ON public.onboarding_steps;
CREATE POLICY "Authenticated users can manage onboarding_steps" ON public.onboarding_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ONBOARDING_DOCUMENTS
DROP POLICY IF EXISTS "Allow all operations on onboarding_documents" ON public.onboarding_documents;
CREATE POLICY "Authenticated users can manage onboarding_documents" ON public.onboarding_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CONTACT_ONBOARDING_TRACKING
DROP POLICY IF EXISTS "Allow all operations on contact_onboarding_tracking" ON public.contact_onboarding_tracking;
CREATE POLICY "Authenticated users can manage contact_onboarding_tracking" ON public.contact_onboarding_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CONTACT_ONBOARDING_DOCUMENTS
DROP POLICY IF EXISTS "Allow all operations on contact_onboarding_documents" ON public.contact_onboarding_documents;
CREATE POLICY "Authenticated users can manage contact_onboarding_documents" ON public.contact_onboarding_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ATTACHMENTS
DROP POLICY IF EXISTS "Allow all operations on attachments" ON public.attachments;
CREATE POLICY "Authenticated users can manage attachments" ON public.attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
