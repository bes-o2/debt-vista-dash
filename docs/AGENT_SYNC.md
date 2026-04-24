# Agent Sync — debt-vista-dash

> Leia este arquivo antes de qualquer tarefa. Ele é o estado compartilhado entre Claude Code e Codex.

## Última sessão

- **Data:** 2026-04-24
- **Agente:** Claude Code
- **Resumo:** Investigação de 2 cards aparentemente quebrados no dashboard (PMT sumido no "Saldo Devedor por Banco" e "Perfil da Dívida" vazio). Descoberto que o código estava correto — a causa raiz era dado inconsistente no seed da empresa dummy (parcelas de 2007-2016 com saldo residual não zerado). Aplicadas melhorias de robustez e saneamento do seed.

## O que está funcionando

- **`src/pages/Index.tsx`** — `normalizedDebts = useMemo(() => debts.map(normalizeDebtForCalculation), [debts])` estabiliza a referência e é passado para `OutstandingBalanceChart`, `DebtProfileChart` e `DebtChart` (antes cada um fazia seu próprio `.map`, recriando arrays a cada render)
- **`src/lib/debtUtils.ts`** — novo helper exportado `parseLocalDate(value)` que adiciona `T00:00:00` em strings `YYYY-MM-DD` antes de `new Date(...)`, evitando o shift UTC→local em fusos negativos
- **`src/components/OutstandingBalanceChart.tsx`** — tipagem migrada de `LegacyDebt[]` para `NormalizedDebtForCalculation[]`; normalização interna removida; `parseLocalDate` aplicado em `releaseDate` e nas datas de primeira/última parcela
- **`src/components/DebtProfileChart.tsx`** — usa `parseLocalDate` compartilhado; loading state ampliado para cobrir também a janela de corrida onde `installmentsData` tem menos chaves que `debts.length` e não há erro
- **`src/hooks/useDebtInstallments.tsx:89`** — `console.warn` quando um debt é rejeitado por falta de `firstDueDate`/`dueDate`, para diagnóstico rápido em DevTools
- **Aba "CFO V2" removida** do `Index.tsx` — `TabsTrigger` e `TabsContent` apagados; imports órfãos (`CfoDashboardV2`, ícone `Building`) removidos; `TabsList` agora tem `grid-cols-4`
- **Build + lint** — `npm run build` e `npm run lint` passam sem NOVOS erros (27 erros de lint pré-existentes continuam lá)

## Em andamento / incompleto

- **Validação visual dos cards com o novo seed** — usuário ainda não confirmou após rodar as queries SQL abaixo. Esperado: PMT ativo até ~2033, Perfil da Dívida com barras de curto/longo prazo para BB/Bradesco/Caixa (Itaú e Santander já quitados em 2024)
- **`CfoDashboardV2.tsx` + `cfoAlerts.ts` + `guaranteeMetrics.ts`** — permanecem no disco mas agora **desintegrados da UI** (a tab foi removida). Arquivos "dormentes". Se o CFO V2 for retomado, precisa reintegrar

## Problemas conhecidos

- **Seed da empresa dummy `0acc7044-102e-4cb7-84b6-fdbeaec4aec4`** — o estado anterior tinha 12 dívidas de 2007-2016 com última parcela deixando `remaining_balance` ~R$ 684k (número de parcelas incoerente com `financed_amount`). O usuário rodou no SQL editor do Supabase:
  ```sql
  -- 1) Apagar (cascateia em debt_installments e debt_guarantees via ON DELETE CASCADE)
  DELETE FROM debts WHERE company_id = '0acc7044-102e-4cb7-84b6-fdbeaec4aec4';

  -- 2) Inserir 5 novas: BB 2,5M (2015-2025 SAC), Itaú 1,8M (2016-2024 PRICE),
  --    Bradesco 3,2M (2017-2029 SAC), Santander 1,2M (2017-2024 PRICE),
  --    Caixa 5,0M (2018-2033 SAC). Todos pré-fixados, annual.
  ```
  Ver histórico da conversa para SQL completo do INSERT. Não executamos as queries — o usuário roda manualmente
- **Lógica do saldo devedor em `OutstandingBalanceChart`** quando todas as parcelas já venceram: o código pega a última parcela e mostra `remaining_balance` dela — se o cadastro estiver errado (última parcela não zera), o gráfico exibe saldo constante "para sempre". Decisão: manter assim; corrigir dados em vez de mascarar no front

## Decisões tomadas

- **Tipo de entrada dos cards de dashboard uniformizado**: todos recebem `NormalizedDebtForCalculation[]` vindo de um único `useMemo` em `Index.tsx`. Motivo: evita `.map(normalize)` inline que recria arrays e dispara memos downstream
- **`parseLocalDate` centralizado em `debtUtils.ts`**: antes havia um `parseDate` local em `DebtProfileChart` e parses crus com `new Date(YYYY-MM-DD)` em outros lugares (parseavam como UTC). Qualquer comparação de data vinda do banco deve usar o helper
- **CFO V2 desativado da UI** por solicitação do usuário nesta sessão. Código continua versionado — só foi removido da navegação
- **Investigação antes de codar**: bugs reportados não eram bugs de código. Confirmado via debug logs temporários (já removidos). Sempre checar os dados antes de assumir regressão

## Próximo agente deve fazer

1. **Aguardar feedback do usuário** após ele rodar o DELETE + INSERT no Supabase. Validar que PMT aparece até ~2033 e Perfil da Dívida renderiza as barras empilhadas
2. Se o usuário confirmar, considerar deletar os arquivos dormentes (`src/components/CfoDashboardV2.tsx`, `src/lib/cfoAlerts.ts`, `src/lib/guaranteeMetrics.ts`, `docs/CFO_DASHBOARD_V2_TASKS.md`) **apenas se** ele decidir abandonar o CFO V2. Não apagar sem pergunta
3. Investigar `calculateMissingInstallments` em `useDebtInstallments.tsx` — parâmetro `indexerStartDate` não está sendo enviado à edge function (herdado da sessão anterior, continua pendente)
4. Auditar outros cálculos do app para parses de data com `new Date("YYYY-MM-DD")` crus — substituir por `parseLocalDate` para consistência de fuso
5. Nunca reativar a tab CFO V2 sem alinhamento com o usuário

## Não tocar

- **`useEffect` comentado em `pages/Index.tsx:62-67`** — causava loop de 401; não reativar sem estabilizar refs em `useDataInitialization`
- **`src/integrations/supabase/types.ts`** — gerado; não editar manualmente
- **Migrações existentes** — nunca editar; sempre criar nova migration
- **`src/components/ui/`** — primitivos shadcn
- **Project ID Supabase** — `objvdyjnryvllvadglns`; não misturar com o antigo `zujkmyfwfhjkixlymgiv`
- **`console.warn` em `useDebtInstallments.tsx:89-92`** — é diagnóstico útil, deixar

## Contexto rápido para Codex

1. **Datas vindas do banco (`YYYY-MM-DD`) sempre via `parseLocalDate(debtUtils.ts)`**. `new Date("2026-04-24")` parseia como UTC 00:00 e pula para dia anterior em fusos negativos. Exemplo ruim: `const d = new Date(installment.due_date)`. Exemplo correto: `const d = parseLocalDate(installment.due_date); if (!d) return;`
2. **Props de dashboard já vêm normalizadas**: `OutstandingBalanceChart`, `DebtProfileChart` e `DebtChart` recebem `NormalizedDebtForCalculation[]` direto de `normalizedDebts` em `Index.tsx`. NÃO faça `.map(normalizeDebtForCalculation)` dentro do componente ou inline no JSX — quebra a memo
3. **Inputs monetários**: sempre `useBRLInput` + `CurrencyInput` de `src/components/ui/currency-input.tsx`
4. **`debt_installments` é gerado pela edge function `calculate-amortization`**: para recriar parcelas, basta deletar as existentes — o hook detecta a ausência e reinvoca. Não tente popular manualmente via SQL
5. **Commits em pt-BR + Conventional Commits** (`feat:`, `fix:`, `chore:`). Strings de UI sempre em pt-BR com acentos corretos
