# Plano de Implementacao: Dividas Pos-Fixadas

## Objetivo

Retomar o calculo de dividas pos-fixadas com:

- historico real do BCB ate o ultimo mes completo disponivel;
- projecao futura automatica usando o ultimo valor real disponivel, fixo;
- projecao por empresa;
- cenarios temporarios simples para sensibilidade;
- auditoria por parcela da taxa usada.

## Premissas Fechadas

- Data de referencia da conversa: `2026-05-04`.
- Historico realizado: ate o ultimo mes completo com dado disponivel no BCB.
- Futuro/projecao: mes corrente em aberto e meses posteriores usam projecao.
- Projecao base: sempre usa o ultimo valor real do BCB disponivel, atualizado automaticamente.
- Escopo da projecao: por empresa.
- Cenarios: temporarios, sem salvar nomes/cenarios no banco.
- CDI/SELIC: acumular diariamente no periodo da parcela.
- IPCA: usar taxa mensal de referencia.
- Auditoria: persistir indice, periodo, taxa, fonte e origem/cenario por parcela calculada.

## Arquivos Principais

- `supabase/functions/fetch-bcb-rates/index.ts`
- `supabase/functions/calculate-amortization/index.ts`
- `supabase/functions/calculate-amortization/getEffectiveRate.ts`
- `src/hooks/useEconomicIndices.tsx`
- `src/hooks/useDebtInstallments.tsx`
- `src/components/IndexProjectionsManager.tsx`
- `src/components/SettingsModal.tsx`
- `src/components/AmortizationTable.tsx`
- `src/components/ConsolidatedAmortizationTable.tsx`
- `src/pages/Index.tsx`
- `src/integrations/supabase/types.ts`

## Fase 1 - Banco

Criar migration via `supabase migration new ...`.

Alterar `economic_indices`:

- adicionar constraint unica em `(index_type, reference_date)`;
- garantir que o `upsert` da Edge Function funcione.

Criar tabela de projecao base por empresa:

```sql
company_index_projections
- id
- company_id
- index_type
- projected_rate
- rate_type
- reference_date
- source_reference_date
- source
- created_at
- updated_at
- unique(company_id, index_type)
```

Criar tabela de auditoria:

```sql
debt_installment_rate_refs
- id
- company_id
- debt_id
- installment_number
- index_type
- period_start
- period_end
- rate
- rate_type
- source -- bcb_realizado | projecao_base | cenario_temporario
- scenario_label -- Base | Temporario
- source_reference_date
- created_at
- unique(debt_id, installment_number, index_type)
```

Adicionar RLS:

- `company_index_projections`: usuarios so acessam empresas via `user_companies`.
- `debt_installment_rate_refs`: acesso via `company_id` ou via divida relacionada.
- `economic_indices`: leitura publica autenticada; escrita apenas via service role/Edge Function.

## Fase 2 - Ingestao BCB

Corrigir `fetch-bcb-rates` para:

- continuar buscando CDI, SELIC e IPCA;
- fazer `upsert` confiavel por `(index_type, reference_date)`;
- retornar ultimo valor real por indice;
- nao depender de `limit(3)` global, porque isso pode retornar tres registros do mesmo indice.

Criterios de aceite:

- buscar intervalo historico e gravar sem duplicar;
- retornar ultimo CDI, SELIC e IPCA corretamente.

## Fase 3 - Resolvedor De Taxa

Substituir ou refatorar `getEffectiveRateForDate.ts` para trabalhar por periodo, nao so por data.

Nova funcao conceitual:

```ts
resolveIndexerRate({
  supabaseClient,
  companyId,
  indexer,
  periodStart,
  periodEnd,
  spreadRate,
  temporaryOverrides,
})
```

Retorno esperado:

```ts
{
  effectiveMonthlyRate: number,
  indexerRate: number,
  spreadRate: number,
  source: "bcb_realizado" | "projecao_base" | "cenario_temporario",
  rateType: "daily_accumulated" | "monthly" | "projected",
  sourceReferenceDate: string | null,
}
```

Regras:

- CDI/SELIC realizado: acumular diariamente com `prod(1 + dailyRate / 100) - 1`.
- IPCA realizado: usar mes de referencia.
- Futuro: usar projecao base da empresa.
- Cenario temporario: aplicar override em memoria, sem persistir cenario.

Manter simples na V1:

- preservar a composicao atual do spread, salvo evidencia clara para mudar;
- taxa efetiva do periodo = indice efetivo do periodo + spread convertido ao periodo.

## Fase 4 - Calculo De Parcelas

Atualizar `calculate-amortization/index.ts`:

- receber `companyId`;
- calcular `periodStart` e `periodEnd` de cada parcela;
- chamar o resolvedor por parcela pos-fixada;
- salvar `debt_installments`;
- salvar `debt_installment_rate_refs`;
- limpar auditoria antiga ao recalcular a divida.

Corrigir chamadas que hoje nao passam `spreadRate`:

- `src/components/AmortizationTable.tsx`
- `src/components/ConsolidatedAmortizationTable.tsx`

Criterios de aceite:

- divida CDI antiga usa historico real;
- divida futura usa projecao base;
- auditoria e recriada a cada recalculo.

## Fase 5 - Projecao Base

Criar servico/hook para garantir projecao base por empresa:

- ao abrir configuracoes ou calcular divida, buscar ultimo BCB real;
- criar/atualizar `company_index_projections` para CDI, SELIC e IPCA;
- valor futuro fica fixo com o ultimo real disponivel.

Nao reativar o `useEffect` desativado em `src/pages/Index.tsx`. Fazer isso por acao explicita ou chamada controlada.

## Fase 6 - UI

Em `SettingsModal` / `IndexProjectionsManager`:

- mostrar ultimos valores reais BCB;
- mostrar projecao base por empresa;
- adicionar botao "Atualizar projecao base";
- adicionar controles temporarios simples para sensibilidade:
  - CDI: ajuste em p.p.
  - SELIC: ajuste em p.p.
  - IPCA: ajuste em p.p.
- evitar recalculo a cada movimento de slider; usar botao "Simular" ou debounce.

Nao salvar cenarios nomeados agora.

## Fase 7 - Verificacao

Rodar:

```bash
npm run build
npm run lint
```

Se `npm run lint` falhar por problemas preexistentes, registrar o bloqueio e separar do escopo desta entrega.

Validacao manual:

1. Importar/atualizar historico BCB.
2. Cadastrar divida CDI com parcelas antes de maio/2026.
3. Confirmar auditoria `bcb_realizado`.
4. Cadastrar divida com parcelas futuras.
5. Confirmar auditoria `projecao_base`.
6. Alterar premissa temporaria e simular sem criar cenario no banco.
7. Recalcular e verificar que auditoria antiga foi substituida.

## Cuidados

- Nao editar manualmente `src/integrations/supabase/types.ts`; regenerar com Supabase CLI apos migrations.
- Nao reativar inicializacao automatica em `src/pages/Index.tsx`.
- Manter texto de UI em pt-BR.
- Fazer mudancas cirurgicas, sem refatorar dashboard inteiro.
- Componentes em `src/components/ui/` sao shadcn/ui; evitar edicao manual.
