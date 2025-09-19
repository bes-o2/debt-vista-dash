-- Fix infinite recursion in user_companies RLS policies
-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Company creators can manage user associations" ON user_companies;

-- Create a simpler policy that doesn't cause recursion
-- Users can manage their own company associations
CREATE POLICY "Users can manage their own company associations" 
ON user_companies 
FOR ALL 
USING (auth.uid() = user_id);

-- Company owners can manage user associations for their companies
-- This uses a direct check without causing recursion
CREATE POLICY "Company owners can manage associations" 
ON user_companies 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM companies 
    WHERE companies.id = user_companies.company_id 
    AND companies.created_by = auth.uid()
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM companies 
    WHERE companies.id = user_companies.company_id 
    AND companies.created_by = auth.uid()
  )
);