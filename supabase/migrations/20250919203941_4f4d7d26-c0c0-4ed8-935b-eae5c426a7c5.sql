-- Drop the problematic "System can manage installments" policy
DROP POLICY IF EXISTS "System can manage installments" ON public.debt_installments;

-- Create specific policies for debt_installments
-- Allow users to insert installments for debts they can access
CREATE POLICY "Users can insert installments for their accessible debts" 
ON public.debt_installments 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM debts
    JOIN user_companies ON (debts.company_id = user_companies.company_id)
    WHERE debts.id = debt_installments.debt_id
      AND user_companies.user_id = auth.uid()
  )
);

-- Allow users to update installments for debts they can access
CREATE POLICY "Users can update installments for their accessible debts" 
ON public.debt_installments 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM debts
    JOIN user_companies ON (debts.company_id = user_companies.company_id)
    WHERE debts.id = debt_installments.debt_id
      AND user_companies.user_id = auth.uid()
  )
);

-- Allow users to delete installments for debts they can access
CREATE POLICY "Users can delete installments for their accessible debts" 
ON public.debt_installments 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1
    FROM debts
    JOIN user_companies ON (debts.company_id = user_companies.company_id)
    WHERE debts.id = debt_installments.debt_id
      AND user_companies.user_id = auth.uid()
  )
);