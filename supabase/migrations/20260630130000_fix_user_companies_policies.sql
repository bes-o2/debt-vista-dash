-- Reconciliação das políticas de user_companies.
--
-- Motivo: no banco remoto as políticas de INSERT/UPDATE/DELETE existiam sob
-- nomes diferentes dos do schema versionado (projeto migrado de outra origem).
-- Como políticas permissivas são combinadas com OR, uma política antiga
-- permissiva anularia a restrição "só dono + super-admin concede acesso".
--
-- Aqui removemos TODAS as políticas atuais de public.user_companies
-- (independente do nome) e recriamos exatamente as 4 desejadas.

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_companies'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_companies;', pol.policyname);
  END LOOP;
END $$;

-- Leitura: o próprio vínculo, membros da mesma empresa, ou super-admin.
CREATE POLICY "uc_select" ON public.user_companies
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.user_can_access_company(company_id)
    OR public.is_super_admin()
  );

-- Conceder acesso: só dono da empresa + super-admin.
CREATE POLICY "uc_insert" ON public.user_companies
  FOR INSERT WITH CHECK (
    public.is_company_owner(company_id) OR public.is_super_admin()
  );

-- Alterar vínculo (ex.: papel): só dono + super-admin.
CREATE POLICY "uc_update" ON public.user_companies
  FOR UPDATE USING (
    public.is_company_owner(company_id) OR public.is_super_admin()
  );

-- Remover acesso: dono, super-admin, ou o próprio usuário (sair da empresa).
CREATE POLICY "uc_delete" ON public.user_companies
  FOR DELETE USING (
    public.is_company_owner(company_id) OR public.is_super_admin() OR auth.uid() = user_id
  );
