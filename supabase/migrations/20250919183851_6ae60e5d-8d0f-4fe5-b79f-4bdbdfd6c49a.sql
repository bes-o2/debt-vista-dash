-- Allow creators to view their companies immediately after insert
CREATE POLICY IF NOT EXISTS "Users can view companies they created"
ON public.companies
FOR SELECT
USING (auth.uid() = created_by);