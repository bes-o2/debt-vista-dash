create or replace function public.replace_debt_installment_schedule(
  p_debt_id uuid,
  p_installments jsonb,
  p_rate_refs jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select debts.company_id
    into v_company_id
  from public.debts
  where debts.id = p_debt_id
    and public.user_can_access_company(debts.company_id);

  if v_company_id is null then
    raise exception 'Divida nao encontrada ou sem acesso para substituir parcelas';
  end if;

  if p_installments is null
    or jsonb_typeof(p_installments) <> 'array'
    or jsonb_array_length(p_installments) = 0 then
    raise exception 'Cronograma de parcelas vazio';
  end if;

  if p_rate_refs is not null and jsonb_typeof(p_rate_refs) <> 'array' then
    raise exception 'Referencias de taxa invalidas';
  end if;

  delete from public.debt_installment_rate_refs
  where debt_id = p_debt_id;

  delete from public.debt_installments
  where debt_id = p_debt_id;

  insert into public.debt_installments (
    debt_id,
    installment_number,
    due_date,
    principal_amount,
    interest_amount,
    total_amount,
    remaining_balance
  )
  select
    p_debt_id,
    (item->>'installment_number')::integer,
    (item->>'due_date')::date,
    (item->>'principal_amount')::numeric,
    (item->>'interest_amount')::numeric,
    (item->>'total_amount')::numeric,
    (item->>'remaining_balance')::numeric
  from jsonb_array_elements(p_installments) as item;

  insert into public.debt_installment_rate_refs (
    company_id,
    debt_id,
    installment_number,
    index_type,
    period_start,
    period_end,
    rate,
    rate_type,
    source,
    scenario_label,
    source_reference_date
  )
  select
    v_company_id,
    p_debt_id,
    (item->>'installment_number')::integer,
    item->>'index_type',
    (item->>'period_start')::date,
    (item->>'period_end')::date,
    (item->>'rate')::numeric,
    item->>'rate_type',
    item->>'source',
    coalesce(item->>'scenario_label', 'Base'),
    nullif(item->>'source_reference_date', '')::date
  from jsonb_array_elements(coalesce(p_rate_refs, '[]'::jsonb)) as item;
end;
$$;

revoke all on function public.replace_debt_installment_schedule(uuid, jsonb, jsonb) from public;
grant execute on function public.replace_debt_installment_schedule(uuid, jsonb, jsonb) to authenticated;
