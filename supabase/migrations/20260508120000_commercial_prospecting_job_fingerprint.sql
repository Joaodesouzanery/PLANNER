ALTER TABLE public.commercial_prospects
ADD COLUMN IF NOT EXISTS job_fingerprint text;

UPDATE public.commercial_prospects
SET job_fingerprint = CASE
  WHEN substring(lower(coalesce(linkedin_job_url, '')) from 'jobs/view/([0-9]+)') IS NOT NULL
    THEN 'linkedin:' || substring(lower(coalesce(linkedin_job_url, '')) from 'jobs/view/([0-9]+)')
  WHEN substring(lower(coalesce(linkedin_job_url, '')) from 'currentjobid=([0-9]+)') IS NOT NULL
    THEN 'linkedin:' || substring(lower(coalesce(linkedin_job_url, '')) from 'currentjobid=([0-9]+)')
  ELSE 'manual:' || md5(
    coalesce(lower(regexp_replace(company_name, '\s+', ' ', 'g')), '') || '|' ||
    coalesce(lower(regexp_replace(coalesce(job_title, ''), '\s+', ' ', 'g')), '') || '|' ||
    left(coalesce(lower(regexp_replace(coalesce(job_about, ''), '\s+', ' ', 'g')), ''), 700)
  )
END
WHERE job_fingerprint IS NULL
  AND (
    linkedin_job_url IS NOT NULL
    OR company_name IS NOT NULL
    OR job_title IS NOT NULL
    OR job_about IS NOT NULL
  );

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
        job_fingerprint
      ORDER BY created_at, id
    ) AS duplicate_rank
  FROM public.commercial_prospects
  WHERE job_fingerprint IS NOT NULL
)
UPDATE public.commercial_prospects AS prospect
SET job_fingerprint = prospect.job_fingerprint || ':legacy-duplicate:' || left(prospect.id::text, 8)
FROM ranked
WHERE prospect.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS commercial_prospects_unique_job_fingerprint_idx
ON public.commercial_prospects (
  coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
  job_fingerprint
)
WHERE job_fingerprint IS NOT NULL;
