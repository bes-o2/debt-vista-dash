DO $$
DECLARE
  -- CODEX: O prompt original sugeria "a0000000-demo-0000-0000-000000000001",
  -- mas "demo" não é hexadecimal e invalida o tipo UUID no Postgres.
  v_company_id UUID := 'a0000000-de00-0000-0000-000000000001';
  v_creator_id UUID;
BEGIN
  SELECT id INTO v_creator_id
  FROM auth.users
  WHERE email ILIKE '%@o2inc.com.br'
  ORDER BY created_at
  LIMIT 1;

  IF v_creator_id IS NULL THEN
    RAISE NOTICE 'Nenhum usuário @o2inc.com.br encontrado. Seed ignorado.';
    RETURN;
  END IF;

  INSERT INTO public.companies (id, name, cnpj, industry, created_by)
  VALUES (
    v_company_id,
    'Empresa Demo O2',
    '00.000.000/0001-02',
    'Demonstração',
    v_creator_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    cnpj = EXCLUDED.cnpj,
    industry = EXCLUDED.industry,
    updated_at = timezone('utc'::text, now());

  INSERT INTO public.user_companies (user_id, company_id, role)
  SELECT id, v_company_id, 'admin'
  FROM auth.users
  WHERE email ILIKE '%@o2inc.com.br'
  ON CONFLICT (user_id, company_id) DO NOTHING;

  -- CODEX: O schema atual usa interest_type para periodicidade da taxa
  -- ("monthly"/"annual"). Pré/pós-fixado é representado por interest_base,
  -- indexer e spread_rate, seguindo DebtForm/useDebts.
  INSERT INTO public.debts (
    id,
    company_id,
    created_by,
    financed_amount,
    first_due_date,
    last_due_date,
    calculation_table,
    interest_base,
    interest_rate,
    interest_type,
    bank,
    indexer,
    iof_rate,
    spread_rate,
    title,
    description
  )
  VALUES
    (
      'a0000000-deb1-0000-0000-000000000001',
      v_company_id,
      v_creator_id,
      2000000,
      DATE '2024-01-15',
      DATE '2025-12-15',
      'SAC',
      'Pré-fixado',
      1.15,
      'monthly',
      'Bradesco',
      NULL,
      0.38,
      NULL,
      'Capital de giro Bradesco',
      'Contrato demo pré-fixado em SAC'
    ),
    (
      'a0000000-deb2-0000-0000-000000000002',
      v_company_id,
      v_creator_id,
      5000000,
      DATE '2023-06-01',
      DATE '2026-05-01',
      'PRICE',
      'CDI',
      1.5,
      'monthly',
      'Itaú BBA',
      'CDI',
      0.38,
      1.5,
      'Financiamento corporativo Itaú BBA',
      'Contrato demo pós-fixado em CDI'
    ),
    (
      'a0000000-deb3-0000-0000-000000000003',
      v_company_id,
      v_creator_id,
      3500000,
      DATE '2025-01-01',
      DATE '2028-12-01',
      'SAC',
      'IPCA',
      1.5,
      'monthly',
      'Santander',
      'IPCA',
      0.38,
      1.5,
      'Expansão operacional Santander',
      'Contrato demo pós-fixado em IPCA'
    ),
    (
      'a0000000-deb4-0000-0000-000000000004',
      v_company_id,
      v_creator_id,
      8000000,
      DATE '2022-06-01',
      DATE '2027-05-01',
      'PRICE',
      'Pré-fixado',
      1.05,
      'monthly',
      'BNDES',
      NULL,
      0.38,
      NULL,
      'Projeto de investimento BNDES',
      'Contrato demo pré-fixado em PRICE'
    ),
    (
      'a0000000-deb5-0000-0000-000000000005',
      v_company_id,
      v_creator_id,
      1200000,
      DATE '2025-07-01',
      DATE '2027-06-01',
      'SAC',
      'CDI',
      1.5,
      'monthly',
      'Caixa Econômica',
      'CDI',
      0.38,
      1.5,
      'Linha de capital Caixa Econômica',
      'Contrato demo pós-fixado em CDI'
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.debt_guarantees (
    id,
    debt_id,
    company_id,
    type,
    value,
    description
  )
  VALUES
    (
      'b0000000-0001-0000-0000-000000000001',
      'a0000000-deb1-0000-0000-000000000001',
      v_company_id,
      'imovel',
      3000000,
      'Sede da empresa'
    ),
    (
      'b0000000-0002-0000-0000-000000000002',
      'a0000000-deb2-0000-0000-000000000002',
      v_company_id,
      'recebiveis',
      2500000,
      'Cessão de recebíveis Itaú'
    ),
    (
      'b0000000-0004-0000-0000-000000000004',
      'a0000000-deb4-0000-0000-000000000004',
      v_company_id,
      'fianca',
      8000000,
      'Fiança BNDES integral'
    )
  ON CONFLICT (id) DO NOTHING;
END $$;
