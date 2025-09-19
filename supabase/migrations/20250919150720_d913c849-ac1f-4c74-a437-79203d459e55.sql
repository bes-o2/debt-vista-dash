-- MIGRAÇÃO #1: Sistema de Taxas Econômicas
-- Criar tabela de índices econômicos
CREATE TABLE public.economic_indices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  index_type TEXT NOT NULL, -- 'CDI', 'SELIC', 'IPCA'
  rate DECIMAL(10,6) NOT NULL,
  reference_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'BCB',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(index_type, reference_date)
);

-- Habilitar RLS (dados públicos, todos podem ler)
ALTER TABLE public.economic_indices ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura para todos usuários autenticados
CREATE POLICY "Economic indices are readable by authenticated users" 
ON public.economic_indices 
FOR SELECT 
TO authenticated
USING (true);

-- Política para permitir inserção/atualização apenas por sistema
CREATE POLICY "Economic indices can be managed by system" 
ON public.economic_indices 
FOR ALL 
TO service_role
USING (true);

-- Criar tabela de projeções de índices
CREATE TABLE public.index_projections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  index_type TEXT NOT NULL, -- 'CDI', 'SELIC', 'IPCA'
  projected_rate DECIMAL(10,6) NOT NULL,
  projection_date DATE NOT NULL,
  horizon_months INTEGER NOT NULL, -- quantos meses à frente
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(index_type, projection_date, horizon_months, created_by)
);

-- Habilitar RLS na tabela de projeções
ALTER TABLE public.index_projections ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para projeções
CREATE POLICY "Users can view all projections" 
ON public.index_projections 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can create their own projections" 
ON public.index_projections 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own projections" 
ON public.index_projections 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own projections" 
ON public.index_projections 
FOR DELETE 
USING (auth.uid() = created_by);

-- Triggers para atualizar updated_at
CREATE TRIGGER update_economic_indices_updated_at
  BEFORE UPDATE ON public.economic_indices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_index_projections_updated_at
  BEFORE UPDATE ON public.index_projections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir dados iniciais de exemplo (taxas atuais)
INSERT INTO public.economic_indices (index_type, rate, reference_date, source) VALUES
('CDI', 10.75, CURRENT_DATE - INTERVAL '1 day', 'BCB'),
('SELIC', 10.75, CURRENT_DATE - INTERVAL '1 day', 'BCB'),
('IPCA', 4.50, CURRENT_DATE - INTERVAL '1 month', 'BCB')
ON CONFLICT (index_type, reference_date) DO NOTHING;