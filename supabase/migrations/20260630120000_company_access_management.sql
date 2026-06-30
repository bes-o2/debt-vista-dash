-- Gestão de acessos por empresa
--
-- Regras:
--   * Dono da empresa = companies.created_by (já refletido em is_company_owner).
--   * Super-admin (matheus.besnos@o2inc.com.br) pode gerenciar acessos de QUALQUER empresa.
--   * Só dono + super-admin concedem/removem acesso; membros têm acesso total aos dados (ver + editar).
--   * Conceder acesso é feito por e-mail; a pessoa precisa já ter conta (@o2inc.com.br).

-- 1. Super-admin (por e-mail)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND lower(email) = 'matheus.besnos@o2inc.com.br'
  );
$$;

-- 2. Apertar RLS de user_companies: só dono + super-admin concedem/alteram acesso.
--    (DELETE continua permitindo o próprio usuário sair da empresa.)
DROP POLICY IF EXISTS "Users can insert user_companies" ON public.user_companies;
CREATE POLICY "Users can insert user_companies" ON public.user_companies
  FOR INSERT WITH CHECK (public.is_company_owner(company_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can update user_companies" ON public.user_companies;
CREATE POLICY "Users can update user_companies" ON public.user_companies
  FOR UPDATE USING (public.is_company_owner(company_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can delete user_companies" ON public.user_companies;
CREATE POLICY "Users can delete user_companies" ON public.user_companies
  FOR DELETE USING (
    public.is_company_owner(company_id) OR public.is_super_admin() OR auth.uid() = user_id
  );

-- 3. RPC: empresas cujos acessos o usuário atual pode gerenciar
--    (as que ele criou; todas, se for super-admin).
CREATE OR REPLACE FUNCTION public.list_manageable_companies()
RETURNS TABLE (id uuid, name text, cnpj text, created_by uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.name, c.cnpj, c.created_by
  FROM public.companies c
  WHERE c.deleted_at IS NULL
    AND (c.created_by = auth.uid() OR public.is_super_admin())
  ORDER BY c.name;
$$;

-- 4. RPC: membros (com e-mail) de uma empresa
CREATE OR REPLACE FUNCTION public.list_company_members(_company_id uuid)
RETURNS TABLE (user_id uuid, email text, display_name text, role text, is_owner boolean)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_company_owner(_company_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Sem permissão para ver os acessos desta empresa.';
  END IF;

  RETURN QUERY
  SELECT uc.user_id,
         p.email,
         p.display_name,
         uc.role,
         (c.created_by = uc.user_id) AS is_owner
  FROM public.user_companies uc
  JOIN public.companies c ON c.id = uc.company_id
  LEFT JOIN public.profiles p ON p.user_id = uc.user_id
  WHERE uc.company_id = _company_id
  ORDER BY (c.created_by = uc.user_id) DESC, p.email;
END;
$$;

-- 5. RPC: conceder acesso por e-mail
CREATE OR REPLACE FUNCTION public.grant_company_access(_company_id uuid, _email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized text := lower(trim(_email));
  _target uuid;
BEGIN
  IF NOT (public.is_company_owner(_company_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Apenas o dono da empresa pode conceder acesso.';
  END IF;

  IF _normalized !~ '@o2inc\.com\.br$' THEN
    RAISE EXCEPTION 'O e-mail deve ser do domínio @o2inc.com.br.';
  END IF;

  SELECT user_id INTO _target FROM public.profiles WHERE lower(email) = _normalized;

  IF _target IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado. Peça para a pessoa fazer login ao menos uma vez antes.';
  END IF;

  INSERT INTO public.user_companies (user_id, company_id, role)
  VALUES (_target, _company_id, 'member')
  ON CONFLICT (user_id, company_id) DO NOTHING;

  RETURN jsonb_build_object('user_id', _target, 'email', _normalized);
END;
$$;

-- 6. RPC: revogar acesso (não permite remover o dono)
CREATE OR REPLACE FUNCTION public.revoke_company_access(_company_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
BEGIN
  IF NOT (public.is_company_owner(_company_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Apenas o dono da empresa pode remover acessos.';
  END IF;

  SELECT created_by INTO _owner FROM public.companies WHERE id = _company_id;

  IF _user_id = _owner THEN
    RAISE EXCEPTION 'Não é possível remover o dono da empresa.';
  END IF;

  DELETE FROM public.user_companies WHERE company_id = _company_id AND user_id = _user_id;
END;
$$;

-- 7. Permissões de execução (PostgREST / cliente autenticado)
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_manageable_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_company_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_company_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_company_access(uuid, uuid) TO authenticated;
