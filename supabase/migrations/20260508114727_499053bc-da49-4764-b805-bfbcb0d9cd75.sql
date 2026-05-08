
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS address text;

CREATE INDEX IF NOT EXISTS idx_contacts_geo ON public.contacts (latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_geo ON public.projects (latitude, longitude) WHERE latitude IS NOT NULL;
