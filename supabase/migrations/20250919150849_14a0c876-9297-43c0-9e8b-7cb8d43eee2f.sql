-- MIGRAÇÃO #3: Persistência de Contratos
-- Criar tabela de dívidas/contratos
CREATE TABLE public.debts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Dados do contrato
  financed_amount DECIMAL(15,2) NOT NULL,
  first_due_date DATE NOT NULL,
  last_due_date DATE NOT NULL,
  calculation_table TEXT NOT NULL CHECK (calculation_table IN ('SAC', 'PRICE')),
  
  -- Dados da taxa
  interest_rate DECIMAL(10,6) NOT NULL,
  interest_type TEXT NOT NULL CHECK (interest_type IN ('monthly', 'annual')),
  interest_base TEXT NOT NULL CHECK (interest_base IN ('business_days', 'calendar_days')),
  
  -- Taxas adicionais
  iof_rate DECIMAL(10,6) DEFAULT 0,
  additional_fees DECIMAL(15,2) DEFAULT 0,
  
  -- Metadados
  title TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela debts
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para debts
CREATE POLICY "Users can view debts from their companies" 
ON public.debts 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.user_companies 
  WHERE user_companies.company_id = debts.company_id 
  AND user_companies.user_id = auth.uid()
));

CREATE POLICY "Users can create debts for their companies" 
ON public.debts 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by 
  AND EXISTS (
    SELECT 1 FROM public.user_companies 
    WHERE user_companies.company_id = debts.company_id 
    AND user_companies.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update debts they created in their companies" 
ON public.debts 
FOR UPDATE 
USING (
  auth.uid() = created_by 
  AND EXISTS (
    SELECT 1 FROM public.user_companies 
    WHERE user_companies.company_id = debts.company_id 
    AND user_companies.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete debts they created in their companies" 
ON public.debts 
FOR DELETE 
USING (
  auth.uid() = created_by 
  AND EXISTS (
    SELECT 1 FROM public.user_companies 
    WHERE user_companies.company_id = debts.company_id 
    AND user_companies.user_id = auth.uid()
  )
);

-- Criar tabela de parcelas (cache de amortização)
CREATE TABLE public.debt_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  principal_amount DECIMAL(15,2) NOT NULL,
  interest_amount DECIMAL(15,2) NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  remaining_balance DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(debt_id, installment_number)
);

-- Habilitar RLS na tabela debt_installments
ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para debt_installments (herdam das debts)
CREATE POLICY "Users can view installments from their accessible debts" 
ON public.debt_installments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.debts 
  JOIN public.user_companies ON debts.company_id = user_companies.company_id
  WHERE debts.id = debt_installments.debt_id 
  AND user_companies.user_id = auth.uid()
));

CREATE POLICY "System can manage installments" 
ON public.debt_installments 
FOR ALL 
TO service_role
USING (true);

-- Triggers para atualizar updated_at
CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_debts_company_id ON public.debts(company_id);
CREATE INDEX idx_debts_created_by ON public.debts(created_by);
CREATE INDEX idx_debt_installments_debt_id ON public.debt_installments(debt_id);
CREATE INDEX idx_debt_installments_due_date ON public.debt_installments(due_date);

-- Função para limpar parcelas quando dívida é atualizada
CREATE OR REPLACE FUNCTION public.clear_debt_installments()
RETURNS TRIGGER AS $$
BEGIN
  -- Limpar parcelas calculadas quando dados da dívida mudarem
  DELETE FROM public.debt_installments WHERE debt_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para limpar cache de parcelas
CREATE TRIGGER clear_installments_on_debt_update
  AFTER UPDATE ON public.debts
  FOR EACH ROW
  WHEN (
    OLD.financed_amount IS DISTINCT FROM NEW.financed_amount OR
    OLD.first_due_date IS DISTINCT FROM NEW.first_due_date OR
    OLD.last_due_date IS DISTINCT FROM NEW.last_due_date OR
    OLD.calculation_table IS DISTINCT FROM NEW.calculation_table OR
    OLD.interest_rate IS DISTINCT FROM NEW.interest_rate OR
    OLD.interest_type IS DISTINCT FROM NEW.interest_type OR
    OLD.interest_base IS DISTINCT FROM NEW.interest_base
  )
  EXECUTE FUNCTION public.clear_debt_installments();