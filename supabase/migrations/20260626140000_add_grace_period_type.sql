alter table public.debts
  add column if not exists grace_period_type text not null default 'none';

alter table public.debts
  drop constraint if exists debts_grace_period_type_check;
alter table public.debts
  add constraint debts_grace_period_type_check
  check (grace_period_type in ('none', 'capitalized'));

comment on column public.debts.grace_period_type is 'Tipo de carência: none (sem carência) ou capitalized (juros capitalizados no principal durante a carência, entre indexer_start_date e first_due_date)';
