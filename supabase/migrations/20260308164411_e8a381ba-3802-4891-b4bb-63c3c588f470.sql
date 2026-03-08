
-- Onboarding steps
CREATE TABLE public.onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'file-text',
  order_index integer NOT NULL DEFAULT 0,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on onboarding_steps" ON public.onboarding_steps FOR ALL USING (true) WITH CHECK (true);

-- Onboarding documents
CREATE TABLE public.onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL REFERENCES public.onboarding_steps(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  document_url text,
  template_url text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on onboarding_documents" ON public.onboarding_documents FOR ALL USING (true) WITH CHECK (true);

-- Contact onboarding tracking (step progress per contact)
CREATE TABLE public.contact_onboarding_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.onboarding_steps(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contact_id, step_id)
);
ALTER TABLE public.contact_onboarding_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on contact_onboarding_tracking" ON public.contact_onboarding_tracking FOR ALL USING (true) WITH CHECK (true);

-- Contact onboarding documents (document status per contact)
CREATE TABLE public.contact_onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.onboarding_documents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_sent',
  sent_at timestamptz,
  received_at timestamptz,
  signed_at timestamptz,
  file_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contact_id, document_id)
);
ALTER TABLE public.contact_onboarding_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on contact_onboarding_documents" ON public.contact_onboarding_documents FOR ALL USING (true) WITH CHECK (true);
