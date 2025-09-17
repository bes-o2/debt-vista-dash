-- Add bank field to debts table with validation for main Brazilian banks
ALTER TABLE public.debts 
ADD COLUMN bank TEXT NOT NULL DEFAULT 'Banco do Brasil';

-- Create trigger function to validate bank names
CREATE OR REPLACE FUNCTION validate_bank_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bank NOT IN ('Banco do Brasil', 'Caixa Econômica Federal', 'Itaú', 'Bradesco') THEN
    RAISE EXCEPTION 'Banco deve ser um dos principais bancos: Banco do Brasil, Caixa Econômica Federal, Itaú, Bradesco';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for bank validation
CREATE TRIGGER validate_bank_trigger
  BEFORE INSERT OR UPDATE ON public.debts
  FOR EACH ROW
  EXECUTE FUNCTION validate_bank_name();

-- Create trigger function to validate indexer based on calculation table
CREATE OR REPLACE FUNCTION validate_indexer_conditional()
RETURNS TRIGGER AS $$
BEGIN
  -- If calculation table is SAC, indexer is required and must be valid
  IF NEW.calculation_table = 'SAC' THEN
    IF NEW.indexer IS NULL OR NEW.indexer = '' THEN
      RAISE EXCEPTION 'Indexador é obrigatório quando a tabela de cálculo é SAC';
    END IF;
    IF NEW.indexer NOT IN ('CDI', 'IPCA', 'SELIC', 'TR', 'IGPM') THEN
      RAISE EXCEPTION 'Indexador deve ser CDI, IPCA, SELIC, TR ou IGPM';
    END IF;
  -- If calculation table is PRICE, indexer should be null
  ELSIF NEW.calculation_table = 'PRICE' THEN
    NEW.indexer := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for indexer validation
CREATE TRIGGER validate_indexer_conditional_trigger
  BEFORE INSERT OR UPDATE ON public.debts
  FOR EACH ROW
  EXECUTE FUNCTION validate_indexer_conditional();