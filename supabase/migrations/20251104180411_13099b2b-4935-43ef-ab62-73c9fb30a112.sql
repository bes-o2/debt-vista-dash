-- Add rate_type column to economic_indices table
ALTER TABLE public.economic_indices 
ADD COLUMN IF NOT EXISTS rate_type text DEFAULT 'daily' CHECK (rate_type IN ('daily', 'monthly', 'annual'));

-- Update existing records based on index_type
UPDATE public.economic_indices 
SET rate_type = CASE 
  WHEN index_type IN ('CDI', 'SELIC') THEN 'daily'
  WHEN index_type = 'IPCA' THEN 'monthly'
  ELSE 'daily'
END
WHERE rate_type IS NULL OR rate_type = 'daily';

COMMENT ON COLUMN public.economic_indices.rate_type IS 'Tipo de periodicidade da taxa: daily (ao dia), monthly (ao mês), annual (ao ano)';