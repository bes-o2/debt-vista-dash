-- Criar função helper para debug da criação de empresa
CREATE OR REPLACE FUNCTION public.debug_company_creation(_user_id uuid, _name text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'current_user', auth.uid(),
    'provided_user', _user_id,
    'match', auth.uid() = _user_id,
    'can_create', auth.uid() IS NOT NULL AND auth.uid() = _user_id
  );
$$;