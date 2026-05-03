-- Add set_user_id_on_insert triggers to all tables with user_id
DO $$
DECLARE
  t text;
  user_id_tables text[] := ARRAY[
    'agile_implementation_steps','ai_generations','calendar_events',
    'commercial_phases','commercial_structure_items','conference_items',
    'conference_stages','contacts','execution_records','financial_transactions',
    'kanban_columns','monthly_focus','okrs','onboarding_steps','org_chart_nodes',
    'planning_goals','projects','quick_notes','roadmaps','strategic_pillars',
    'tasks','time_entries'
  ];
  updated_at_tables text[] := ARRAY[
    'agile_implementation_steps','commercial_contact_meta','commercial_structure_items',
    'company_commercial_structure','conference_items','conference_stages',
    'contact_commercial_tracking','contact_onboarding_documents','contact_onboarding_tracking',
    'contacts','okrs','org_chart_nodes','planning_goals','projects','quick_notes',
    'roadmaps','tasks','time_entries'
  ];
BEGIN
  FOREACH t IN ARRAY user_id_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_user_id_trigger ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_user_id_trigger BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert()', t);
  END LOOP;

  FOREACH t IN ARRAY updated_at_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_updated_at_trigger ON public.%I', t);
    EXECUTE format('CREATE TRIGGER update_updated_at_trigger BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;

  -- Special: attachments uses uploaded_by
  DROP TRIGGER IF EXISTS set_uploaded_by_trigger ON public.attachments;
  CREATE TRIGGER set_uploaded_by_trigger BEFORE INSERT ON public.attachments
    FOR EACH ROW EXECUTE FUNCTION public.set_uploaded_by_on_insert();

  -- First user admin trigger
  DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
  CREATE TRIGGER on_auth_user_created_admin AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_first_user_admin();
END $$;