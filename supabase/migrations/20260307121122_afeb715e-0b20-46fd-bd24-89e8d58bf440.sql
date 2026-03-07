
CREATE TABLE public.commercial_contact_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tags text[] DEFAULT '{}',
  priority text DEFAULT 'medium',
  temperature text DEFAULT 'warm',
  next_action_date date,
  next_action_description text,
  last_contact_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contact_id)
);

ALTER TABLE public.commercial_contact_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on commercial_contact_meta"
  ON public.commercial_contact_meta
  FOR ALL
  USING (true)
  WITH CHECK (true);
