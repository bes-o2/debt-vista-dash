-- Migration: Suporte a dívidas pós-fixadas com projeção por empresa e auditoria de taxas

-- 1. Adicionar constraint única em economic_indices para upsert confiável
with duplicated_indices as (
  select
    id,
    row_number() over (
      partition by index_type, reference_date
      order by updated_at desc, created_at desc, id desc
    ) as row_number
  from public.economic_indices
)
delete from public.economic_indices
where id in (
  select id
  from duplicated_indices
  where row_number > 1
);

alter table public.economic_indices
  add constraint economic_indices_index_type_reference_date_key
  unique (index_type, reference_date);

-- 2. Criar tabela de projeção base por empresa
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

-- 3. Criar tabela de auditoria de taxas por parcela
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

-- 4. RLS em company_index_projections
alter table public.company_index_projections enable row level security;

 create policy company_index_projections_select
  on public.company_index_projections
  for select
  to authenticated
  using (
    company_id in (
      select company_id from public.user_companies where user_id = auth.uid()
    )
  );

 create policy company_index_projections_insert
  on public.company_index_projections
  for insert
  to authenticated
  with check (
    company_id in (
      select company_id from public.user_companies where user_id = auth.uid()
    )
  );

 create policy company_index_projections_update
  on public.company_index_projections
  for update
  to authenticated
  using (
    company_id in (
      select company_id from public.user_companies where user_id = auth.uid()
    )
  )
  with check (
    company_id in (
      select company_id from public.user_companies where user_id = auth.uid()
    )
  );

 create policy company_index_projections_delete
  on public.company_index_projections
  for delete
  to authenticated
  using (
    company_id in (
      select company_id from public.user_companies where user_id = auth.uid()
    )
  );

-- 5. RLS em debt_installment_rate_refs
alter table public.debt_installment_rate_refs enable row level security;

 create policy debt_installment_rate_refs_select
  on public.debt_installment_rate_refs
  for select
  to authenticated
  using (
    company_id in (
      select company_id from public.user_companies where user_id = auth.uid()
    )
  );

 create policy debt_installment_rate_refs_insert
  on public.debt_installment_rate_refs
  for insert
  to authenticated
  with check (
    company_id in (
      select company_id from public.user_companies where user_id = auth.uid()
    )
  );

 create policy debt_installment_rate_refs_update
  on public.debt_installment_rate_refs
  for update
  to authenticated
  using (
    company_id in (
      select company_id from public.user_companies where user_id = auth.uid()
    )
  )
  with check (
    company_id in (
      select company_id from public.user_companies where user_id = auth.uid()
    )
  );

 create policy debt_installment_rate_refs_delete
  on public.debt_installment_rate_refs
  for delete
  to authenticated
  using (
    company_id in (
      select company_id from public.user_companies where user_id = auth.uid()
    )
  );

-- 6. RLS em economic_indices: leitura pública autenticada, escrita apenas via service role (bypass RLS)
alter table public.economic_indices enable row level security;

 create policy economic_indices_select_authenticated
  on public.economic_indices
  for select
  to authenticated
  using (true);

-- A escrita é feita pela Edge Function com service role key, que bypassa RLS
-- Não criamos policy de insert/update para authenticated users

-- 7. Índices para performance
 create index if not exists idx_economic_indices_type_date
  on public.economic_indices(index_type, reference_date);

 create index if not exists idx_debt_installment_rate_refs_debt_id
  on public.debt_installment_rate_refs(debt_id);

 create index if not exists idx_company_index_projections_company_id
  on public.company_index_projections(company_id);

-- 8. Trigger para atualizar updated_at em company_index_projections
 create or replace function public.update_updated_at_column()
 returns trigger as $$
 begin
   new.updated_at = now();
   return new;
 end;
 $$ language plpgsql;

 create trigger update_company_index_projections_updated_at
  before update on public.company_index_projections
  for each row
  execute function public.update_updated_at_column();
