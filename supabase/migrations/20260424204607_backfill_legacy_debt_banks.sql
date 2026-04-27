ALTER TABLE public.debts
  ALTER COLUMN bank DROP DEFAULT;

UPDATE public.debts
SET
  bank = btrim(title),
  updated_at = timezone('utc'::text, now())
WHERE (bank IS NULL OR btrim(bank) = '' OR bank = 'Banco do Brasil')
  AND title IS NOT NULL
  AND btrim(title) <> ''
  AND btrim(title) <> 'Banco do Brasil'
  AND (
    btrim(title) ILIKE '%banco%'
    OR btrim(title) ILIKE '%bank%'
    OR btrim(title) ILIKE '%bb%'
    OR btrim(title) ILIKE '%bradesco%'
    OR btrim(title) ILIKE '%btg%'
    OR btrim(title) ILIKE '%bv%'
    OR btrim(title) ILIKE '%caixa%'
    OR btrim(title) ILIKE '%c6%'
    OR btrim(title) ILIKE '%daycoval%'
    OR btrim(title) ILIKE '%inter%'
    OR btrim(title) ILIKE '%itau%'
    OR btrim(title) ILIKE '%itaú%'
    OR btrim(title) ILIKE '%mercantil%'
    OR btrim(title) ILIKE '%modal%'
    OR btrim(title) ILIKE '%nubank%'
    OR btrim(title) ILIKE '%pan%'
    OR btrim(title) ILIKE '%safra%'
    OR btrim(title) ILIKE '%santander%'
    OR btrim(title) ILIKE '%sicredi%'
    OR btrim(title) ILIKE '%sicoob%'
    OR btrim(title) ILIKE '%xp%'
  );
