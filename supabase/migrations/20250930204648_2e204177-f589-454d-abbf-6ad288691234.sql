-- Phase 1: Critical Database Security Fixes

-- =====================================================
-- 1. RESTRICT ECONOMIC INDICES ACCESS
-- =====================================================

-- Drop the overly permissive policy that allows anyone to manage economic indices
DROP POLICY IF EXISTS "Economic indices can be managed by system" ON public.economic_indices;

-- Create restrictive policies for economic indices
-- Users can only read economic indices
CREATE POLICY "Users can view economic indices"
ON public.economic_indices
FOR SELECT
TO authenticated
USING (true);

-- Only service role can insert economic indices
CREATE POLICY "Service role can insert economic indices"
ON public.economic_indices
FOR INSERT
TO service_role
WITH CHECK (true);

-- Only service role can update economic indices
CREATE POLICY "Service role can update economic indices"
ON public.economic_indices
FOR UPDATE
TO service_role
USING (true);

-- Only service role can delete economic indices
CREATE POLICY "Service role can delete economic indices"
ON public.economic_indices
FOR DELETE
TO service_role
USING (true);

-- =====================================================
-- 2. FIX COMPANY CREATION POLICY
-- =====================================================

-- Drop the temporary permissive policy
DROP POLICY IF EXISTS "Temporary company creation policy" ON public.companies;

-- Add CNPJ uniqueness constraint if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'companies_cnpj_unique'
  ) THEN
    ALTER TABLE public.companies 
    ADD CONSTRAINT companies_cnpj_unique UNIQUE (cnpj);
  END IF;
END $$;

-- Create proper company creation policy with validation
CREATE POLICY "Users can create companies with proper validation"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be authenticated
  auth.uid() IS NOT NULL
  -- User must match created_by
  AND auth.uid() = created_by
  -- Company name must be provided and not empty
  AND name IS NOT NULL 
  AND trim(name) != ''
  -- CNPJ if provided must not be empty
  AND (cnpj IS NULL OR trim(cnpj) != '')
);