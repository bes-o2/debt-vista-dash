-- Create default companies for existing users
-- First create a default company for each user that doesn't have one
INSERT INTO companies (name, created_by, cnpj, industry)
SELECT 
  'Minha Empresa' as name,
  p.user_id as created_by,
  null as cnpj,
  null as industry
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_companies uc 
  JOIN companies c ON uc.company_id = c.id 
  WHERE uc.user_id = p.user_id
);

-- Associate users with their default companies
INSERT INTO user_companies (user_id, company_id, role)
SELECT 
  c.created_by as user_id,
  c.id as company_id,
  'owner' as role
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM user_companies uc 
  WHERE uc.user_id = c.created_by 
  AND uc.company_id = c.id
);