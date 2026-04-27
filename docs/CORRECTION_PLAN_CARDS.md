# Plano de Correção — Inconsistências nos Cards do Dashboard

> Gerado em 2026-04-27 após análise multi-agente.
> Execute as fases em ordem. Fase 1 tem impacto maior e mudanças cirúrgicas.

---

## Contexto

Foram identificados bugs e inconsistências nos cards do dashboard principal (`DashboardStats`, `OutstandingBalanceChart`, `DebtProfileChart`, `DebtChart`) e na tabela de amortização (`AmortizationTable`). Os problemas foram divididos em três fases por prioridade.

---

## Fase 1 — Bugs críticos (números claramente errados)

### 1.1 `iofAmount` com unidade errada

**Arquivo:** `src/hooks/useDebts.tsx:236`

**Problema:** `convertToLegacyFormat` copia `debt.iof_rate` (percentual, ex: `0.38`) diretamente para `LegacyDebt.iofAmount`, que deveria ser BRL. O CET desconta centavos de IOF em vez de reais.

**Correção:**
```ts
// Antes
iofAmount: debt.iof_rate || 0,

// Depois
iofAmount: debt.iof_rate != null ? (debt.financed_amount * debt.iof_rate) / 100 : 0,
```

**Referência do correto:** `src/pages/Index.tsx:130-132` e `src/lib/debtUtils.ts:77-78`.

---

### 1.2 SAC "Parcela Corrente" mostra mês 1, não o mês atual

**Arquivo:** `src/components/DashboardStats.tsx`, função `totalCurrentPMT` (~linha 144-175)

**Problema:** Para contratos SAC, o PMT exibido é sempre o do primeiro mês (mais alto). Um contrato com 36 meses decorridos mostra parcela ~60% maior do que a real.

**Correção:** Calcular os juros sobre o saldo devedor atual, não sobre o principal original.

Dentro do bloco SAC da função `totalCurrentPMT`, substituir:
```ts
// Antes — juros sobre saldo cheio
const interest = (debt.financedAmount * monthlyRate);
const amortization = debt.financedAmount / termMonths;
```
Por:
```ts
// Depois — juros sobre saldo devedor no mês atual
const elapsedMonths = Math.round((today.getTime() - releaseDate.getTime()) / (30.44 * 24 * 3600 * 1000));
const currentBalance = Math.max(0, debt.financedAmount - (debt.financedAmount / termMonths) * elapsedMonths);
const interest = currentBalance * monthlyRate;
const amortization = debt.financedAmount / termMonths;
```

Verificar a lógica exata em volta do bloco SAC antes de editar — o padrão de variáveis pode diferir.

---

### 1.3 `Math.ceil` vs `Math.round` para prazo — inconsistência entre PMT e saldo

**Arquivo:** `src/components/DashboardStats.tsx`

**Problema:**
- `calculateDebtOutstandingBalance` (linha ~42): usa `Math.round` para `termInMonths` e `monthsElapsed`.
- Função `totalCurrentPMT` (linha ~147): usa `Math.ceil` para `termMonths`.

Para contratos cujo prazo cai exatamente num mês-limite, PMT e saldo devedor partem de prazos diferentes.

**Correção:** Padronizar para `Math.round` em ambas as funções, alinhando com a lógica de `calculateDebtOutstandingBalance`.

Buscar todas as ocorrências de `Math.ceil` dentro de `totalCurrentPMT` relacionadas ao cálculo de prazo e substituir por `Math.round`.

---

### 1.4 Prazo Médio ponderado por `financedAmount`, não por saldo devedor

**Arquivo:** `src/components/DashboardStats.tsx:276`

**Problema:** O tooltip diz "ponderado por saldo devedor atual", mas o código usa `debt.financedAmount` como peso. Contratos antigos (quase quitados) têm peso desproporcional.

**Correção:** Substituir o peso de `financedAmount` pelo saldo devedor calculado.

```ts
// Antes
const weight = debt.financedAmount;

// Depois
const weight = calculateDebtOutstandingBalance(debt, today);
```

Garantir que `calculateDebtOutstandingBalance` já está disponível no escopo (é uma função definida no mesmo arquivo).

---

### 1.5 `startDate` do CET diverge entre Edge Function e `useCETManager`

**Problema:**
- `supabase/functions/calculate-amortization/index.ts:139`: usa `firstDueDate` como t=0 do fluxo.
- `src/hooks/useCETManager.tsx:91`: usa `releaseDate` (= `firstDueDate - 1 mês`) como t=0.

O CET persistido no banco e o CET calculado em runtime divergem porque o horizonte temporal é diferente.

**Decisão:** Alinhar ambos para usar `releaseDate` como t=0 (data real do desembolso).

**Correção em `supabase/functions/calculate-amortization/index.ts`:** Localizar onde `startDate` é passado para `calculateCET` e trocar de `firstDueDate` para `releaseDate`.

**Atenção:** Após essa mudança, o CET recalculado será ligeiramente diferente do que está salvo em contratos existentes. Testar com um contrato de referência antes de commitar.

---

## Fase 2 — Inconsistências de lógica divergente entre componentes

### 2.1 CET médio: ponderado em `DashboardStats`, simples em `DebtChart`

**Arquivo:** `src/components/DebtChart.tsx:274-297`

**Problema:** `DashboardStats` calcula CET médio ponderado por saldo devedor. `DebtChart` usa média aritmética simples (não ponderada). Os dois cards mostram "CET médio" com valores potencialmente diferentes para a mesma carteira.

**Correção:** Substituir a média simples do `DebtChart` por média ponderada por `financedAmount` (ou saldo devedor, se disponível no escopo).

```ts
// Antes
const avgCET = totalCET / debtsWithCET.length;

// Depois
const totalWeight = debtsWithCET.reduce((sum, d) => sum + d.financedAmount, 0);
const avgCET = totalWeight > 0
  ? debtsWithCET.reduce((sum, d) => sum + (d.cet_annual_rate * d.financedAmount), 0) / totalWeight
  : 0;
```

---

### 2.2 Filtro global de banco não chega ao `DebtChart`

**Arquivos:** `src/pages/Index.tsx`, `src/components/DebtChart.tsx`

**Problema:** `DebtChart` tem filtro interno de banco (`selectedBanks`) desconectado do `globalSelectedBank` emitido por `GlobalFilters`.

**Correção:**
1. Em `Index.tsx`, passar `globalSelectedBank` como prop para `DebtChart`.
2. Em `DebtChart.tsx`, usar a prop recebida como filtro inicial (ou substituir o estado interno pela prop).
3. Se o filtro interno for mantido para refinamento adicional, ele deve partir do filtro global como valor inicial.

---

### 2.3 Filtro global de data não chega a nenhum card do dashboard

**Arquivos:** `src/pages/Index.tsx`, `src/components/DashboardStats.tsx` e gráficos

**Problema:** `globalStartDate` e `globalEndDate` são coletados por `GlobalFilters` mas propagados apenas para `ConsolidatedAmortizationTable`. Os cards de KPI e os três gráficos ignoram o filtro de período.

**Correção:**
1. Adicionar props `startDate?: string` e `endDate?: string` em `DashboardStats` e nos três componentes de gráfico.
2. Em `DashboardStats`, filtrar `filteredDebts` para incluir apenas dívidas cujo período de vigência intersecta o intervalo selecionado.
3. Em `Index.tsx`, passar `globalStartDate` e `globalEndDate` para todos esses componentes.

**Nota:** Definir a semântica de "filtro de data" para dívidas — se é pelo `releaseDate`, pelo `dueDate` ou por interseção do período. Alinhar semantica com o `GlobalFilters` antes de implementar.

---

### 2.4 Classificação pré/pós-fixado incorreta em `DebtChart`

**Arquivo:** `src/components/DebtChart.tsx:136-139`

**Problema:** `!debt.indexer` retorna `false` para a string `'Pré-fixado'`, classificando esses contratos incorretamente como pós-fixados.

**Correção:**
```ts
// Antes
const isPreFixado = !debt.indexer;

// Depois
const isPreFixado = !debt.indexer || debt.indexer === 'Pré-fixado' || debt.indexer === 'Pre-fixado';
```

Verificar se há outras strings possíveis para pré-fixado no banco (`interest_base` pode ter variações). Consultar `src/lib/tooltips.ts` para ver os valores canônicos.

---

## Fase 3 — Problemas menores e limpeza

### 3.1 `convertLegacyDebt` salva `releaseDate` em `first_due_date`

**Arquivo:** `src/hooks/useDebts.tsx:209`

**Problema:** Afeta apenas migração de dados do localStorage. Contratos migrados têm `firstDueDate` adiantado 1 mês.

**Correção:**
```ts
// Antes
first_due_date: legacyDebt.releaseDate,

// Depois
first_due_date: legacyDebt.firstDueDate,
```

---

### 3.2 Coluna "Saldo Devedor" na `AmortizationTable` mostra saldo pós-amortização

**Arquivo:** `src/components/AmortizationTable.tsx:297`

**Problema:** `principal_balance - amortization` é o saldo no início do próximo período. A coluna deveria mostrar o saldo antes do pagamento ou ser renomeada.

**Opção A (correção semântica):** Exibir `installment.principal_balance` (saldo antes da amortização da parcela).

**Opção B (renomear):** Manter o cálculo atual e renomear a coluna para "Saldo Final" ou "Saldo após parcela".

---

### 3.3 `calculateWeightedAverageCET` pondera anual e mensal separadamente

**Arquivo:** `src/lib/cetCalculator.ts:96-99`

**Problema:** A média ponderada aritmética de taxas anuais não equivale a anualizar a média ponderada das mensais (relação não-linear via `(1+r)^12`).

**Correção:** Ponderar apenas a taxa mensal e derivar a anual.

```ts
// Depois de calcular weightedMonthly:
const weightedAnnual = (Math.pow(1 + weightedMonthly / 100, 12) - 1) * 100;
```

Remover o bloco de ponderação separada para `annualRate`.

---

### 3.4 Verificar e possivelmente remover `useCET.tsx`

**Arquivo:** `src/hooks/useCET.tsx`

**Problema:** Implementação paralela do CET usando base temporal por índice de parcela (não por dias reais). Possivelmente não é mais usada no dashboard principal.

**Tarefa:**
1. Buscar importações de `useCET` em todo o projeto (`grep -r "useCET" src/`).
2. Se não houver importações ativas (apenas o próprio arquivo), remover `useCET.tsx`.
3. Se houver uso ativo, alinhar a implementação com `cetCalculator.ts` (base por dias reais).

---

## Ordem de execução recomendada

```
1.1 → 1.3 → 1.2 → 1.4 → 1.5
2.4 → 2.1 → 2.2 → 2.3
3.4 → 3.3 → 3.1 → 3.2
```

Itens da Fase 1 podem ser feitos em sequência sem dependências entre si, exceto 1.2 que depende da padronização de `Math.round` feita em 1.3.

---

## Verificação após implementação

Para cada fase, verificar no browser:
- "Saldo Devedor Atual" e "Parcela Corrente" mostram valores coerentes (saldo ≈ PMT × prazo_restante para PRICE).
- Para contratos SAC maduros, "Parcela Corrente" deve ser menor do que o valor original da primeira parcela.
- "Prazo Médio Restante" deve ser coerente com os vencimentos dos contratos visíveis.
- "CET Média" em `DashboardStats` e no gráfico de barras de `DebtChart` devem ser próximos (ambos ponderados).
- Filtro de banco global deve refletir no gráfico de comparação por banco.

---

## Status de execução - 2026-04-27

**Agente:** Codex

**Status geral:** implementado no código, com build de produção validado. A validação visual no browser ainda precisa ser feita com dados reais/representativos.

### Itens concluídos

- **1.1** `iofAmount` agora é convertido de percentual para BRL em `src/hooks/useDebts.tsx`.
- **1.2 e 1.3** `DashboardStats` calcula PMT SAC com juros sobre o saldo devedor atual e usa `Math.round` para prazo, alinhado com o cálculo de saldo.
- **1.4** Prazo médio restante agora é ponderado pelo saldo devedor atual.
- **1.5** `supabase/functions/calculate-amortization/index.ts` passa `releaseDate` como `startDate` do CET, derivado de `firstDueDate - 1 mês`.
- **2.1** `DebtChart` calcula CET médio ponderado por `financedAmount`.
- **2.2** `Index.tsx` passa `globalSelectedBank` para `DebtChart`; o gráfico restringe a base quando o filtro global está ativo.
- **2.3** `DashboardStats`, `OutstandingBalanceChart`, `DebtProfileChart` e `DebtChart` recebem `startDate`/`endDate` e filtram a carteira.
- **2.4** `DebtChart` classifica pré-fixado por normalização de string, cobrindo `Pré-fixado`, `Pre-fixado`, `pre fixado`, `prefixado` e `PRE_FIXADO`.
- **3.1** Migração legacy salva `legacyDebt.firstDueDate` em `first_due_date`.
- **3.2** `AmortizationTable` usa a opção A: coluna "Saldo Devedor" mostra `principal_balance` antes da amortização.
- **3.3** `calculateWeightedAverageCET` pondera a taxa mensal e deriva a anual por capitalização composta.
- **3.4** `src/hooks/useCET.tsx` foi removido; busca por `useCET` só encontrou `useCETManager`.

### Decisões tomadas durante a execução

- O filtro global de data significa **interseção** entre a vigência da dívida (`releaseDate` até `dueDate`) e o intervalo selecionado.
- O helper `debtIntersectsDateRange` foi adicionado em `src/lib/debtUtils.ts` para manter essa semântica igual entre KPIs e gráficos.
- Em `DebtChart`, o filtro interno de bancos continua existindo como refinamento quando o filtro global está em "todos"; quando há banco global selecionado, a base já fica restrita a esse banco.
- O `CLAUDE.md` não deve receber mais detalhes deste plano. Para contexto de sessão, usar `docs/AGENT_SYNC.md` e este arquivo.

### Verificação feita

- `npm run build` passou em 2026-04-27.
- `npm run lint` ainda falha por débitos existentes do projeto, incluindo `no-explicit-any`, interface vazia em `src/components/ui/textarea.tsx`, `require()` em `tailwind.config.ts` e warnings de hooks/Fast Refresh. Não foi tratado neste plano.
- `git diff --check` dos arquivos tocados neste plano passou; restam avisos normais de CRLF no Windows.

### Verificação ainda recomendada

1. Abrir o dashboard no browser e validar visualmente com contratos SAC maduros que "Parcela Corrente" diminui ao longo do tempo.
2. Confirmar que "CET Média" em `DashboardStats` e no `DebtChart` ficam coerentes para a mesma carteira filtrada.
3. Testar filtros globais de banco e datas nos quatro cards/gráficos do dashboard.
4. Recalcular uma dívida de referência pela edge function e conferir a diferença esperada do CET salvo após mudar o t=0 para `releaseDate`.
