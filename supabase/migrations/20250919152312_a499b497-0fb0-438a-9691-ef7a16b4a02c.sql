-- Primeiro, vamos criar uma empresa padrão se não existir
-- e associar ao usuário atual
DO $$
DECLARE
    user_id_var UUID;
    company_id_var UUID;
    profile_user_id UUID;
BEGIN
    -- Pegar o user_id de um perfil existente
    SELECT user_id INTO profile_user_id FROM public.profiles LIMIT 1;
    
    IF profile_user_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum usuário encontrado. Faça login primeiro.';
    END IF;
    
    -- Criar empresa se não existir
    INSERT INTO public.companies (name, created_by, cnpj, industry)
    VALUES ('Empresa Demonstração Ltda', profile_user_id, '12.345.678/0001-99', 'Tecnologia')
    ON CONFLICT DO NOTHING
    RETURNING id INTO company_id_var;
    
    -- Se não retornou ID, buscar empresa existente
    IF company_id_var IS NULL THEN
        SELECT id INTO company_id_var FROM public.companies WHERE created_by = profile_user_id LIMIT 1;
    END IF;
    
    -- Associar usuário à empresa se não existir
    INSERT INTO public.user_companies (user_id, company_id, role)
    VALUES (profile_user_id, company_id_var, 'admin')
    ON CONFLICT DO NOTHING;
    
    -- Agora inserir as 12 dívidas de teste
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
    (company_id_var, profile_user_id, 'Contrato BB2024001', 'Financiamento imobiliário Banco do Brasil', 750000.00, '2024-02-15', '2044-02-15', 'SAC', 'CDI', 1.35, 'monthly', 0.0038, 2500.00),
    -- Dívida 2: Caixa Econômica Federal - PRICE  
    (company_id_var, profile_user_id, 'Contrato CEF2024002', 'Financiamento habitacional Caixa', 920000.00, '2024-01-10', '2054-01-10', 'PRICE', 'IPCA', 1.52, 'monthly', 0.0038, 3200.00),
    -- Dívida 3: Itaú - SAC
    (company_id_var, profile_user_id, 'Contrato ITAU2024003', 'Crédito imobiliário Itaú Unibanco', 680000.00, '2024-03-20', '2039-03-20', 'SAC', 'CDI', 1.28, 'monthly', 0.0038, 1800.00),
    -- Dívida 4: Santander - PRICE
    (company_id_var, profile_user_id, 'Contrato SAN2024004', 'Financiamento imobiliário Santander', 1150000.00, '2023-11-05', '2048-11-05', 'PRICE', 'TR', 1.89, 'monthly', 0.0038, 4100.00),
    -- Dívida 5: Bradesco - SAC
    (company_id_var, profile_user_id, 'Contrato BRAD2024005', 'Crédito habitacional Bradesco', 820000.00, '2024-07-12', '2034-07-12', 'SAC', 'SELIC', 1.78, 'monthly', 0.0038, 2200.00),
    -- Dívida 6: BTG Pactual - PRICE
    (company_id_var, profile_user_id, 'Contrato BTG2024006', 'Financiamento corporativo BTG Pactual', 1050000.00, '2024-05-18', '2042-05-18', 'PRICE', 'CDI', 2.05, 'monthly', 0.0038, 3800.00),
    -- Dívida 7: XP Investimentos - SAC
    (company_id_var, profile_user_id, 'Contrato XP2024007', 'Crédito imobiliário XP Investimentos', 695000.00, '2024-08-30', '2041-08-30', 'SAC', 'IPCA', 1.42, 'monthly', 0.0038, 1950.00),
    -- Dívida 8: Inter - PRICE
    (company_id_var, profile_user_id, 'Contrato INTER2024008', 'Financiamento digital Banco Inter', 780000.00, '2024-04-25', '2040-04-25', 'PRICE', 'CDI', 1.68, 'monthly', 0.0038, 2100.00),
    -- Dívida 9: Original - SAC
    (company_id_var, profile_user_id, 'Contrato ORG2024009', 'Crédito imobiliário Banco Original', 635000.00, '2024-06-14', '2036-06-14', 'SAC', 'TR', 1.25, 'monthly', 0.0038, 1650.00),
    -- Dívida 10: Safra - PRICE
    (company_id_var, profile_user_id, 'Contrato SAFRA2024010', 'Financiamento premium Banco Safra', 1180000.00, '2024-09-08', '2049-09-08', 'PRICE', 'SELIC', 2.08, 'monthly', 0.0038, 4200.00),
    -- Dívida 11: Nubank - SAC
    (company_id_var, profile_user_id, 'Contrato NU2024011', 'Crédito imobiliário Nubank', 890000.00, '2024-10-22', '2043-10-22', 'SAC', 'CDI', 1.95, 'monthly', 0.0038, 2850.00),
    -- Dívida 12: C6 Bank - PRICE
    (company_id_var, profile_user_id, 'Contrato C6B2024012', 'Financiamento inteligente C6 Bank', 720000.00, '2024-12-05', '2038-12-05', 'PRICE', 'IPCA', 1.58, 'monthly', 0.0038, 2000.00);
    
END $$;