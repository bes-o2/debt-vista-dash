-- Corrigir a constraint interest_base para aceitar os valores corretos
-- Primeiro, remover a constraint existente
ALTER TABLE public.debts DROP CONSTRAINT IF EXISTS debts_interest_base_check;

-- Criar nova constraint que aceita os indexadores corretos
ALTER TABLE public.debts ADD CONSTRAINT debts_interest_base_check 
CHECK (interest_base = ANY (ARRAY[
  'Pré-fixado'::text,
  'CDI'::text, 
  'IPCA'::text, 
  'SELIC'::text, 
  'TR'::text, 
  'IGPM'::text,
  'IGP-M'::text
]));