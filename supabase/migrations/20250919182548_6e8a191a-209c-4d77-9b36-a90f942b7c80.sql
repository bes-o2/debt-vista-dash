-- Fix recursive RLS by using a SECURITY DEFINER helper
CREATE OR REPLACE FUNCTION public.is_company_owner(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = _company_id
      AND c.created_by = auth.uid()
  );
$$;

-- Ensure ownership remains with an admin role to bypass RLS
ALTER FUNCTION public.is_company_owner(uuid) OWNER TO postgres;

-- Replace the recursive policy with a function-based one
DROP POLICY IF EXISTS "Company owners can manage associations" ON public.user_companies;

CREATE POLICY "Company owners can manage associations"
ON public.user_companies
FOR ALL
USING (public.is_company_owner(company_id))
WITH CHECK (public.is_company_owner(company_id));