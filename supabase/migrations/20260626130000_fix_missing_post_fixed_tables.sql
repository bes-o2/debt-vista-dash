-- Corrective migration.
--
-- 20260504000000_post_fixed_debt_support.sql is recorded as applied on the
-- remote, but its table-creation content never actually ran there (content
-- drift between the recorded migration and the local file). As a result
-- company_index_projections and debt_installment_rate_refs were MISSING in
-- production — which is the real reason post-fixed debts could not be saved or
-- calculated ("Could not find the table public.company_index_projections").
--
-- This recreates only the missing objects, idempotently. The economic_indices
-- unique constraint and RLS from that migration already exist on the remote
-- (the BCB upsert relies on them and works), so they are intentionally NOT
-- touched here.

-- 1. Projeção base por empresa
create table if not exists public.company_index_projections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  index_type text not null,
  projected_rate numeric not null,
  rate_type text not null default 'projected',
  reference_date date not null default current_date,
  source_reference_date date,
  source text not null default 'BCB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_index_projections_company_id_index_type_key
    unique (company_id, index_type)
);

comment on table public.company_index_projections is 'Projeção base de índices econômicos por empresa, fixada no último valor real do BCB';

-- 2. Auditoria de taxa por parcela
create table if not exists public.debt_installment_rate_refs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  installment_number integer not null,
  index_type text not null,
  period_start date not null,
  period_end date not null,
  rate numeric not null,
  rate_type text not null,
  source text not null check (source in ('bcb_realizado', 'projecao_base', 'cenario_temporario')),
  scenario_label text not null default 'Base',
  source_reference_date date,
  created_at timestamptz not null default now(),
  constraint debt_installment_rate_refs_debt_installment_index_key
    unique (debt_id, installment_number, index_type)
);

comment on table public.debt_installment_rate_refs is 'Auditoria da taxa efetiva usada em cada parcela calculada de dívidas pós-fixadas';

-- 3. RLS
alter table public.company_index_projections enable row level security;
alter table public.debt_installment_rate_refs enable row level security;

drop policy if exists company_index_projections_select on public.company_index_projections;
create policy company_index_projections_select
  on public.company_index_projections for select to authenticated
  using (company_id in (select company_id from public.user_companies where user_id = auth.uid()));

drop policy if exists company_index_projections_insert on public.company_index_projections;
create policy company_index_projections_insert
  on public.company_index_projections for insert to authenticated
  with check (company_id in (select company_id from public.user_companies where user_id = auth.uid()));

drop policy if exists company_index_projections_update on public.company_index_projections;
create policy company_index_projections_update
  on public.company_index_projections for update to authenticated
  using (company_id in (select company_id from public.user_companies where user_id = auth.uid()))
  with check (company_id in (select company_id from public.user_companies where user_id = auth.uid()));

drop policy if exists company_index_projections_delete on public.company_index_projections;
create policy company_index_projections_delete
  on public.company_index_projections for delete to authenticated
  using (company_id in (select company_id from public.user_companies where user_id = auth.uid()));

drop policy if exists debt_installment_rate_refs_select on public.debt_installment_rate_refs;
create policy debt_installment_rate_refs_select
  on public.debt_installment_rate_refs for select to authenticated
  using (company_id in (select company_id from public.user_companies where user_id = auth.uid()));

drop policy if exists debt_installment_rate_refs_insert on public.debt_installment_rate_refs;
create policy debt_installment_rate_refs_insert
  on public.debt_installment_rate_refs for insert to authenticated
  with check (company_id in (select company_id from public.user_companies where user_id = auth.uid()));

drop policy if exists debt_installment_rate_refs_update on public.debt_installment_rate_refs;
create policy debt_installment_rate_refs_update
  on public.debt_installment_rate_refs for update to authenticated
  using (company_id in (select company_id from public.user_companies where user_id = auth.uid()))
  with check (company_id in (select company_id from public.user_companies where user_id = auth.uid()));

drop policy if exists debt_installment_rate_refs_delete on public.debt_installment_rate_refs;
create policy debt_installment_rate_refs_delete
  on public.debt_installment_rate_refs for delete to authenticated
  using (company_id in (select company_id from public.user_companies where user_id = auth.uid()));

-- 4. Índices
create index if not exists idx_debt_installment_rate_refs_debt_id
  on public.debt_installment_rate_refs(debt_id);

create index if not exists idx_company_index_projections_company_id
  on public.company_index_projections(company_id);

-- 5. Trigger updated_at em company_index_projections
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_company_index_projections_updated_at on public.company_index_projections;
create trigger update_company_index_projections_updated_at
  before update on public.company_index_projections
  for each row
  execute function public.update_updated_at_column();
