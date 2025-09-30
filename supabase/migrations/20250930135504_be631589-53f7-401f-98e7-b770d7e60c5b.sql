-- Add soft delete capability to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for better performance on deleted_at queries
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON public.companies(deleted_at);

-- Create archived_companies table for 30-day backup
CREATE TABLE IF NOT EXISTS public.archived_companies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  industry TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_by UUID NOT NULL,
  CONSTRAINT fk_deleted_by FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS on archived_companies
ALTER TABLE public.archived_companies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for archived_companies
CREATE POLICY "Users can view their archived companies"
ON public.archived_companies
FOR SELECT
USING (deleted_by = auth.uid() OR created_by = auth.uid());

-- Function to archive a company (soft delete)
CREATE OR REPLACE FUNCTION public.archive_company(company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Copy company to archived_companies
  INSERT INTO public.archived_companies (
    id, name, cnpj, industry, created_by, created_at, updated_at, deleted_at, deleted_by
  )
  SELECT 
    id, name, cnpj, industry, created_by, created_at, updated_at, now(), auth.uid()
  FROM public.companies
  WHERE id = company_id;
  
  -- Soft delete the company (set deleted_at)
  UPDATE public.companies
  SET deleted_at = now(), updated_at = now()
  WHERE id = company_id;
END;
$$;

-- Function to permanently delete old archived companies (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_archived_companies()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete archived companies older than 30 days
  WITH deleted AS (
    DELETE FROM public.archived_companies
    WHERE deleted_at < now() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- Update companies RLS policies to exclude soft-deleted companies
DROP POLICY IF EXISTS "Users can view companies they belong to" ON public.companies;
CREATE POLICY "Users can view active companies they belong to"
ON public.companies
FOR SELECT
USING (
  deleted_at IS NULL 
  AND EXISTS (
    SELECT 1
    FROM user_companies
    WHERE user_companies.company_id = companies.id 
    AND user_companies.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view companies they created" ON public.companies;
CREATE POLICY "Users can view active companies they created"
ON public.companies
FOR SELECT
USING (deleted_at IS NULL AND auth.uid() = created_by);

-- Allow company owners to soft delete (update deleted_at)
CREATE POLICY "Company owners can soft delete their companies"
ON public.companies
FOR UPDATE
USING (auth.uid() = created_by AND deleted_at IS NULL)
WITH CHECK (auth.uid() = created_by);