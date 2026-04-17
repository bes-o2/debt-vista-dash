-- Add bank column to debts table
-- This separates the bank name from the title, improving data structure and queries
ALTER TABLE public.debts ADD COLUMN bank TEXT DEFAULT 'Banco do Brasil';

-- Create index for bank filtering (used in charts and filters)
CREATE INDEX idx_debts_bank ON public.debts(bank);
