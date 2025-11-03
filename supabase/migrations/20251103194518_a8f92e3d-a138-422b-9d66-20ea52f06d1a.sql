-- Remove parcelas incorretas para o contrato Banco do Brasil (Rumo Certo)
DELETE FROM public.debt_installments 
WHERE debt_id = '82a33447-77a0-4de5-bfaf-2adaecff23e1';