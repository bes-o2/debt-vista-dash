-- Create extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: companies
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    cnpj TEXT,
    industry TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Table: archived_companies
CREATE TABLE public.archived_companies (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    cnpj TEXT,
    industry TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by UUID NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.archived_companies ENABLE ROW LEVEL SECURITY;

-- Table: profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Table: user_companies
CREATE TABLE public.user_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, company_id)
);
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- Table: debts
CREATE TABLE public.debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    financed_amount NUMERIC NOT NULL,
    first_due_date DATE NOT NULL,
    last_due_date DATE NOT NULL,
    calculation_table TEXT NOT NULL,
    interest_base TEXT NOT NULL,
    interest_rate NUMERIC NOT NULL,
    interest_type TEXT NOT NULL,
    cet_monthly_rate NUMERIC,
    cet_annual_rate NUMERIC,
    indexer TEXT,
    indexer_start_date DATE,
    additional_fees NUMERIC,
    iof_rate NUMERIC,
    spread_rate NUMERIC,
    reprogramming_rules JSONB,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- Table: debt_installments
CREATE TABLE public.debt_installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    principal_amount NUMERIC NOT NULL,
    interest_amount NUMERIC NOT NULL,
    total_amount NUMERIC NOT NULL,
    remaining_balance NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;

-- Table: economic_indices
CREATE TABLE public.economic_indices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    index_type TEXT NOT NULL,
    rate NUMERIC NOT NULL,
    rate_type TEXT,
    reference_date DATE NOT NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.economic_indices ENABLE ROW LEVEL SECURITY;

-- Table: index_projections
CREATE TABLE public.index_projections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    index_type TEXT NOT NULL,
    projection_date DATE NOT NULL,
    horizon_months INTEGER NOT NULL,
    projected_rate NUMERIC NOT NULL,
    monthly_projection NUMERIC,
    annual_projection NUMERIC,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.index_projections ENABLE ROW LEVEL SECURITY;

-- Functions for RLS
CREATE OR REPLACE FUNCTION public.user_can_access_company(_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE company_id = _company_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_can_create_company(_created_by UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN _created_by = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: user_belongs_to_company (mentioned in types.ts)
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_company_id UUID, _user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE company_id = _company_id AND user_id = _user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: is_company_owner
CREATE OR REPLACE FUNCTION public.is_company_owner(_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Additional Functions from types.ts
CREATE OR REPLACE FUNCTION public.archive_company(company_id UUID) RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.calculate_annual_from_monthly(monthly_rate NUMERIC) RETURNS NUMERIC AS $$ BEGIN RETURN 0; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.calculate_monthly_from_annual(annual_rate NUMERIC) RETURNS NUMERIC AS $$ BEGIN RETURN 0; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.cleanup_old_archived_companies() RETURNS integer AS $$ BEGIN RETURN 0; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.debug_company_creation(_name TEXT, _user_id UUID) RETURNS JSON AS $$ BEGIN RETURN '{}'::json; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.get_auth_debug_info() RETURNS JSON AS $$ BEGIN RETURN '{}'::json; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.get_indexer_rate_for_date(indexer_type TEXT, target_date DATE) RETURNS NUMERIC AS $$ BEGIN RETURN 0; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.get_latest_indexer_rate(indexer_type TEXT) RETURNS NUMERIC AS $$ BEGIN RETURN 0; END; $$ LANGUAGE plpgsql;


-- RLS Policies
-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Companies
CREATE POLICY "Users can view their companies" ON public.companies FOR SELECT USING (public.user_can_access_company(id));
CREATE POLICY "Users can insert companies" ON public.companies FOR INSERT WITH CHECK (public.user_can_create_company(created_by));
CREATE POLICY "Users can update their companies" ON public.companies FOR UPDATE USING (public.user_can_access_company(id));
CREATE POLICY "Users can delete their companies" ON public.companies FOR DELETE USING (public.is_company_owner(id));

-- User Companies
CREATE POLICY "Users can view user_companies they belong to" ON public.user_companies FOR SELECT USING (auth.uid() = user_id OR public.user_can_access_company(company_id));
CREATE POLICY "Users can insert user_companies" ON public.user_companies FOR INSERT WITH CHECK (public.user_can_access_company(company_id));
CREATE POLICY "Users can update user_companies" ON public.user_companies FOR UPDATE USING (public.is_company_owner(company_id));
CREATE POLICY "Users can delete user_companies" ON public.user_companies FOR DELETE USING (public.is_company_owner(company_id) OR auth.uid() = user_id);

-- Debts
CREATE POLICY "Users can view debts of their companies" ON public.debts FOR SELECT USING (public.user_can_access_company(company_id));
CREATE POLICY "Users can insert debts to their companies" ON public.debts FOR INSERT WITH CHECK (public.user_can_access_company(company_id));
CREATE POLICY "Users can update debts of their companies" ON public.debts FOR UPDATE USING (public.user_can_access_company(company_id));
CREATE POLICY "Users can delete debts of their companies" ON public.debts FOR DELETE USING (public.user_can_access_company(company_id));

-- Debt Installments
CREATE POLICY "Users can view debt_installments" ON public.debt_installments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.debts WHERE id = debt_id AND public.user_can_access_company(company_id))
);
CREATE POLICY "Users can insert debt_installments" ON public.debt_installments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.debts WHERE id = debt_id AND public.user_can_access_company(company_id))
);
CREATE POLICY "Users can update debt_installments" ON public.debt_installments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.debts WHERE id = debt_id AND public.user_can_access_company(company_id))
);
CREATE POLICY "Users can delete debt_installments" ON public.debt_installments FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.debts WHERE id = debt_id AND public.user_can_access_company(company_id))
);

-- Indices and Projections
CREATE POLICY "Everyone can view economic_indices" ON public.economic_indices FOR SELECT USING (true);
CREATE POLICY "Everyone can view index_projections" ON public.index_projections FOR SELECT USING (true);

-- Auth Trigger to automatically setup User, Profile, and Company
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  company_id_var UUID;
  user_name TEXT;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  -- Create Profile
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, user_name);

  -- Create Default Company
  INSERT INTO public.companies (name, created_by)
  VALUES (user_name || ' (Padrão)', NEW.id)
  RETURNING id INTO company_id_var;

  -- Create User_Company link
  INSERT INTO public.user_companies (user_id, company_id, role)
  VALUES (NEW.id, company_id_var, 'admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

