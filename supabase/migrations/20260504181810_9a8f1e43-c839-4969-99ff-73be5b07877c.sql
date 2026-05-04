-- 1. Conselho: documentos por categoria (aba)
CREATE TABLE IF NOT EXISTS public.board_category_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  company_id uuid,
  category text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  content_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.board_category_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own board_category_documents"
  ON public.board_category_documents FOR ALL TO authenticated
  USING ((user_id = auth.uid()) OR public.owns_company(auth.uid(), company_id))
  WITH CHECK ((user_id = auth.uid()) OR public.owns_company(auth.uid(), company_id));

DROP TRIGGER IF EXISTS set_uid_board_category_documents ON public.board_category_documents;
CREATE TRIGGER set_uid_board_category_documents
  BEFORE INSERT ON public.board_category_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

-- 2. Restringir bucket attachments: INSERT/DELETE somente autenticados
DROP POLICY IF EXISTS "Public can upload to attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete from attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public attachments delete" ON storage.objects;
DROP POLICY IF EXISTS "attachments_insert_public" ON storage.objects;
DROP POLICY IF EXISTS "attachments_delete_public" ON storage.objects;

CREATE POLICY "Authenticated can upload attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Authenticated can update own attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'attachments' AND owner = auth.uid());

CREATE POLICY "Authenticated can delete own attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND owner = auth.uid());

-- 3. Corrige owns_company para tratar NULL como falso
CREATE OR REPLACE FUNCTION public.owns_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id IS NULL OR _company_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.companies
      WHERE id = _company_id AND user_id = _user_id
    )
  END
$function$;