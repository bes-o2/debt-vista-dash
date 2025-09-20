-- Investigar a situação atual das empresas "Minha Empresa"
SELECT 
    c.id, 
    c.name, 
    c.created_at,
    (SELECT COUNT(*) FROM debts WHERE company_id = c.id) as debt_count,
    (SELECT COUNT(*) FROM user_companies WHERE company_id = c.id) as user_associations
FROM companies c 
WHERE c.name = 'Minha Empresa'
ORDER BY c.created_at;

-- Verificar se existe a empresa específica que tentamos deletar
SELECT * FROM companies WHERE id = '666d585b-2d0e-46d5-9dd6-3af3a4c17ac7';

-- Deletar em ordem correta (parcelas → dívidas → associações → empresa)
-- Primeiro a empresa vazia
DELETE FROM user_companies WHERE company_id = '666d585b-2d0e-46d5-9dd6-3af3a4c17ac7';
DELETE FROM companies WHERE id = '666d585b-2d0e-46d5-9dd6-3af3a4c17ac7';

-- Agora deletar a "Minha Empresa" com dívidas completamente
DELETE FROM debt_installments 
WHERE debt_id IN (
    SELECT id FROM debts WHERE company_id = '3e4abcbe-7754-4695-86c4-acf0d68efd0a'
);

DELETE FROM debts WHERE company_id = '3e4abcbe-7754-4695-86c4-acf0d68efd0a';
DELETE FROM user_companies WHERE company_id = '3e4abcbe-7754-4695-86c4-acf0d68efd0a';
DELETE FROM companies WHERE id = '3e4abcbe-7754-4695-86c4-acf0d68efd0a';

-- Verificação final
SELECT 
    c.id, 
    c.name, 
    c.created_at,
    (SELECT COUNT(*) FROM debts WHERE company_id = c.id) as debt_count
FROM companies c 
WHERE c.name LIKE '%Minha%' OR c.name LIKE '%Teste%'
ORDER BY c.created_at;