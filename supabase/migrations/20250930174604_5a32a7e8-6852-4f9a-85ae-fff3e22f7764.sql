-- Add CET columns to debts table
ALTER TABLE public.debts
ADD COLUMN cet_monthly_rate numeric,
ADD COLUMN cet_annual_rate numeric;

COMMENT ON COLUMN public.debts.cet_monthly_rate IS 'Custo Efetivo Total (CET) - Monthly rate, calculated and stored at debt creation';
COMMENT ON COLUMN public.debts.cet_annual_rate IS 'Custo Efetivo Total (CET) - Annual rate, calculated and stored at debt creation';

-- Create index for CET queries
CREATE INDEX idx_debts_cet_rates ON public.debts(cet_monthly_rate, cet_annual_rate) WHERE cet_monthly_rate IS NOT NULL;