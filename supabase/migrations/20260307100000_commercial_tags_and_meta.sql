-- Commercial Contact Metadata: tags, priority, next action, last contact date

CREATE TABLE IF NOT EXISTS public.commercial_contact_meta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  priority TEXT NOT NULL DEFAULT 'medium',
  next_action_date DATE,
  next_action_description TEXT,
  last_contact_date DATE,
  temperature TEXT NOT NULL DEFAULT 'warm',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id)
);

ALTER TABLE public.commercial_contact_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on commercial_contact_meta" ON public.commercial_contact_meta FOR ALL USING (true) WITH CHECK (true);
