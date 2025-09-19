-- Criar função helper para verificar se usuário pertence à empresa
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_companies uc
    WHERE uc.user_id = _user_id
      AND uc.company_id = _company_id
  );
$$;

-- Função para verificar se usuário pode acessar empresa
CREATE OR REPLACE FUNCTION public.user_can_access_company(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
      AND uc.company_id = _company_id
  );
$$;

-- Recriar políticas da tabela debts usando as funções helper
DROP POLICY IF EXISTS "Users can create debts for their companies" ON public.debts;
DROP POLICY IF EXISTS "Users can view debts from their companies" ON public.debts;
DROP POLICY IF EXISTS "Users can update debts they created in their companies" ON public.debts;
DROP POLICY IF EXISTS "Users can delete debts they created in their companies" ON public.debts;

-- Política para CREATE - usuário deve estar autenticado e pertencer à empresa
CREATE POLICY "Users can create debts for their companies"
ON public.debts
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = created_by 
  AND public.user_can_access_company(company_id)
);

-- Política para SELECT - usuário deve pertencer à empresa
CREATE POLICY "Users can view debts from their companies"
ON public.debts
FOR SELECT
USING (public.user_can_access_company(company_id));

-- Política para UPDATE - usuário deve ser o criador e pertencer à empresa
CREATE POLICY "Users can update debts they created in their companies"
ON public.debts
FOR UPDATE
USING (
  auth.uid() = created_by 
  AND public.user_can_access_company(company_id)
);

-- Política para DELETE - usuário deve ser o criador e pertencer à empresa
CREATE POLICY "Users can delete debts they created in their companies"
ON public.debts
FOR DELETE
USING (
  auth.uid() = created_by 
  AND public.user_can_access_company(company_id)
);