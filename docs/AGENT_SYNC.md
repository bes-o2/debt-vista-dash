# Agent Sync — debt-vista-dash

> Leia este arquivo antes de qualquer tarefa. Ele é o estado compartilhado entre Claude Code e Codex.

## Última sessão

- **Data:** 2026-04-24
- **Agente:** Claude Code
- **Resumo:** Revisão completa pós-sessão Codex. Foram encontrados e corrigidos 3 bugs críticos, 4 altos e 2 médios introduzidos durante a edição no Codex. Nenhuma migração com problema — schema de garantias está correto.

## O que está funcionando

- **`DashboardStats.tsx`** — hooks `useTooltip` extraídos para sub-componentes (`OutstandingBalanceTooltipWrapper`, `StatCardTooltipIcon`); regra dos hooks do React respeitada
- **`DashboardStats.tsx`** — `getDebtsWithUpcomingDueDate` agora deriva a próxima parcela mensal em vez de usar a data final do contrato (`dueDate`)
- **`CashFlowAnalysis.tsx`** — `normalizedDebts` envolto em `useMemo([debts])`; sem re-renders desnecessários
- **`CashFlowAnalysis.tsx`** — filtro de datas usa campo `isoMonth: string` (formato `YYYY-MM`) no lugar de regex em label localizado pt-BR
- **`ConsolidatedAmortizationTable.tsx`** — `toEdgeShape` corrigido: `principal_balance` não subtrai mais `amortization` (já estava descontado pela Edge Function)
- **`ConsolidatedAmortizationTable.tsx`** — `firstDueDate` usa `debt.firstDueDate` diretamente; fallback para dia 1 do mês seguinte ao `releaseDate`
- **`useDebtGuarantees.tsx`** — DELETE agora inclui `.eq('company_id', companyId)`
- **`DebtProfileChart.tsx`** — acentos corrigidos: "Dívida", "Não foi possível", "amortização", "até"
- **Migrações Supabase** — nenhum problema; `add_debt_guarantees` está correto com RLS, índices e constraints

## Em andamento / incompleto

- **`CfoDashboardV2.tsx`** + **`cfoAlerts.ts`** + **`guaranteeMetrics.ts`** — arquivos criados no Codex, não commitados e não integrados à navegação. Status: existem em disco, mas nenhuma rota ou link aponta para eles ainda
- **CFO Dashboard V2** — plano em `docs/CFO_DASHBOARD_V2_TASKS.md` está na fase de descoberta; nenhuma decisão de produto foi fechada ainda

## Problemas conhecidos

- **`useDebtInstallments.tsx:133`** — query filtra apenas por `debt_id`, sem `company_id` explícito. Não é bug de segurança (RLS via join protege), mas é inconsistente com a convenção do projeto. Deixado sem correção porque `debt_installments` não tem coluna `company_id` direta
- **`getOverdueDebts` em `DashboardStats.tsx`** — mantém `debt.dueDate` (data final do contrato) intencionalmente: um contrato é considerado vencido quando o prazo final passou, não quando uma parcela individual passou. Semanticamente correto para este card específico
- **`useDebtInstallments.tsx`** — `calculateMissingInstallments` não passa `indexerStartDate` para a Edge Function. Pode gerar parcelas incorretas para dívidas pós-fixadas com data de início de indexador. Ainda não investigado em detalhe

## Decisões tomadas

- **`debt_installments` sem `company_id` direto** — o RLS via join com `debts` é suficiente; não vale adicionar a coluna só por consistência sem migração planejada
- **`getOverdueDebts` usa data final** — mantido assim; "contrato vencido" = prazo encerrado, não parcela vencida. Cards diferentes têm semânticas diferentes
- **CFO V2 entra progressivamente** — não substitui a experiência atual; vai entrar como área/tab

## Próximo agente deve fazer

1. Integrar `CfoDashboardV2.tsx` à navegação (rota ou tab em `Index.tsx`) — só depois de decisões de produto fechadas em `docs/CFO_DASHBOARD_V2_TASKS.md`
2. Investigar `calculateMissingInstallments` e o parâmetro `indexerStartDate` faltando
3. Commitar e pushar tudo que está unstaged (19 arquivos modificados + 3 novos)
4. Validar manualmente no browser: tabela consolidada de amortização, filtro de datas no fluxo de caixa, cards de estatísticas

## Não tocar

- **`useEffect` comentado em `pages/Index.tsx:62-67`** — causava loop de 401; não reativar sem estabilizar refs em `useDataInitialization`
- **`src/integrations/supabase/types.ts`** — gerado automaticamente; não editar manualmente
- **Migrações existentes** — nunca editar; sempre criar nova migration
- **`src/components/ui/`** — primitivos shadcn; não editar diretamente
- **Project ID Supabase** — `objvdyjnryvllvadglns`; não misturar com o antigo `zujkmyfwfhjkixlymgiv`

## Contexto rápido para Codex

1. **Inputs monetários**: sempre usar `useBRLInput` + `CurrencyInput` de `src/components/ui/currency-input.tsx`. Nunca `<input type="number">` ou formatação manual
2. **Queries Supabase**: sempre com `enabled: !!selectedCompany?.id`. Toda mutação precisa de `company_id` no payload
3. **Dois tipos de Debt**: `Debt` (banco, snake_case) e `LegacyDebt` (frontend, camelCase). Conversão em `useDebts.tsx`. Ao tocar em tipos, checar os dois caminhos
4. **Commits em português** seguindo Conventional Commits: `feat:`, `fix:`, `chore:`, `revert:`
5. **Texto de UI sempre em pt-BR** com acentos corretos — revisar antes de commitar qualquer string
