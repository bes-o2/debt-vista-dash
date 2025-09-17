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