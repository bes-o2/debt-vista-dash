-- Create banks table
CREATE TABLE public.banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

-- Create policies for banks table
CREATE POLICY "Banks are viewable by everyone" 
ON public.banks 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert banks" 
ON public.banks 
FOR INSERT 
WITH CHECK (true);

-- Insert existing banks
INSERT INTO public.banks (name) VALUES 
  ('Banco do Brasil'),
  ('Caixa Econômica Federal'),
  ('Itaú'),
  ('Bradesco');

-- Create debts table
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id),
  contract_number TEXT,
  financed_amount DECIMAL(15,2) NOT NULL,
  release_date DATE NOT NULL,
  due_date DATE NOT NULL,
  calculation_table TEXT NOT NULL CHECK (calculation_table IN ('SAC', 'PRICE')),
  indexer TEXT,
  interest_rate DECIMAL(8,6) NOT NULL,
  interest_type TEXT NOT NULL CHECK (interest_type IN ('monthly', 'annual')),
  iof_amount DECIMAL(15,2),
  tac_amount DECIMAL(15,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- Create policies for debts table  
CREATE POLICY "Debts are viewable by everyone" 
ON public.debts 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert debts" 
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