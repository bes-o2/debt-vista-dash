-- Corrigir a política para permitir que criadores vejam suas empresas
DROP POLICY IF EXISTS "Users can view companies they created" ON public.companies;

CREATE POLICY "Users can view companies they created"
ON public.companies
FOR SELECT
USING (auth.uid() = created_by);