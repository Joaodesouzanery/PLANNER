-- 1. Revoke EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.set_user_id_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_uploaded_by_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_first_user_admin() FROM PUBLIC, anon, authenticated;

-- 2. Restrict listing of attachments bucket (public bucket but no anon listing)
DROP POLICY IF EXISTS "Public can list attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anon can list attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can list attachments" ON storage.objects;

CREATE POLICY "Owners can list attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'attachments' AND (owner = auth.uid()));

-- 3. LinkedIn import logs table
CREATE TABLE IF NOT EXISTS public.linkedin_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  linkedin_url text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  extracted_summary jsonb DEFAULT '{}'::jsonb,
  prospect_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.linkedin_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own linkedin_import_logs"
ON public.linkedin_import_logs FOR ALL
TO authenticated
USING ((user_id = auth.uid()) OR public.owns_company(auth.uid(), company_id))
WITH CHECK ((user_id = auth.uid()) OR public.owns_company(auth.uid(), company_id));

CREATE INDEX IF NOT EXISTS idx_linkedin_logs_user ON public.linkedin_import_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_logs_company ON public.linkedin_import_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_logs_created ON public.linkedin_import_logs(created_at DESC);

-- 4. Auto-fill user_id on insert (function exists)
CREATE TRIGGER set_user_id_linkedin_logs
  BEFORE INSERT ON public.linkedin_import_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();