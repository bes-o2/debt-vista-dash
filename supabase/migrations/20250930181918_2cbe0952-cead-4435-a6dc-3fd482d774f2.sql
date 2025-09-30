-- Phase 1: Database Schema Enhancements for Post Fixed Contracts

-- 1.1 Enhanced Index Projections Table
-- Add monthly and annual projection fields
ALTER TABLE public.index_projections
ADD COLUMN IF NOT EXISTS monthly_projection numeric,
ADD COLUMN IF NOT EXISTS annual_projection numeric;

COMMENT ON COLUMN public.index_projections.monthly_projection IS 'Projected monthly rate for the index';
COMMENT ON COLUMN public.index_projections.annual_projection IS 'Projected annualized rate for the index';

-- 1.2 Debt Contract Enhancements
-- Add fields for Post Fixed contract support
ALTER TABLE public.debts
ADD COLUMN IF NOT EXISTS indexer text,
ADD COLUMN IF NOT EXISTS spread_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS indexer_start_date date,
ADD COLUMN IF NOT EXISTS reprogramming_rules jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.debts.indexer IS 'Economic index for post-fixed contracts (CDI, SELIC, IPCA, or "Pré-fixado" for pre-fixed)';
COMMENT ON COLUMN public.debts.spread_rate IS 'Spread rate above the indexer (in percentage points)';
COMMENT ON COLUMN public.debts.indexer_start_date IS 'Date when indexing starts for the contract';
COMMENT ON COLUMN public.debts.reprogramming_rules IS 'JSON rules for handling negative rates, caps, floors, etc.';

-- Add check constraint for valid indexers
ALTER TABLE public.debts
ADD CONSTRAINT valid_indexer CHECK (
  indexer IS NULL OR 
  indexer IN ('CDI', 'SELIC', 'IPCA', 'Pré-fixado', 'TR', 'IGP-M')
);

-- 2.3 Database Functions for Projection Management

-- Function to calculate monthly rate from annual rate
CREATE OR REPLACE FUNCTION public.calculate_monthly_from_annual(annual_rate numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT POWER(1 + (annual_rate / 100), 1.0/12) - 1;
$$;

-- Function to calculate annual rate from monthly rate
CREATE OR REPLACE FUNCTION public.calculate_annual_from_monthly(monthly_rate numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (POWER(1 + monthly_rate, 12) - 1) * 100;
$$;

-- Function to get the latest rate for a given indexer
CREATE OR REPLACE FUNCTION public.get_latest_indexer_rate(indexer_type text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rate
  FROM public.economic_indices
  WHERE index_type = indexer_type
  ORDER BY reference_date DESC
  LIMIT 1;
$$;

-- Function to get historical rate for a specific date
CREATE OR REPLACE FUNCTION public.get_indexer_rate_for_date(indexer_type text, target_date date)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rate
  FROM public.economic_indices
  WHERE index_type = indexer_type
    AND reference_date <= target_date
  ORDER BY reference_date DESC
  LIMIT 1;
$$;

-- Trigger function to auto-calculate monthly/annual projections
CREATE OR REPLACE FUNCTION public.auto_calculate_projection_rates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If monthly_projection is set but annual_projection is not, calculate annual
  IF NEW.monthly_projection IS NOT NULL AND NEW.annual_projection IS NULL THEN
    NEW.annual_projection := public.calculate_annual_from_monthly(NEW.monthly_projection);
  END IF;
  
  -- If annual_projection is set but monthly_projection is not, calculate monthly
  IF NEW.annual_projection IS NOT NULL AND NEW.monthly_projection IS NULL THEN
    NEW.monthly_projection := public.calculate_monthly_from_annual(NEW.annual_projection);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to index_projections
DROP TRIGGER IF EXISTS calculate_projection_rates ON public.index_projections;
CREATE TRIGGER calculate_projection_rates
BEFORE INSERT OR UPDATE ON public.index_projections
FOR EACH ROW
EXECUTE FUNCTION public.auto_calculate_projection_rates();