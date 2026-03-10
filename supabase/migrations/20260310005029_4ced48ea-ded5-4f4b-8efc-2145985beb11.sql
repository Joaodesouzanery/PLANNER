DO $$
DECLARE
  uid uuid := 'e1907c73-5172-46d4-a1ae-e7c15b2c3311';
BEGIN
  UPDATE tasks SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE contacts SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE projects SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE financial_transactions SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE companies SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE calendar_events SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE quick_notes SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE execution_records SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE okrs SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE planning_goals SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE strategic_pillars SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE monthly_focus SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE kanban_columns SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE org_chart_nodes SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE roadmaps SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE time_entries SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE commercial_phases SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
  UPDATE onboarding_steps SET user_id = uid WHERE user_id IS NULL OR user_id != uid;
END $$;