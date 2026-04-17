-- Schema completo consolidado — aplique via SQL Editor do Supabase
-- ou marque as migrations antigas como aplicadas e rode: supabase migration up

-- ============================================================
-- 1. FUNÇÕES UTILITÁRIAS (sem dependência de tabelas)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.calculate_monthly_from_annual(annual_rate numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT POWER(1 + (annual_rate / 100), 1.0/12) - 1; $$;

CREATE OR REPLACE FUNCTION public.calculate_annual_from_monthly(monthly_rate numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT (POWER(1 + monthly_rate, 12) - 1) * 100; $$;

-- ============================================================
-- 2. TABELAS (RLS habilitado; policies criadas na seção 4)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  cnpj       TEXT,
  industry   TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT companies_cnpj_unique UNIQUE (cnpj)
);
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON public.companies(deleted_at);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.user_companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.economic_indices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_type     TEXT NOT NULL,
  rate           DECIMAL(10,6) NOT NULL,
  reference_date DATE NOT NULL,
  source         TEXT NOT NULL DEFAULT 'BCB',
  rate_type      TEXT DEFAULT 'daily' CHECK (rate_type IN ('daily','monthly','annual')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(index_type, reference_date)
);
CREATE INDEX IF NOT EXISTS idx_economic_indices_type_date
  ON public.economic_indices(index_type, reference_date DESC);
ALTER TABLE public.economic_indices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_economic_indices_updated_at BEFORE UPDATE ON public.economic_indices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.index_projections (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_type         TEXT NOT NULL,
  projected_rate     DECIMAL(10,6) NOT NULL,
  projection_date    DATE NOT NULL,
  horizon_months     INTEGER NOT NULL,
  monthly_projection NUMERIC,
  annual_projection  NUMERIC,
  created_by         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(index_type, projection_date, horizon_months, created_by)
);
ALTER TABLE public.index_projections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_index_projections_updated_at BEFORE UPDATE ON public.index_projections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.debts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT,
  description         TEXT,
  financed_amount     NUMERIC(18,2) NOT NULL,
  first_due_date      DATE NOT NULL,
  last_due_date       DATE NOT NULL,
  calculation_table   TEXT NOT NULL CHECK (calculation_table IN ('SAC','PRICE')),
  interest_rate       NUMERIC(10,6) NOT NULL,
  interest_type       TEXT NOT NULL CHECK (interest_type IN ('monthly','annual')),
  interest_base       TEXT NOT NULL CHECK (interest_base = ANY(ARRAY[
                        'Pré-fixado','CDI','IPCA','SELIC','TR','IGPM','IGP-M'])),
  iof_rate            NUMERIC(10,6) DEFAULT 0,
  additional_fees     NUMERIC(18,2) DEFAULT 0,
  cet_monthly_rate    NUMERIC,
  cet_annual_rate     NUMERIC,
  indexer             TEXT CHECK (indexer IS NULL OR indexer IN (
                        'CDI','SELIC','IPCA','Pré-fixado','TR','IGP-M')),
  spread_rate         NUMERIC DEFAULT 0,
  indexer_start_date  DATE,
  reprogramming_rules JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_debts_company_id ON public.debts(company_id);
CREATE INDEX IF NOT EXISTS idx_debts_created_by ON public.debts(created_by);
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_debts_updated_at BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.debt_installments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id            UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date           DATE NOT NULL,
  principal_amount   NUMERIC(18,2) NOT NULL,
  interest_amount    NUMERIC(18,2) NOT NULL,
  total_amount       NUMERIC(18,2) NOT NULL,
  remaining_balance  NUMERIC(18,2) NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(debt_id, installment_number)
);
CREATE INDEX IF NOT EXISTS idx_debt_installments_debt_id ON public.debt_installments(debt_id);
ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.archived_companies (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL,
  cnpj       TEXT,
  industry   TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_by UUID NOT NULL
);
ALTER TABLE public.archived_companies ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. FUNÇÕES HELPER (dependem das tabelas já existirem)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_company_owner(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies
    WHERE id = _company_id AND created_by = auth.uid()); $$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_companies
    WHERE user_id = _user_id AND company_id = _company_id); $$;

CREATE OR REPLACE FUNCTION public.user_can_access_company(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid() AND company_id = _company_id); $$;

CREATE OR REPLACE FUNCTION public.user_can_create_company(_created_by uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.role() = 'authenticated' AND _created_by IS NOT NULL; $$;

CREATE OR REPLACE FUNCTION public.debug_company_creation(_name text, _user_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('current_user', auth.uid(), 'provided_user', _user_id,
    'match', auth.uid() = _user_id, 'can_create', auth.uid() IS NOT NULL AND auth.uid() = _user_id); $$;

CREATE OR REPLACE FUNCTION public.get_auth_debug_info()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('uid', auth.uid(), 'role', auth.role(),
    'email', auth.email(), 'jwt', auth.jwt()); $$;

CREATE OR REPLACE FUNCTION public.get_latest_indexer_rate(indexer_type text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rate FROM public.economic_indices
  WHERE index_type = indexer_type ORDER BY reference_date DESC LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.get_indexer_rate_for_date(indexer_type text, target_date date)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rate FROM public.economic_indices
  WHERE index_type = indexer_type AND reference_date <= target_date
  ORDER BY reference_date DESC LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.archive_company(company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.archived_companies (id,name,cnpj,industry,created_by,created_at,updated_at,deleted_at,deleted_by)
  SELECT id,name,cnpj,industry,created_by,created_at,updated_at,now(),auth.uid()
  FROM public.companies WHERE id = company_id;
  UPDATE public.companies SET deleted_at = now(), updated_at = now() WHERE id = company_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cleanup_old_archived_companies()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt integer;
BEGIN
  WITH d AS (DELETE FROM public.archived_companies
    WHERE deleted_at < now() - INTERVAL '30 days' RETURNING id)
  SELECT COUNT(*) INTO cnt FROM d;
  RETURN cnt;
END; $$;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- companies
CREATE POLICY "Users can view active companies they belong to"
  ON public.companies FOR SELECT USING (
    deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM public.user_companies
      WHERE company_id = companies.id AND user_id = auth.uid()));

CREATE POLICY "Users can view active companies they created"
  ON public.companies FOR SELECT
  USING (deleted_at IS NULL AND auth.uid() = created_by);

CREATE POLICY "Users can create companies"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by
    AND name IS NOT NULL AND trim(name) != '');

CREATE POLICY "Company owners can update their companies"
  ON public.companies FOR UPDATE
  USING (auth.uid() = created_by AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = created_by);

-- user_companies
CREATE POLICY "Users can view their company associations"
  ON public.user_companies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own associations"
  ON public.user_companies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Company owners can manage associations"
  ON public.user_companies FOR ALL
  USING (public.is_company_owner(company_id))
  WITH CHECK (public.is_company_owner(company_id));

-- economic_indices
CREATE POLICY "Authenticated users can view economic indices"
  ON public.economic_indices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages economic indices"
  ON public.economic_indices FOR ALL TO service_role USING (true);

-- index_projections
CREATE POLICY "Users manage their own projections"
  ON public.index_projections FOR ALL USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- debts
CREATE POLICY "Users can view company debts"
  ON public.debts FOR SELECT USING (public.user_can_access_company(company_id));
CREATE POLICY "Users can create company debts"
  ON public.debts FOR INSERT
  WITH CHECK (auth.uid() = created_by AND public.user_can_access_company(company_id));
CREATE POLICY "Users can update their debts"
  ON public.debts FOR UPDATE
  USING (auth.uid() = created_by AND public.user_can_access_company(company_id));
CREATE POLICY "Users can delete their debts"
  ON public.debts FOR DELETE
  USING (auth.uid() = created_by AND public.user_can_access_company(company_id));

-- debt_installments
CREATE POLICY "Users can manage installments of accessible debts"
  ON public.debt_installments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.debts d
    JOIN public.user_companies uc ON d.company_id = uc.company_id
    WHERE d.id = debt_installments.debt_id AND uc.user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.debts d
    JOIN public.user_companies uc ON d.company_id = uc.company_id
    WHERE d.id = debt_installments.debt_id AND uc.user_id = auth.uid()));

-- archived_companies
CREATE POLICY "Users can view their archived companies"
  ON public.archived_companies FOR SELECT
  USING (deleted_by = auth.uid() OR created_by = auth.uid());

-- ============================================================
-- 5. TRIGGERS DE NEGÓCIO
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_calculate_projection_rates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.monthly_projection IS NOT NULL AND NEW.annual_projection IS NULL THEN
    NEW.annual_projection := public.calculate_annual_from_monthly(NEW.monthly_projection);
  END IF;
  IF NEW.annual_projection IS NOT NULL AND NEW.monthly_projection IS NULL THEN
    NEW.monthly_projection := public.calculate_monthly_from_annual(NEW.annual_projection);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_projection_rates ON public.index_projections;
CREATE TRIGGER trg_projection_rates BEFORE INSERT OR UPDATE ON public.index_projections
  FOR EACH ROW EXECUTE FUNCTION public.auto_calculate_projection_rates();

CREATE OR REPLACE FUNCTION public.clear_debt_installments()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN DELETE FROM public.debt_installments WHERE debt_id = NEW.id; RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_clear_installments ON public.debts;
CREATE TRIGGER trg_clear_installments AFTER UPDATE ON public.debts
  FOR EACH ROW
  WHEN (OLD.financed_amount   IS DISTINCT FROM NEW.financed_amount   OR
        OLD.first_due_date    IS DISTINCT FROM NEW.first_due_date    OR
        OLD.last_due_date     IS DISTINCT FROM NEW.last_due_date     OR
        OLD.calculation_table IS DISTINCT FROM NEW.calculation_table OR
        OLD.interest_rate     IS DISTINCT FROM NEW.interest_rate     OR
        OLD.interest_type     IS DISTINCT FROM NEW.interest_type     OR
        OLD.interest_base     IS DISTINCT FROM NEW.interest_base)
  EXECUTE FUNCTION public.clear_debt_installments();

-- ============================================================
-- 6. TRIGGER DE AUTH — cria perfil automaticamente no cadastro
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name',
             NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name'),
    NEW.email
  ) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 7. SEED — Índices econômicos iniciais
-- ============================================================

INSERT INTO public.economic_indices (index_type, rate, reference_date, source, rate_type) VALUES
  ('CDI',   10.75, CURRENT_DATE - 1, 'BCB', 'daily'),
  ('SELIC', 10.75, CURRENT_DATE - 1, 'BCB', 'daily'),
  ('IPCA',   4.50, CURRENT_DATE - 30, 'BCB', 'monthly')
ON CONFLICT (index_type, reference_date) DO NOTHING;
