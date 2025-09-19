-- Inserir 12 dívidas de teste para o usuário atual
-- Primeiro vamos obter o usuário atual e empresa
INSERT INTO public.debts (
  company_id,
  created_by,
  title,
  description,
  financed_amount,
  first_due_date,
  last_due_date,
  calculation_table,
  interest_base,
  interest_rate,
  interest_type,
  iof_rate,
  additional_fees
) VALUES
-- Dívida 1: Banco do Brasil - SAC
(
  (SELECT id FROM public.companies LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  'Contrato BB2024001',
  'Financiamento imobiliário Banco do Brasil',
  750000.00,
  '2024-02-15',
  '2044-02-15',
  'SAC',
  'CDI',
  1.35,
  'monthly',
  0.0038,
  2500.00
),
-- Dívida 2: Caixa Econômica Federal - PRICE  
(
  (SELECT id FROM public.companies LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  'Contrato CEF2024002',
  'Financiamento habitacional Caixa',
  920000.00,
  '2024-01-10',
  '2054-01-10',
  'PRICE',
  'IPCA',
  1.52,
  'monthly',
  0.0038,
  3200.00
),
-- Dívida 3: Itaú - SAC
(
  (SELECT id FROM public.companies LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  'Contrato ITAU2024003',
  'Crédito imobiliário Itaú Unibanco',
  680000.00,
  '2024-03-20',
  '2039-03-20',
  'SAC',
  'CDI',
  1.28,
  'monthly',
  0.0038,
  1800.00
),
-- Dívida 4: Santander - PRICE
(
  (SELECT id FROM public.companies LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  'Contrato SAN2024004',
  'Financiamento imobiliário Santander',
  1150000.00,
  '2023-11-05',
  '2048-11-05',
  'PRICE',
  'TR',
  1.89,
  'monthly',
  0.0038,
  4100.00
),
-- Dívida 5: Bradesco - SAC
(
  (SELECT id FROM public.companies LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  'Contrato BRAD2024005',
  'Crédito habitacional Bradesco',
  820000.00,
  '2024-07-12',
  '2034-07-12',
  'SAC',
  'SELIC',
  1.78,
  'monthly',
  0.0038,
  2200.00
),
-- Dívida 6: BTG Pactual - PRICE
(
  (SELECT id FROM public.companies LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  'Contrato BTG2024006',
  'Financiamento corporativo BTG Pactual',
  1050000.00,
  '2024-05-18',
  '2042-05-18',
  'PRICE',
  'CDI',
  2.05,
  'monthly',
  0.0038,
  3800.00
),
-- Dívida 7: XP Investimentos - SAC
(
  (SELECT id FROM public.companies LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  'Contrato XP2024007',
  'Crédito imobiliário XP Investimentos',
  695000.00,
  '2024-08-30',
  '2041-08-30',
  'SAC',
  'IPCA',
  1.42,
  'monthly',
  0.0038,
  1950.00
),
-- Dívida 8: Inter - PRICE
(
  (SELECT id FROM public.companies LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  'Contrato INTER2024008',
  'Financiamento digital Banco Inter',
  780000.00,
  '2024-04-25',
  '2040-04-25',
  'PRICE',
  'CDI',
  1.68,
  'monthly',
  0.0038,
  2100.00
),
-- Dívida 9: Original - SAC
(
  (SELECT id FROM public.companies LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  'Contrato ORG2024009',
  'Crédito imobiliário Banco Original',
  635000.00,
  '2024-06-14',
  '2036-06-14',
  'SAC',
  'TR',
  1.25,
  'monthly',
  0.0038,
  1650.00
),
-- Dívida 10: Safra - PRICE
(
  (SELECT id FROM public.companies LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  'Contrato SAFRA2024010',
  'Financiamento premium Banco Safra',
  1180000.00,
  '2024-09-08',
  '2049-09-08',
  'PRICE',
  'SELIC',
  2.08,
  'monthly',
  0.0038,
  4200.00
),
-- Dívida 11: Nubank - SAC
(
  (SELECT id FROM public.companies LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  'Contrato NU2024011',
  'Crédito imobiliário Nubank',
  890000.00,
  '2024-10-22',
  '2043-10-22',
  'SAC',
  'CDI',
  1.95,
  'monthly',
  0.0038,
  2850.00
),
-- Dívida 12: C6 Bank - PRICE
(
  (SELECT id FROM public.companies LIMIT 1),
  (SELECT id FROM public.profiles LIMIT 1),
  'Contrato C6B2024012',
  'Financiamento inteligente C6 Bank',
  720000.00,
  '2024-12-05',
  '2038-12-05',
  'PRICE',
  'IPCA',
  1.58,
  'monthly',
  0.0038,
  2000.00
);