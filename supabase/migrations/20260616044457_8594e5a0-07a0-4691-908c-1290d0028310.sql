
-- 1) Weekly tasks + priority ordering
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_weekly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS week_start date,
  ADD COLUMN IF NOT EXISTS priority_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tasks_weekly ON public.tasks(is_weekly, week_start);

-- 2) Travel module

-- Travel profile (one row per user/company combination)
CREATE TABLE IF NOT EXISTS public.finance_travel_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  monthly_salary numeric NOT NULL DEFAULT 0,
  variable_income numeric NOT NULL DEFAULT 0,
  other_income numeric NOT NULL DEFAULT 0,
  housing numeric NOT NULL DEFAULT 0,
  food numeric NOT NULL DEFAULT 0,
  transport numeric NOT NULL DEFAULT 0,
  subscriptions numeric NOT NULL DEFAULT 0,
  debts numeric NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_travel_profile TO authenticated;
GRANT ALL ON public.finance_travel_profile TO service_role;

ALTER TABLE public.finance_travel_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_profile_access" ON public.finance_travel_profile
  FOR ALL TO authenticated
  USING (public.user_can_access(user_id, company_id))
  WITH CHECK (public.user_can_access(user_id, company_id));

CREATE TRIGGER set_user_id_travel_profile
  BEFORE INSERT ON public.finance_travel_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

CREATE TRIGGER updated_at_travel_profile
  BEFORE UPDATE ON public.finance_travel_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trips
CREATE TABLE IF NOT EXISTS public.finance_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  destination text,
  start_date date,
  end_date date,
  adults integer NOT NULL DEFAULT 1,
  children integer NOT NULL DEFAULT 0,
  profile text NOT NULL DEFAULT 'standard',
  is_international boolean NOT NULL DEFAULT false,
  exchange_rate numeric,
  emergency_pct numeric NOT NULL DEFAULT 15,
  notes text,
  status text NOT NULL DEFAULT 'planning',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_trips TO authenticated;
GRANT ALL ON public.finance_trips TO service_role;

ALTER TABLE public.finance_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trips_access" ON public.finance_trips
  FOR ALL TO authenticated
  USING (public.user_can_access(user_id, company_id))
  WITH CHECK (public.user_can_access(user_id, company_id));

CREATE TRIGGER set_user_id_trips
  BEFORE INSERT ON public.finance_trips
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

CREATE TRIGGER updated_at_trips
  BEFORE UPDATE ON public.finance_trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trip category items
CREATE TABLE IF NOT EXISTS public.finance_trip_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.finance_trips(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  is_per_person boolean NOT NULL DEFAULT false,
  multiply_by_nights boolean NOT NULL DEFAULT false,
  limit_pct numeric,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_trip_categories TO authenticated;
GRANT ALL ON public.finance_trip_categories TO service_role;

ALTER TABLE public.finance_trip_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_categories_access" ON public.finance_trip_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.finance_trips t
      WHERE t.id = trip_id AND public.user_can_access(t.user_id, t.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.finance_trips t
      WHERE t.id = trip_id AND public.user_can_access(t.user_id, t.company_id)
    )
  );

CREATE TRIGGER set_user_id_trip_categories
  BEFORE INSERT ON public.finance_trip_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

CREATE TRIGGER updated_at_trip_categories
  BEFORE UPDATE ON public.finance_trip_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
