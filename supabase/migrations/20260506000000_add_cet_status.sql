CREATE TYPE public.cet_status_enum AS ENUM ('calculado', 'nao_convergiu', 'pendente');

ALTER TABLE public.debts
  ADD COLUMN cet_status public.cet_status_enum NOT NULL DEFAULT 'pendente';

UPDATE public.debts
SET cet_status = 'calculado'
WHERE cet_monthly_rate IS NOT NULL;
