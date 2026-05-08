ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

CREATE INDEX IF NOT EXISTS contacts_location_idx
ON public.contacts(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS projects_location_idx
ON public.projects(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
