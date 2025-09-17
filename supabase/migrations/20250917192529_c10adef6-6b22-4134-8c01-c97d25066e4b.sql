-- Inserir o usuário eduardo.dagostini@o2inc.com.br diretamente na tabela auth.users
-- Nota: Isso normalmente seria feito através da API administrativa, mas vamos simular o processo

-- Primeiro, vamos criar uma função temporária para criar o usuário
CREATE OR REPLACE FUNCTION create_user_admin(
  user_email TEXT,
  user_password TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
  encrypted_pw TEXT;
BEGIN
  -- Gerar um UUID para o novo usuário
  new_user_id := gen_random_uuid();
  
  -- Hash básico da senha (em produção, o Supabase faz isso automaticamente)
  encrypted_pw := crypt(user_password, gen_salt('bf'));
  
  -- Inserir o usuário na tabela auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    user_email,
    encrypted_pw,
    NOW(), -- Email já confirmado
    NOW(),
    NOW(),
    'authenticated',
    'authenticated'
  );
  
  RETURN new_user_id;
END;
$$;

-- Criar o usuário do Eduardo
SELECT create_user_admin('eduardo.dagostini@o2inc.com.br', '000000');

-- Remover a função temporária
DROP FUNCTION create_user_admin(TEXT, TEXT);