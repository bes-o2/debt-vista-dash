-- Migration #4: Estrutura Multi-Empresa
-- Criação de tabelas para suporte a múltiplas empresas por usuário

-- Tabela de perfis dos usuários (CFOs)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT DEFAULT 'cfo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de empresas
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  industry TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de relacionamento entre usuários e empresas (N:N)
CREATE TABLE public.user_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'owner',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Tabela de dívidas (atualizada para incluir company_id)
CREATE TABLE public.debts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  financed_amount DECIMAL(15,2) NOT NULL,
  release_date DATE NOT NULL,
  due_date DATE NOT NULL,
  calculation_table TEXT NOT NULL,
  interest_rate DECIMAL(8,4) NOT NULL,
  interest_type TEXT NOT NULL CHECK (interest_type IN ('cdi_plus', 'fixed', 'ipca_plus')),
  bank_name TEXT NOT NULL,
  bank_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de parcelas das dívidas
CREATE TABLE public.debt_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  principal_amount DECIMAL(15,2) NOT NULL,
  interest_amount DECIMAL(15,2) NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  outstanding_balance DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Políticas RLS para companies
CREATE POLICY "Users can view companies they belong to" 
ON public.companies 
FOR SELECT 
USING (
  id IN (
    SELECT company_id 
    FROM public.user_companies 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Company owners can update their companies" 
ON public.companies 
FOR UPDATE 
USING (
  id IN (
    SELECT company_id 
    FROM public.user_companies 
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

-- Políticas RLS para user_companies
CREATE POLICY "Users can view their own company relationships" 
ON public.user_companies 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create company relationships for themselves" 
ON public.user_companies 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Políticas RLS para debts
CREATE POLICY "Users can view debts from their companies" 
ON public.debts 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id 
    FROM public.user_companies 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create debts for their companies" 
ON public.debts 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  company_id IN (
    SELECT company_id 
    FROM public.user_companies 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update debts from their companies" 
ON public.debts 
FOR UPDATE 
USING (
  company_id IN (
    SELECT company_id 
    FROM public.user_companies 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete debts from their companies" 
ON public.debts 
FOR DELETE 
USING (
  company_id IN (
    SELECT company_id 
    FROM public.user_companies 
    WHERE user_id = auth.uid()
  )
);

-- Políticas RLS para debt_installments
CREATE POLICY "Users can view installments from their company debts" 
ON public.debt_installments 
FOR SELECT 
USING (
  debt_id IN (
    SELECT d.id 
    FROM public.debts d
    JOIN public.user_companies uc ON d.company_id = uc.company_id
    WHERE uc.user_id = auth.uid()
  )
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar profile automaticamente quando usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Índices para performance
CREATE INDEX idx_user_companies_user_id ON public.user_companies(user_id);
CREATE INDEX idx_user_companies_company_id ON public.user_companies(company_id);
CREATE INDEX idx_debts_company_id ON public.debts(company_id);
CREATE INDEX idx_debts_user_id ON public.debts(user_id);
CREATE INDEX idx_debt_installments_debt_id ON public.debt_installments(debt_id);