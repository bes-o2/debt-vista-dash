-- Create debt_installments table for storing calculated installments
CREATE TABLE public.debt_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  principal_balance DECIMAL(15,2) NOT NULL,
  amortization DECIMAL(15,2) NOT NULL,
  interest_amount DECIMAL(15,2) NOT NULL,
  indexer_rate DECIMAL(8,4) DEFAULT 0,
  installment_amount DECIMAL(15,2) NOT NULL,
  days_in_period INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;

-- Create policies for debt_installments
CREATE POLICY "Users can view their own debt installments" 
ON public.debt_installments 
FOR SELECT 
USING (debt_id IN (SELECT id FROM public.debts WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own debt installments" 
ON public.debt_installments 
FOR INSERT 
WITH CHECK (debt_id IN (SELECT id FROM public.debts WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own debt installments" 
ON public.debt_installments 
FOR UPDATE 
USING (debt_id IN (SELECT id FROM public.debts WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own debt installments" 
ON public.debt_installments 
FOR DELETE 
USING (debt_id IN (SELECT id FROM public.debts WHERE user_id = auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_debt_installments_debt_id ON public.debt_installments(debt_id);
CREATE INDEX idx_debt_installments_installment_number ON public.debt_installments(debt_id, installment_number);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_debt_installments_updated_at
BEFORE UPDATE ON public.debt_installments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate debt amortization
CREATE OR REPLACE FUNCTION public.calculate_debt_amortization(
  p_debt_id UUID,
  p_financed_amount DECIMAL,
  p_release_date DATE,
  p_due_date DATE,
  p_calculation_table TEXT,
  p_interest_rate DECIMAL,
  p_interest_type TEXT DEFAULT 'monthly',
  p_indexer TEXT DEFAULT NULL,
  p_iof_amount DECIMAL DEFAULT 0,
  p_tac_amount DECIMAL DEFAULT 0
)
RETURNS TABLE(
  installment_number INTEGER,
  due_date DATE,
  principal_balance DECIMAL,
  amortization DECIMAL,
  interest_amount DECIMAL,
  indexer_rate DECIMAL,
  installment_amount DECIMAL,
  days_in_period INTEGER
) AS $$
DECLARE
  v_total_months INTEGER;
  v_monthly_rate DECIMAL;
  v_remaining_balance DECIMAL;
  v_amortization_amount DECIMAL;
  v_interest_amount DECIMAL;
  v_installment_amount DECIMAL;
  v_current_date DATE;
  v_days_in_period INTEGER;
  v_price_factor DECIMAL;
  i INTEGER;
BEGIN
  -- Calculate total months between release and due date
  v_total_months := EXTRACT(YEAR FROM AGE(p_due_date, p_release_date)) * 12 + 
                   EXTRACT(MONTH FROM AGE(p_due_date, p_release_date));
  
  -- Convert interest rate to monthly if needed
  IF p_interest_type = 'annual' THEN
    v_monthly_rate := POWER(1 + p_interest_rate / 100, 1.0/12) - 1;
  ELSE
    v_monthly_rate := p_interest_rate / 100;
  END IF;
  
  -- Initialize remaining balance (add IOF and TAC to financed amount)
  v_remaining_balance := p_financed_amount + COALESCE(p_iof_amount, 0) + COALESCE(p_tac_amount, 0);
  
  -- Calculate PRICE factor if needed
  IF p_calculation_table = 'PRICE' THEN
    v_price_factor := v_monthly_rate * POWER(1 + v_monthly_rate, v_total_months) / 
                     (POWER(1 + v_monthly_rate, v_total_months) - 1);
  END IF;
  
  -- Generate installments
  FOR i IN 1..v_total_months LOOP
    -- Calculate due date for this installment
    v_current_date := p_release_date + INTERVAL '1 month' * i;
    
    -- Calculate days in period (simplified to 30 days for now)
    v_days_in_period := 30;
    
    -- Calculate interest for this period
    v_interest_amount := v_remaining_balance * v_monthly_rate;
    
    -- Calculate amortization based on table type
    IF p_calculation_table = 'SAC' THEN
      -- SAC: Fixed amortization
      v_amortization_amount := p_financed_amount / v_total_months;
      v_installment_amount := v_amortization_amount + v_interest_amount;
    ELSE
      -- PRICE: Fixed installment
      v_installment_amount := v_remaining_balance * v_price_factor;
      v_amortization_amount := v_installment_amount - v_interest_amount;
    END IF;
    
    -- Return the installment data
    installment_number := i;
    due_date := v_current_date;
    principal_balance := v_remaining_balance;
    amortization := v_amortization_amount;
    interest_amount := v_interest_amount;
    indexer_rate := 0; -- Will be updated with real indexer rates later
    installment_amount := v_installment_amount;
    days_in_period := v_days_in_period;
    
    RETURN NEXT;
    
    -- Update remaining balance
    v_remaining_balance := v_remaining_balance - v_amortization_amount;
    
    -- Stop if balance is paid off
    IF v_remaining_balance <= 0.01 THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;