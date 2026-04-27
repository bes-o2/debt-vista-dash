# Inventário de widgets e métricas — Dashboard principal

> Gerado em 2026-04-27. Escopo: `src/pages/Index.tsx` e os 5 widgets do dashboard principal.
> Referência de implementação: `docs/MAIN_DASHBOARD_CFO_REVIEW.md` (Epic 1, DSH-001).

---

## 1. Widgets e suas métricas

### GlobalFilters (`src/components/GlobalFilters.tsx`)

| # | O que captura | Semantica |
|---|---|---|
| 1 | Banco (`selectedBank`) | Filtra contratos pelo campo `bank` |
| 2 | Sistema de amortização (`selectedCalculationType`) | SAC / PRICE / Todos |
| 3 | Dívidas específicas (`selectedDebts`) | Multi-select por id |
| 4 | Período (`startDate`, `endDate`) | **Sem semântica definida** — cada widget interpreta diferente (ver seção 3) |

Props de controle: sem estado interno, totalmente controlado por `Index.tsx`.

---

### DashboardStats (`src/components/DashboardStats.tsx`)

**Dados de entrada:**
- `debts: LegacyDebt[]` (formato normalizado, cadastro apenas — sem `debt_installments`)
- `useEconomicIndices()` → `latestRates.CDI`
- `startDate?`, `endDate?`, `selectedBank?`, `selectedCalculationType?`, `selectedDebtIds?`

**Filtro de período aplicado:** vigência do contrato via `debtIntersectsDateRange` (`:146-154`).

| Métrica | Fórmula resumida | Fonte | Arquivo:linha |
|---|---|---|---|
| Saldo devedor atual | SAC: `saldo0 - amortMensal * mesesDecorridos`; PRICE: `PMT * (1-(1+r)^-n) / r` a partir de `releaseDate` + `financedAmount` | Cadastro (analítico) | `:43` |
| PMT corrente | SAC: `amort + juros sobre saldo atual`; PRICE: `PMT fixo` | Cadastro (analítico) | `:157` |
| Vencimentos próximos (30d) | Data de cada contrato: `releaseDate + N*30d` (loop) | Cadastro | `:205,225` |
| Distribuição SAC/PRICE | Contagem simples de `calculationTable` | Cadastro | `:235` |
| CET médio ponderado | `Σ(CETi * saldoi) / Σsaldoi` | `cet_monthly_rate` → fallback annual → fallback taxa de juros | `:261` |
| Prazo médio restante | `Σ(mesesRestantesi * saldoi) / Σsaldoi` | Cadastro | `:285` |
| Spread vs CDI | `CETanual - CDI_anual` | Cadastro + `useEconomicIndices` | `:280-281` |

---

### OutstandingBalanceChart (`src/components/OutstandingBalanceChart.tsx`)

**Dados de entrada:**
- `debts: NormalizedDebtForCalculation[]`
- `useDebtInstallments(filteredDebts)` → **usa parcelas reais**
- `startDate?`, `endDate?`, horizon `12m | 24m | total`

**Filtro de período aplicado:** vigência do contrato via `debtIntersectsDateRange` (`:169`).

| Métrica | Fórmula resumida | Fonte | Arquivo:linha |
|---|---|---|---|
| Saldo analítico (fallback) | **Duplicata literal de DashboardStats:43** | Cadastro | `:76` |
| PMT corrente analítico (fallback) | **Duplicata literal de DashboardStats:157** | Cadastro | `:114` |
| Série de saldo por banco/mês | `remaining_balance` da última parcela ≤ mês (por banco) | `debt_installments` | `:195` |
| PMT do mês | `Σ total_amount` das parcelas de cada banco no mês | `debt_installments` | `:195` |
| Caixa liberado | `max(0, PMT[hoje] - PMT[m])` | `debt_installments` | `:273` |
| Concentração por banco | Share de cada banco no saldo do mês corrente | `debt_installments` | `:335` |
| KPIs do card (saldo/PMT + deltas) | Compara mês atual vs anterior na série | `debt_installments` | `:290` |

**Detalhe:** `horizon` (12m/24m/total) recorta janela adicional em torno do mês corrente, **desconectado** do `endDate` global.

---

### DebtProfileChart (`src/components/DebtProfileChart.tsx`)

**Dados de entrada:**
- `debts: Debt[]` (formato DB)
- `useDebtInstallments(filteredDebts)` → usa parcelas; fallback: `estimateFutureAmortization`
- `startDate?`, `endDate?`, `dateType`, `customDate` (data base própria)

**Filtro de período aplicado:** vigência do contrato via `debtIntersectsDateRange` (`:342`).

| Métrica | Fórmula resumida | Fonte | Arquivo:linha |
|---|---|---|---|
| Saldo analítico (fallback) | **Terceira duplicata de DashboardStats:43** | Cadastro | `:175` |
| Curto prazo (<12m da data base) | `Σ principal_amount` das parcelas com `due_date < baseDate + 12m` | `debt_installments` | `:360` |
| Longo prazo (≥12m da data base) | `Σ principal_amount` das parcelas com `due_date >= baseDate + 12m` | `debt_installments` | `:360` |
| Totais e shares | Soma e percentuais sobre o total | `debt_installments` | `:463` |

**Detalhe:** `dateType / customDate` define a data base do split 12m/longo — **terceira semântica de período**, completamente desacoplada do range global.

---

### DebtChart (`src/components/DebtChart.tsx`)

**Dados de entrada:**
- `debts: Debt[]`
- `useDebtInstallments(baseDebts)`
- `startDate?`, `endDate?`, `selectedBank?`, `selectedIndexerType`

**Filtro de período aplicado:** vigência do contrato via `debtIntersectsDateRange` (`:184`).

| Métrica | Fórmula resumida | Fonte | Arquivo:linha |
|---|---|---|---|
| Principal/saldo por banco (viewType `total`) | `Σ financedAmount` por banco | Cadastro | `:219` |
| Juros estimados totais (viewType `total`) | `Σ interest_amount` de todas as parcelas | `debt_installments` | `:252` |
| Saldo atual por banco (viewType `atual`) | `remaining_balance` da próxima parcela futura | `debt_installments` | `:219` |
| Juros futuros por banco (viewType `atual`) | `Σ interest_amount` com `due_date >= hoje` | `debt_installments` | `:252` |
| CET médio ponderado (por `financedAmount`) | `Σ(CETi * financedAmounti) / ΣfinancedAmount` | Cadastro | `:127` |
| Juros estimados (fallback sem parcelas) | `principal * rate * meses * 0.5` | Cadastro | `:148` |

**Detalhe:** `selectedIndexerType` filtra "pré" vs "pós" via `isPreFixedIndexer`.

---

### CashFlowAnalysis (`src/components/CashFlowAnalysis.tsx`)

**Dados de entrada:**
- `debts: Debt[]` (formato DB)
- `useDebtInstallments(normalizedDebts)` → **usa parcelas reais**
- `selectedBanks`, `selectedDebts`, `startDate`, `endDate` **próprios** (não recebe range global)

**Filtro de período aplicado:** `due_date` da parcela ≥ `startDate` e ≤ `endDate` (`:199-213`) — **semântica de vencimento de parcela**, diferente de todos os outros.

| Métrica | Fórmula resumida | Fonte | Arquivo:linha |
|---|---|---|---|
| Fluxo mensal por banco/dívida | `Σ remaining_balance`, `principal_amount`, `interest_amount`, `total_amount` por mês | `debt_installments` | `:161` |
| Fluxo acumulado | Somatório progressivo do mensal | `debt_installments` | `:65` |
| Saldo remanescente total | `remaining_balance` da última parcela de cada contrato | `debt_installments` | `:267` |
| Total pago / total juros | `Σ total_amount` / `Σ interest_amount` das parcelas filtradas | `debt_installments` | `:267` |

---

## 2. Mapa de duplicações

| Cálculo duplicado | Ocorrências | Impacto |
|---|---|---|
| Saldo SAC/PRICE analítico | `DashboardStats:43`, `OutstandingBalanceChart:76`, `DebtProfileChart:175`, `NetDebtCard:32` (morto) | 4× — origem de bugs silenciosos se fórmula mudar |
| PMT corrente SAC/PRICE analítico | `DashboardStats:157`, `OutstandingBalanceChart:114` | 2× |
| Conversão `interestType` annual→monthly | `DashboardStats:54,170`, `OutstandingBalanceChart:92,127`, `DebtProfileChart:170`, `DebtChart:154`, `NetDebtCard:51`, `Index.tsx:765` | 6× |
| `termInMonths` via 30.44 | Inside de todos os saldos analíticos | 4× |
| Juros futuros por parcela (reduce `interest_amount >= hoje`) | `DebtChart:252-264` e `:318-330` | 2× no mesmo arquivo |
| Filtro banco/calculationType | `GlobalFilters`, `DashboardStats:147-151`, `Index.tsx:346-368` | 3× |

---

## 3. Semântica do filtro de período por widget

| Widget | Semântica | Função usada | Recebe range global? |
|---|---|---|---|
| DashboardStats | Vigência do contrato | `debtIntersectsDateRange` | Sim |
| OutstandingBalanceChart | Vigência do contrato + horizon próprio | `debtIntersectsDateRange` + `horizon` local | Sim (+ horizon ignora endDate) |
| DebtProfileChart | Vigência do contrato + data base própria | `debtIntersectsDateRange` + `dateType/customDate` | Sim (+ data base ignora range) |
| DebtChart | Vigência do contrato | `debtIntersectsDateRange` | Sim |
| CashFlowAnalysis | Vencimento de parcela | `installment.due_date` dentro do range | **Não** (filtros próprios) |

**Problema identificado:** o usuário pode definir um range global e cada widget aplica regras distintas sem qualquer indicação visual. A semântica oficial adotada a partir do DSH-003 é:
- **Vigência** (padrão): contrato ativo no período — `debtIntersectsDateRange(debt, start, end)`
- **Vencimento de parcelas**: `installment.due_date` está dentro do range

---

## 4. Funções reutilizáveis para DSH-002

| Necessidade | Função | Local |
|---|---|---|
| Normalizar Debt DB/Legacy | `normalizeDebtForCalculation` | `src/lib/debtUtils.ts:94` |
| Filtro de vigência | `debtIntersectsDateRange` | `src/lib/debtUtils.ts:60` |
| Saldo a partir de installments | `calculateOutstandingBalance` | `src/lib/debtUtils.ts:135` |
| Parse de datas TZ-safe | `parseLocalDate` | `src/lib/debtUtils.ts:40` |
| CET por contrato/batch/banco/sistema/portfólio | `calculateBatchCET`, `calculateWeightedAverageCET`, `calculateCETByBank`, `calculatePortfolioCET` | `src/lib/cetCalculator.ts` |
| Métricas de garantia | `calculateGuaranteeMetrics` | `src/lib/guaranteeMetrics.ts:55` |
| TIR / IRR (base do CET com parcelas reais) | `calculateIRRFromCashFlows` | `src/lib/irrCalculator.ts:46` |
| Tipo-alvo para alertas | `CfoExecutiveMetrics` | `src/lib/cfoAlerts.ts:32` |
| Cor por banco | `getBankColor` | `src/lib/utils.ts:58` |
| Tooltips dos KPIs | `TOOLTIP_REGISTRY` | `src/lib/tooltips.ts:38` |

---

## 5. Contrato esperado — DashboardMetrics

O hook `useDashboardMetrics` (DSH-002) deve produzir um objeto compatível com `CfoExecutiveMetrics` (`src/lib/cfoAlerts.ts:32`) e expandido com os campos de apresentação dos widgets:

```ts
interface DashboardMetrics extends CfoExecutiveMetrics {
  // KPIs principais
  currentOutstandingBalance: number;
  outstandingByBank: { bank: string; balance: number; share: number }[];
  outstandingByIndexer: { indexer: string; balance: number; share: number }[];
  currentPMT: number;
  pmtNext30d: number;
  pmtNext90d: number;
  pmtNext180d: number;
  peakMonthlyPmt12m: { month: string; total: number };
  maturitiesNext12Months: number;
  upcomingDueDates: { debtId: string; bank: string; dueDate: Date; amount: number }[];
  // Custo
  averageMonthlyCET: number;
  averageAnnualCET: number;
  cdiSpread: number;
  // Estrutura
  averageRemainingTerm: number;
  sacVsPriceCount: { sac: number; price: number };
  concentrationByBank: { bank: string; balance: number; share: number }[];
  concentrationByIndexer: { indexer: string; balance: number; share: number }[];
  // Garantias (passthrough)
  guaranteeCoverage: GuaranteeMetrics;
  // Liquidez (sem dados de caixa hoje)
  netDebt: null;
  // Meta
  period: { start: Date | null; end: Date | null; mode: 'vigencia' | 'vencimento' };
}
```

---

## 6. Débitos técnicos registrados (fora deste Epic)

| Item | Status | Epic alvo |
|---|---|---|
| Migrar OutstandingBalanceChart, DebtProfileChart, DebtChart, CashFlowAnalysis para useDashboardMetrics | Pendente | Epic 2 (DSH-004) |
| Aplicar semântica de período em OutstandingBalanceChart, DebtProfileChart, DebtChart | Pendente | Epic 2 |
| Suite de testes automatizados para dashboardMetrics.ts | Sem infraestrutura | Backlog (DSH-016 e posteriores) |
| Resolver 8 erros / 14 warnings de lint pré-existentes | Pendente | DSH-016 |
| Avaliar drag-and-drop @dnd-kit | Pendente | DSH-011 |
