CREATE TABLE public.debt_guarantees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('imovel', 'veiculo', 'equipamento', 'fianca', 'aval', 'recebiveis', 'outros')),
    value NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (value >= 0),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_debt_guarantees_debt_id ON public.debt_guarantees(debt_id);
CREATE INDEX idx_debt_guarantees_company_id ON public.debt_guarantees(company_id);

ALTER TABLE public.debt_guarantees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view guarantees of their companies"
  ON public.debt_guarantees FOR SELECT
  USING (public.user_can_access_company(company_id));

CREATE POLICY "Users can insert guarantees for their companies"
  ON public.debt_guarantees FOR INSERT
  WITH CHECK (public.user_can_access_company(company_id));

CREATE POLICY "Users can update guarantees of their companies"
  ON public.debt_guarantees FOR UPDATE
  USING (public.user_can_access_company(company_id));

CREATE POLICY "Users can delete guarantees of their companies"
  ON public.debt_guarantees FOR DELETE
  USING (public.user_can_access_company(company_id));
