# Agent Sync - debt-vista-dash

> Leia este arquivo antes de qualquer tarefa. Ele e o estado compartilhado entre Claude Code, Codex e outros agentes.

## Ultima sessao

- **Data:** 2026-05-04
- **Agente:** Codex
- **Resumo:** A task de dividas pos-fixadas foi revisada, corrigida e preparada para checkpoint. O fluxo agora separa calculos oficiais persistidos de simulacoes temporarias (`persist: false`), usa projecao base por empresa e preserva historico realizado para parcelas passadas.

## O que esta funcionando

- `npm run build` passou em 2026-05-04.
- `calculate-amortization` aceita `companyId`, `temporaryOverrides` e `persist`, gravando parcelas/auditoria apenas quando a execucao e oficial.
- Pre-calculo no formulario e simulacoes temporarias usam `persist: false`, evitando gravar `debt_installments`, `debt_installment_rate_refs` e CET oficial.
- Calculo oficial ao salvar divida passa `companyId` e `persist: true`.
- Dividas pos-fixadas usam resolvedor por periodo em `supabase/functions/calculate-amortization/getEffectiveRate.ts`.
- CDI/SELIC realizados acumulam taxas diarias; IPCA realizado usa referencia mensal.
- Periodos futuros usam projecao base por empresa em `company_index_projections`.
- Cenarios temporarios ficam apenas em memoria no hook `useTemporaryScenario`, sem `localStorage`.
- `useDebtInstallments` recalcula em memoria quando ha cenario temporario ativo e evita persistir resultados simulados.
- `fetch-bcb-rates` e `useEconomicIndices` foram ajustados para buscar o ultimo valor por indice sem depender de `limit(3)` global.
- `IndexProjectionsManager` mostra valores BCB, projecao base por empresa e controles simples de cenario temporario.
- Migration `supabase/migrations/20260504000000_post_fixed_debt_support.sql` cria `company_index_projections`, `debt_installment_rate_refs`, RLS e constraint unica para `economic_indices`.

## Em andamento / incompleto

- A migration pos-fixada ainda precisa ser aplicada no Supabase remoto/local antes de validar dados reais.
- `src/integrations/supabase/types.ts` foi atualizado para refletir o schema novo; idealmente regenerar via Supabase CLI apos aplicar a migration.
- Validacao manual no browser ainda nao foi feita nesta sessao.
- `npm run lint` ainda falha por debitos conhecidos do projeto: `no-explicit-any`, interface vazia em `src/components/ui/textarea.tsx`, `require()` em `tailwind.config.ts` e warnings de hooks/Fast Refresh.

## Problemas conhecidos

- A pasta nao rastreada `supabase/supabase/` contem apenas `.temp` do Supabase CLI e nao deve ser commitada.
- O arquivo nao rastreado `scripts/check-card-feedback.mjs` pertence a outra frente e nao deve entrar no checkpoint pos-fixado sem decisao explicita.
- Nao usar `git add -A`: ha artefatos locais e arquivos de outras frentes no worktree.
- O lint aponta erro em `src/components/ConsolidatedAmortizationTable.tsx`, mas o `any` reportado e debito preexistente.

## Decisoes tomadas

- Historico realizado fica fixo e e usado ate o ultimo mes completo com dado disponivel.
- Mes corrente aberto e futuro usam projecao base por empresa.
- Projecao automatica V1 usa o ultimo valor real conhecido, fixo, sem integracao de expectativa BCB nesta fase.
- Cenários continuam temporarios e sem nomes persistidos.
- Auditoria por parcela deve registrar indice, periodo, taxa, fonte e cenario nos calculos oficiais.
- Simulacoes e pre-calculos nunca devem persistir parcelas, CET ou auditoria.
- Proxima feature planejada: transformar sensibilidade em aba propria do Dashboard, com matriz estilo Excel de PMT mensal por choque de taxa e meses futuros.

## Proximo agente deve fazer

1. Conferir `git status --short` antes de qualquer nova alteracao.
2. Aplicar a migration `20260504000000_post_fixed_debt_support.sql` no ambiente correto.
3. Regenerar `src/integrations/supabase/types.ts` com Supabase CLI se possivel.
4. Validar manualmente no app: divida pos-fixada historica, divida futura, auditoria oficial e simulacao temporaria sem persistencia.
5. Para a proxima task, criar branch nova `feat/sensitivity-dashboard` a partir do checkpoint pos-fixado.

## Nao tocar

- `useEffect` desativado em `src/pages/Index.tsx`; causava loop de 401 e nao deve ser reativado sem estabilizar refs em `useDataInitialization`.
- `src/components/ui/`; primitivos shadcn, evitar edicao manual.
- Migrations antigas ja aplicadas; criar nova migration se precisar alterar schema.
- `.env`, `.claude/settings.local.json`, `supabase/.temp/`, `supabase/supabase/` e outros artefatos locais.
- Project ID Supabase atual `objvdyjnryvllvadglns`.

## Contexto rapido para Claude/Kimi/Codex

1. UI sempre em pt-BR; moeda sempre BRL com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
2. Inputs monetarios devem usar `useBRLInput` + `CurrencyInput`; nao criar input de moeda manual.
3. Formato legacy vs database segue importante: `Debt` usa `snake_case`, `LegacyDebt` usa `camelCase`.
4. Qualquer simulacao de sensibilidade deve usar `persist: false`.
5. Projeto nao tem suite de testes configurada; validacao atual e build/lint + browser manual.
