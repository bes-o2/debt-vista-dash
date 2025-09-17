-- Create table for corporate debts with secure RLS
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID,
  financed_amount NUMERIC(18,2) NOT NULL,
  release_date DATE NOT NULL,
  due_date DATE NOT NULL,
  calculation_table TEXT NOT NULL CHECK (calculation_table IN ('SAC', 'PRICE')),
  indexer TEXT,
  interest_rate NUMERIC(8,6) NOT NULL,
  interest_rate_type TEXT NOT NULL CHECK (interest_rate_type IN ('monthly', 'annual')),
  iof_amount NUMERIC(18,2),
  tac_amount NUMERIC(18,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for updated_at
CREATE TRIGGER trg_debts_updated_at
BEFORE UPDATE ON public.debts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Validation: indexer required when calculation_table = 'SAC'
CREATE OR REPLACE FUNCTION public.validate_debt_indexer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.calculation_table = 'SAC' AND (NEW.indexer IS NULL OR btrim(NEW.indexer) = '') THEN
    RAISE EXCEPTION 'Indexer is required when calculation table is SAC';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_debt_indexer
BEFORE INSERT OR UPDATE ON public.debts
FOR EACH ROW
EXECUTE FUNCTION public.validate_debt_indexer();

-- Validation: due_date must be on/after release_date
CREATE OR REPLACE FUNCTION public.validate_debt_dates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.due_date < NEW.release_date THEN
    RAISE EXCEPTION 'due_date must be on or after release_date';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_debt_dates
BEFORE INSERT OR UPDATE ON public.debts
FOR EACH ROW
EXECUTE FUNCTION public.validate_debt_dates();

-- Auto-fill created_by from auth context if available
CREATE OR REPLACE FUNCTION public.set_created_by_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_set_created_by
BEFORE INSERT ON public.debts
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by_on_insert();

-- Index for created_by
CREATE INDEX idx_debts_created_by ON public.debts(created_by);

-- RLS Policies: users can CRUD only their own rows
CREATE POLICY "Users can view their own debts"
ON public.debts
FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own debts"
ON public.debts
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own debts"
ON public.debts
FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own debts"
ON public.debts
FOR DELETE
USING (auth.uid() = created_by);