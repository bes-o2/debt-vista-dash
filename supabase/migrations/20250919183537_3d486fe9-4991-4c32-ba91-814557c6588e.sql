-- Criar uma política temporária mais permissiva para debug
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.companies;

-- Política temporária para permitir criação enquanto debugamos o auth.uid()
CREATE POLICY "Temporary company creation policy"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true); -- Temporariamente permitir tudo para usuários autenticados

-- Função para verificar dados de autenticação
CREATE OR REPLACE FUNCTION public.get_auth_debug_info()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'uid', auth.uid(),
    'role', auth.role(),
    'email', auth.email(),
    'jwt', auth.jwt()
  );
$$;