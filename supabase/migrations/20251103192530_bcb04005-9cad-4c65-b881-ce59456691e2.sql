-- Delete incorrect installments for Banco do Brasil Rumo Certo contract
-- These were calculated with wrong start date (2024-03-25 instead of 2024-04-25)
DELETE FROM debt_installments 
WHERE debt_id = '82a33447-77a0-4de5-bfaf-2adaecff23e1';