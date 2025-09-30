-- Add random TAC and IOF amounts (between 800 and 5000) to all debts for "Teste 13" company
UPDATE public.debts
SET 
  iof_rate = 800 + floor(random() * 4201)::numeric,  -- Random between 800 and 5000
  additional_fees = 800 + floor(random() * 4201)::numeric,  -- Random between 800 and 5000
  updated_at = now()
WHERE company_id = (
  SELECT id FROM public.companies WHERE name = 'Teste 13' LIMIT 1
);