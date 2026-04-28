-- Project invoice scheduling
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS next_invoice_date date,
  ADD COLUMN IF NOT EXISTS invoice_alert_days integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS invoice_notes text;

-- Visit route planner
CREATE TABLE IF NOT EXISTS public.visit_route_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  address text,
  latitude numeric,
  longitude numeric,
  status text NOT NULL DEFAULT 'prospect',
  priority text NOT NULL DEFAULT 'medium',
  notes text,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid
);

ALTER TABLE public.visit_route_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on visit_route_companies"
  ON public.visit_route_companies
  FOR ALL
  USING (true)
  WITH CHECK (true);
