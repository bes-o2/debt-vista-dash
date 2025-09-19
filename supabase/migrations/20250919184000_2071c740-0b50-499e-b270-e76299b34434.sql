-- Temporariamente desabilitar RLS para debug
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;

-- Adicionar log para debug
CREATE OR REPLACE FUNCTION public.log_company_creation()
RETURNS trigger AS $$
BEGIN
  RAISE NOTICE 'Creating company for user: %, company: %', NEW.created_by, NEW.name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para log
DROP TRIGGER IF EXISTS trigger_log_company_creation ON public.companies;
CREATE TRIGGER trigger_log_company_creation
  BEFORE INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.log_company_creation();