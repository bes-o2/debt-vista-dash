-- Create table for corporate debts
CREATE TABLE public.debts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  financed_amount DECIMAL(15,2) NOT NULL,
  release_date DATE NOT NULL,
  due_date DATE NOT NULL,
  calculation_table TEXT NOT NULL CHECK (calculation_table IN ('SAC', 'PRICE')),
  indexer TEXT,
  interest_rate DECIMAL(8,4) NOT NULL,
  interest_rate_type TEXT NOT NULL CHECK (interest_rate_type IN ('monthly', 'annual')),
  iof_amount DECIMAL(15,2),
  tac_amount DECIMAL(15,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (corporate use)
CREATE POLICY "Debts are viewable by everyone" 
ON public.debts 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create debts" 
ON public.debts 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update debts" 
ON public.debts 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete debts" 
ON public.debts 
FOR DELETE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_debts_updated_at
BEFORE UPDATE ON public.debts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add validation trigger for indexer field (required when calculation_table is SAC)
CREATE OR REPLACE FUNCTION public.validate_debt_indexer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.calculation_table = 'SAC' AND (NEW.indexer IS NULL OR NEW.indexer = '') THEN
    RAISE EXCEPTION 'Indexer is required when calculation table is SAC';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_debt_indexer_trigger
BEFORE INSERT OR UPDATE ON public.debts
FOR EACH ROW
EXECUTE FUNCTION public.validate_debt_indexer();