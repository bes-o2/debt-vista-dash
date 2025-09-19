-- Insert 15 dummy debts specifically into Teste 13 company
-- First, delete any existing dummy debts to avoid conflicts
DELETE FROM debts WHERE company_id = 'a8c6a0fd-0232-4830-addc-cf7771923ab1' AND title IN (
  'Banco do Brasil', 'Caixa Econômica Federal', 'Itaú Unibanco', 'Bradesco', 'Santander',
  'Banco Inter', 'Nubank', 'BTG Pactual', 'Original', 'Safra', 'Votorantim', 'Pine', 'C6 Bank', 'XP Investimentos', 'Modal'
);

-- Insert the dummy debts
WITH dummy_debts(seq, amount, rate, calc_table, bank_name) AS (
  VALUES 
    (1, 700000, 1.2, 'SAC', 'Banco do Brasil'),
    (2, 850000, 2.1, 'PRICE', 'Caixa Econômica Federal'),
    (3, 950000, 1.2, 'SAC', 'Itaú Unibanco'),
    (4, 1100000, 2.1, 'PRICE', 'Bradesco'),
    (5, 1250000, 1.2, 'SAC', 'Santander'),
    (6, 1400000, 2.1, 'PRICE', 'Banco Inter'),
    (7, 1500000, 1.2, 'SAC', 'Nubank'),
    (8, 1650000, 2.1, 'PRICE', 'BTG Pactual'),
    (9, 1750000, 1.2, 'SAC', 'Original'),
    (10, 1850000, 2.1, 'PRICE', 'Safra'),
    (11, 1900000, 1.2, 'SAC', 'Votorantim'),
    (12, 1950000, 2.1, 'PRICE', 'Pine'),
    (13, 1980000, 1.2, 'SAC', 'C6 Bank'),
    (14, 2000000, 2.1, 'PRICE', 'XP Investimentos'),
    (15, 1800000, 1.2, 'SAC', 'Modal')
)
INSERT INTO debts (
  company_id,
  created_by,
  title,
  financed_amount,
  first_due_date,
  last_due_date,
  calculation_table,
  interest_base,
  interest_type,
  interest_rate,
  iof_rate,
  additional_fees
)
SELECT 
  'a8c6a0fd-0232-4830-addc-cf7771923ab1'::uuid,
  '0a6c3d29-01ce-4dbe-a879-9bbef6597d97'::uuid,
  dd.bank_name,
  dd.amount,
  CURRENT_DATE + INTERVAL '1 month',
  CURRENT_DATE + INTERVAL '5 years',
  dd.calc_table,
  'Pré-fixado',
  'monthly',
  dd.rate,
  0,
  0
FROM dummy_debts dd;