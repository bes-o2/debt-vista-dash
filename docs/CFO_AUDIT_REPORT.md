# Auditoria Financeira — Dashboard CFO

> Auditoria da lógica financeira (SAC, PRICE, CET, TIR) e sua representação no Dashboard.
> Escopo: arquivos de cálculo (`src/lib`), edge function `calculate-amortization`, hooks de dados e cards do dashboard.
> Data: 2026-05-05 · Branch: `feature/modal-selecao-empresa`

---

## 1. Resumo Executivo

**Confiança geral: MÉDIA.**

O núcleo de cálculo (SAC/PRICE no edge function, IRR/CET via Newton-Raphson) está bem estruturado e segue as fórmulas padrão. A representação no dashboard prioriza **parcelas reais** persistidas no banco, com fallbacks analíticos quando necessário — uma decisão correta.

A confiança não é Alta porque **a mesma métrica é calculada por funções diferentes em cada componente**, com pequenas variações que produzem números visualmente próximos mas não idênticos. Em particular:

- O **spread** de contratos pós-fixados é incluído no cálculo do dashboard (`dashboardMetrics`) mas **ignorado** nos fallbacks analíticos de `OutstandingBalanceChart` e `DebtProfileChart`.
- "Dívida Líquida" é hardcoded **igual à Dívida Bruta** porque não há campo de caixa/equivalente, mas o sistema de alertas opera sobre essa métrica como se fosse real.
- O **CET médio** é ponderado por **financedAmount** em `cetCalculator.ts` e por **saldo devedor** em `dashboardMetrics.ts` — duas verdades coexistem.

Não há bugs matemáticos graves identificados, mas há ambiguidades semânticas (especialmente o significado de `remaining_balance`) que merecem alinhamento antes que o dashboard seja usado para decisões de refinanciamento.

---

## 2. Arquitetura do Fluxo de Dados

### Camadas

| Camada | Responsabilidade |
|---|---|
| **Banco (Postgres)** | Persiste contratos (`debts`), parcelas calculadas (`debt_installments`), CET por contrato (`debts.cet_*`), histórico de taxas usadas (`debt_installment_rate_refs`) e índices econômicos (`economic_indices`, `index_projections`). |
| **Edge Function (Deno)** | `calculate-amortization` — única fonte de verdade para gerar o cronograma SAC/PRICE e calcular o CET via IRR. Chamado tanto na criação quanto on-demand quando faltam parcelas. |
| **Hooks de dados (React)** | `useDebts` (CRUD), `useDebtInstallments` (busca parcelas; aciona o edge function se faltarem), `useDashboardMetrics` (orquestra agregações), `useEconomicIndices` (CDI/SELIC/IPCA). |
| **Lib pura (`src/lib`)** | `dashboardMetrics.ts` (KPIs do header), `cetCalculator.ts` + `irrCalculator.ts` (CET por TIR), `debtUtils.ts` (normalização e saldo legado). |
| **Componentes** | `DashboardStats` (cards de KPIs), `OutstandingBalanceChart` (saldo por banco + KPIs próprios), `DebtProfileChart` (curto vs longo prazo), `DebtChart` (comparativo). Cada um faz suas próprias agregações. |

### User Story end-to-end

```
1. CFO cadastra dívida via DebtForm
   └── handleSaveDebt (Index.tsx:188)
       ├── createDebtAsync → INSERT em `debts`
       └── syncDebtInstallments → invoca edge function `calculate-amortization`
           ├── Para SAC: amortização constante = financiado / N
           │   parcela = amortização + saldo × taxa_efetiva_do_período
           ├── Para PRICE pré-fixado: PMT fixa pela fórmula clássica
           ├── Para PRICE pós-fixado: PMT recalculada a cada período
           │   usando saldo remanescente e a taxa efetiva resolvida
           ├── Resolve indexador (CDI/SELIC/IPCA) via `getEffectiveRate.ts`
           │   consulta `economic_indices` (passado) ou `index_projections` (futuro)
           ├── DELETE + INSERT em `debt_installments`
           └── Calcula CET via IRR (Newton-Raphson) e UPDATE em `debts.cet_*_rate`

2. CFO abre Dashboard
   └── useDashboardMetrics (useDashboardMetrics.tsx:21)
       ├── useDebts → SELECT * FROM debts WHERE company_id = …
       ├── useDebtInstallments → SELECT * FROM debt_installments WHERE debt_id IN (…)
       │   └── Se algum debt está sem parcelas → invoca edge function on-the-fly
       ├── useDebtGuarantees → métricas de garantias
       ├── useEconomicIndices → última taxa CDI conhecida
       └── computeDashboardMetrics(…) → agrega tudo em DashboardMetrics

3. Componentes renderizam
   ├── DashboardStats consome `metrics.*` (números prontos)
   ├── OutstandingBalanceChart e DebtProfileChart **refazem** o cálculo
   │   localmente com seus próprios useDebtInstallments e fórmulas analíticas
   └── Cards mostram KPIs com tooltips estáticos + popovers de
       pseudocódigo (CalculationInfoPopover ← src/lib/calculationRules.ts)
```

**Pegadinha estrutural:** os dados do dashboard descem em duas trilhas paralelas. `DashboardStats` lê de `dashboardMetrics`. `OutstandingBalanceChart` e `DebtProfileChart` reimplementam fórmulas analíticas próprias. Isso explica boa parte das divergências da §4.

---

## 3. Mapa de Fluxo por Métrica

| Métrica | Onde é calculada | Persistida? | Dinâmica (depende de índice)? | Arquivo:Linha |
|---|---|---|---|---|
| **Saldo Devedor (parcela)** | Edge function — guarda `remaining_balance` por parcela | Sim (`debt_installments.remaining_balance`) | Sim p/ pós-fixado | `supabase/functions/calculate-amortization/index.ts:430-440` |
| **Saldo Devedor Atual (KPI)** | `dashboardMetrics` — lê próx. parcela; fallback analítico | Não (recalcula a cada render) | Indireta (via parcelas persistidas) | `src/lib/dashboardMetrics.ts:243-251` |
| **Saldo Devedor (gráfico Banco)** | `OutstandingBalanceChart` — KPIs analíticos próprios + série mensal por parcelas | Não | Não no fallback (ignora indexador) | `src/components/OutstandingBalanceChart.tsx:76-111, 195-254` |
| **Saldo Devedor (Perfil Dívida)** | `DebtProfileChart` — analítico próprio + parcelas | Não | Não no fallback | `src/components/DebtProfileChart.tsx:175-217` |
| **PMT (parcela do mês)** | Edge function — `installment_amount` por parcela | Sim (`debt_installments.total_amount`) | Sim p/ pós-fixado | `supabase/functions/calculate-amortization/index.ts:430-440` |
| **PMT Corrente (KPI)** | `dashboardMetrics` — próx. parcela; fallback analítico | Não | Indireta | `src/lib/dashboardMetrics.ts:253-263, 149-185` |
| **PMT 30/90/180d, pico 12m** | `dashboardMetrics` — soma `total_amount` por janela | Não | Indireta | `src/lib/dashboardMetrics.ts:265-308` |
| **CET por contrato** | Edge function — IRR (Newton-Raphson, anual ↔ mensal) | Sim (`debts.cet_monthly_rate`, `debts.cet_annual_rate`) | Sim (depende das parcelas) | `supabase/functions/calculate-amortization/index.ts:482-574` |
| **CET média (carteira)** | `dashboardMetrics` — recalcula via `calculateBatchCET`, pondera pelo saldo | Não | Sim | `src/lib/dashboardMetrics.ts:328-360` |
| **CET média (cetCalculator)** | `calculateWeightedAverageCET` — pondera pelo financedAmount | Não | Sim | `src/lib/cetCalculator.ts:86-112` |
| **TIR (IRR)** | Implementação dupla (TS no front + Deno na edge) | Não | Depende dos cash flows | `src/lib/irrCalculator.ts:46-114` e `…/index.ts:482-574` |
| **Spread médio sobre CDI** | `averageAnnualCET − cdiAnnualRate` | Não | Sim (CDI atual do BCB) | `src/lib/dashboardMetrics.ts:361` |
| **Prazo médio restante** | Diff calendário entre `releaseDate` e `dueDate`, ponderado pelo saldo | Não | Não | `src/lib/dashboardMetrics.ts:363-382` |
| **Dívida Bruta** | Igual a `currentOutstandingBalance` | Não | — | `src/components/DashboardStats.tsx:213-214` |
| **Dívida Líquida** | **Hardcoded = Dívida Bruta** (caixa não rastreado) | Não | — | `src/components/DashboardStats.tsx:213-217`; `dashboardMetrics.ts:434` (`netDebt: null`) |
| **Concentração por banco/indexador** | Soma do saldo agrupado | Não | Indireta | `src/lib/dashboardMetrics.ts:390-411` |
| **Cobertura de garantias** | `useDebtGuarantees` agrega valores cadastrados | Sim (em `debt_guarantees`) | Não | `src/hooks/useDebtGuarantees.tsx` (não auditado em detalhe aqui) |

---

## 4. Divergências e Inconsistências

### 4.1 Saldo Devedor — três fórmulas analíticas paralelas

A mesma "Saldo Devedor Atual" tem três implementações analíticas independentes para quando não há parcelas persistidas:

| Implementação | Diff de meses | Inclui spread? | Arquivo:Linha |
|---|---|---|---|
| `dashboardMetrics.calculateAnalyticalOutstandingBalance` | `diffInMonths` (calendário) | **Sim** (`getMonthlyRate` soma `spreadRate`) | `dashboardMetrics.ts:113-147, 59-66` |
| `OutstandingBalanceChart.analyticalOutstandingBalance` | `(ms diff) / (1000·60·60·24·30.44)` | **Não** (usa só `interestRate`) | `OutstandingBalanceChart.tsx:76-111` |
| `DebtProfileChart.analyticalOutstandingBalance` | `(ms diff) / (1000·60·60·24·30.44)` | **Não** | `DebtProfileChart.tsx:175-217, 170-173` |

O comentário em `OutstandingBalanceChart.tsx:75` afirma que a fórmula é "Mesma fórmula usada em DashboardStats … para garantir consistência entre os KPIs do header e o card de Saldo Devedor Atual" — mas isso vale **apenas** para contratos pré-fixados sem spread. Qualquer pós-fixado ou contrato com `spread_rate > 0` produzirá saldos divergentes nos dois cards.

Fórmula comum (SAC vs PRICE) é a clássica em ambos:
- **SAC**: `saldo = principal − (principal/N) × decorridos`
- **PRICE**: `saldo = principal × (1+i)^decorridos − PMT × ((1+i)^decorridos − 1)/i`

Não emito julgamento sobre qual é "a correta" — depende da definição contábil que a O2 adota para spread em contratos pós-fixados.

### 4.2 PMT Corrente — mesma divergência

| Implementação | Inclui spread? | Arquivo:Linha |
|---|---|---|
| `dashboardMetrics.calculateAnalyticalCurrentPMT` | **Sim** | `dashboardMetrics.ts:149-185` |
| `OutstandingBalanceChart.analyticalCurrentPMT` | **Não** | `OutstandingBalanceChart.tsx:114-150` |

Para contratos com parcelas persistidas, ambos usam `total_amount` da próxima parcela e batem. A divergência só aparece em contratos sem parcelas.

### 4.3 CET média — duas formas de ponderação

| Função | Peso usado | Arquivo:Linha |
|---|---|---|
| `calculateWeightedAverageCET` | `financedAmount` | `cetCalculator.ts:86-112` |
| `dashboardMetrics` (CET da carteira) | **Saldo devedor atual** | `dashboardMetrics.ts:347-360` |

Para uma carteira com contratos antigos quase quitados, as duas médias divergem significativamente. A função em `cetCalculator.ts` é exportada e poderia ser invocada por outros componentes futuros, criando risco de retrabalho.

### 4.4 CET no fallback ≠ CET por TIR

Quando o batch IRR não converge (ou não há parcelas), `dashboardMetrics.ts:354` usa:

```ts
const monthlyRate = cetResult ? cetResult.monthlyRate : getMonthlyCET(debt);
```

E `getMonthlyCET` (linha 197-202) retorna `cet_monthly_rate` persistido **ou** a taxa nominal mensal — nunca recalcula com IOF/TAC. Isso significa que, no fallback, a "CET" exibida é apenas a taxa nominal, não o custo efetivo. Pode confundir um CFO que está comparando contratos onde alguns convergiram e outros não.

### 4.5 IRR — duas implementações independentes

`src/lib/irrCalculator.ts` e a função `calculateCET` dentro de `…/calculate-amortization/index.ts:482-574` resolvem o mesmo problema com diferenças sutis:

| Aspecto | TS (front) | Deno (edge) |
|---|---|---|
| Derivada do NPV | Numérica (diferença finita, `delta=1e-5`) | Analítica (linha 525) |
| `maxChange` por iteração | `annualRate * 0.1` | `Math.abs(annualRate) * 0.1 + 0.01` |
| Comportamento perto de `annualRate ≈ 0` | Converge devagar | Mais robusto |
| Estado de "não convergiu" | Retorna mesmo assim | Idem |

Em contratos exóticos (taxa muito baixa, prazo curto, IOF alto) os dois podem convergir para valores ligeiramente diferentes — relevante porque o front usa `calculateBatchCET` (TS) e ignora o `cet_monthly_rate` persistido pelo Deno.

### 4.6 Dívida Bruta vs Líquida

Em `DashboardStats.tsx:213-217`:

```ts
netDebt: {
  grossDebtAmount: currentOutstandingBalance,
  cashAndEquivalents: 0,
  netDebtAmount: currentOutstandingBalance,
}
```

O sistema de alertas (`generateCfoAlerts`) recebe os dois como iguais. Não há rastreamento de caixa em lugar nenhum — `dashboardMetrics.netDebt` é literalmente `null`. O componente obsoleto `_obsolete/NetDebtCard.tsx` previa um input para o CFO digitar o caixa, mas o `return null` no fim (`linha 83`) já indica que foi descontinuado sem substituto.

### 4.7 Semântica de `remaining_balance`

No edge function (`…/index.ts:430-440, 463`):
```ts
installments.push({
  …
  principal_balance: Number(remainingBalance.toFixed(2)),  // ← saldo ABERTURA do período
  …
});
remainingBalance -= amortizationAmount;  // só decrementa depois
```

O campo persistido é **o saldo no início do período da parcela**, não após o pagamento. O front consome de duas formas diferentes:

- `dashboardMetrics.ts:98-103` busca a **próxima parcela com `due_date ≥ hoje`** e usa seu `remaining_balance` — semanticamente correto (saldo antes da próxima parcela = saldo atual devido).
- `debtUtils.ts:155-169` busca a **última parcela com `due_date ≤ targetDate`** e usa seu `remaining_balance` — isso retorna o saldo no início daquele mês, **antes** do pagamento. Ou seja, em uma data exatamente no dia do vencimento, mostra o saldo pré-pagamento.
- `OutstandingBalanceChart.tsx:240-243` segue a lógica de `debtUtils.ts`.

Não está claro qual é a intenção de produto (saldo "de manhã" vs "de noite"). Para horizontes mensais a diferença é exatamente uma amortização — visualmente perceptível.

### 4.8 SAC vs PRICE pós-fixado — comportamentos distintos

No edge function:
- **SAC pós-fixado**: amortização **fixa** = `financiado/N` (linha 337); juros recalculados com taxa efetiva do período.
- **PRICE pós-fixado**: PMT **recalculada a cada período** (linha 400-413) usando saldo atual e taxa efetiva. Não é a PRICE clássica de PMT constante.

Isso é uma decisão de modelagem razoável (PRICE pura não existe sob taxa variável), mas está implícita. Um CFO pode esperar PMT constante em PRICE.

---

## 5. Riscos Matemáticos

| # | Risco | Onde |
|---|---|---|
| R1 | **Sem rollback transacional** entre `delete debt_installments` e `insert`. Se o insert falha, o contrato fica sem parcelas e o front re-aciona o edge function — provável recuperação, mas há uma janela onde os KPIs ficam zerados. | `…/calculate-amortization/index.ts:131-178` |
| R2 | **Update de dívida deleta parcelas no front** (`useDebts.tsx:140-148`) **antes** do edge function ser chamado para recalcular (ocorre depois em `Index.handleSaveDebt`). Se o passo do edge function falha, o contrato perde parcelas no banco. | `useDebts.tsx:137-173` + `Index.tsx:160-187` |
| R3 | **Diff de meses por 30.44 dias** (`OutstandingBalanceChart`, `DebtProfileChart`, obsolete `NetDebtCard`) cria desalinhamento de até 1 mês conforme o ano. `dashboardMetrics` usa `diffInMonths` por calendário — mais correto. | `OutstandingBalanceChart.tsx:82-88`, `DebtProfileChart.tsx:183-189` |
| R4 | **Edge function: spread tratado como anual quando `interestType === 'annual'`** (`staticRate = spreadRate + interestRate` antes da conversão na linha 322). Se o cadastro guarda spread sempre como mensal, contratos com taxa anual vão produzir taxa efetiva incorreta. Não há validação no schema. | `…/calculate-amortization/index.ts:300, 321-324` |
| R5 | **Newton-Raphson não-convergente é silencioso**. O CET retornado quando `converged=false` ainda é gravado (`…/index.ts:194-200` não checa `converged`). O front exibe normalmente. | `…/index.ts:191-208`, `cetCalculator.ts:40-44` |
| R6 | **`calculateCET` no front recalcula CET a cada render do dashboard** (via `calculateBatchCET`), ignorando o `cet_monthly_rate` já persistido. Custo de CPU para carteiras grandes. Resultado pode divergir do persistido (§4.5). | `dashboardMetrics.ts:328-345` |
| R7 | **Datas via `new Date('YYYY-MM-DD')`** no edge function (linha 307-308) parsem como UTC, depois `toISOString().split('T')[0]` retorna a data UTC. Em servidores com timezone local diferente, parcelas podem deslocar 1 dia em meses-borda. | `…/calculate-amortization/index.ts:307-352` |
| R8 | **`DebtProfileChart` tem reconciliação de "missing"** (linha 420-430): se a soma de `principal_amount` for menor que o saldo atual, joga a diferença num bucket. Em casos de parcelas parciais ou inconsistentes, pode dobrar amortização. | `DebtProfileChart.tsx:420-430` |
| R9 | **`OutstandingBalanceChart.kpis.deltaSaldo/deltaPmt`** comparam "hoje" vs "hoje − 1 mês" via fórmula analítica. O comentário admite ser placeholder (`linha 286-289`). O CFO pode interpretar o delta como variação real, mas é projeção contra projeção. | `OutstandingBalanceChart.tsx:286-322` |
| R10 | **Toda agregação assume que `debt_installments` está completa e atualizada**. Se o usuário editar uma dívida e o edge function falhar, a UI renderiza com dados estale por uma sessão inteira sem aviso. | Vários |

Não foram encontrados problemas de **precisão decimal** (uso consistente de `toFixed(2)` na persistência e `Number()` em conversões). Sem `Decimal.js` ou similar, mas para a escala de valores típicos (até centenas de milhões em BRL) o `Number` JavaScript é suficiente.

---

## 6. Auditoria de UI

### Cards onde um CFO pode ler errado

| Card | O que pode confundir |
|---|---|
| **Saldo Devedor Atual** (DashboardStats) e **Saldo total atual** (OutstandingBalanceChart KPI) | Mesma label, fórmulas diferentes (§4.1). Se o CFO comparar lado a lado, vai ver dois números com a mesma legenda divergindo em alguns por cento. |
| **CET Média** | Tooltip diz "ponderado pelo saldo devedor". Correto para a tela atual, mas se um relatório futuro usar `calculateWeightedAverageCET` (financedAmount), produzirá outro número com a mesma label. |
| **Spread Médio sobre CDI** | Tooltip: "Diferença entre o CET dos contratos e a taxa CDI atual". A conta é apenas `CET_anual − CDI_anual`. Para contratos pré-fixados, IPCA, ou TR, a diferença não é "spread" — é só uma subtração sem significado financeiro. O card não distingue. |
| **PMT 30/90 dias e Pico mensal** | Soma `total_amount` das parcelas reais. Para pós-fixado com índice projetado, o "PMT 90 dias" depende da projeção atual de CDI/IPCA — o número muda silenciosamente quando as projeções são atualizadas. Não há indicação de que é uma estimativa. |
| **Pontos de atenção (alertas CFO)** | Inclui `divida_liquida`, mas a Dívida Líquida = Dívida Bruta (§4.6). Os filtros em `cfoAlerts.ts:218` excluem essa categoria do card de alertas (`linha 219`), mas o objeto de input ainda é montado como se a métrica existisse — risco de re-aparecer se alguém mexer no filtro. |
| **Caixa liberado** (toggle no OutstandingBalanceChart) | Mostra `max(0, PMT_hoje − PMT_mes)`. Se um contrato novo for adicionado, PMT futura aumenta e o "caixa liberado" para esse mês cai a zero — pode dar impressão de que a empresa "perdeu caixa" quando na verdade só assumiu novo contrato. |
| **Composição por prazo** (DebtProfileChart) | Curto = ≤12m, longo = >12m. Definição padrão de mercado, mas o card não menciona o ponto de corte. Um CFO acostumado a 24m como "curto" pode interpretar errado. |
| **Maior credor** | Threshold de cor (>55% destrutivo, >35% âmbar) é arbitrário. Não há ajuste por porte da empresa nem por política interna. |
| **Prazo Médio Restante** | Calculado em meses, ponderado por saldo. Para uma carteira mista (capital de giro 6m + financiamento 10 anos), a média pode esconder a concentração. |

### Inconsistências visuais cruzadas

- O **header de OutstandingBalanceChart** mostra "Saldo total atual" e "PMT este mês" como se fossem os mesmos números do header de KPIs do DashboardStats — mas usam fórmulas independentes (§4.1, §4.2). Após qualquer edição de contrato pós-fixado, os dois devem divergir.
- O delta "vs mês anterior" no `OutstandingBalanceChart.KpiBlock` colore positivo em verde e negativo em vermelho. Para "Saldo total" subir é ruim; para "PMT este mês" cair é bom. A coloração trata os dois com a mesma lógica → para PMT, "verde = aumentou" pode passar mensagem errada.

---

## 7. Lacunas (requerem validação com o time)

| # | Lacuna |
|---|---|
| L1 | **Spread mensal vs anual no cadastro** — O schema permite `spread_rate` numérico mas não documenta a base. O edge function (R4) trata como se fosse na mesma base de `interestRate`. Confirmar com o time qual é o contrato de cadastro. |
| L2 | **Definição contábil de saldo** — Saldo "no início" vs "no fim" do período (§4.7). Qual é a verdade que o CFO espera ver? |
| L3 | **Política de PRICE pós-fixado** — A escolha de re-PRICE (PMT recalculada a cada período) vs price-fixed (PMT constante até o fim) é uma convenção. Nada no código documenta a decisão (§4.8). |
| L4 | **Caixa e equivalentes** — Existe intenção de adicionar input de caixa para Dívida Líquida real? O componente obsoleto sugere que sim, mas não há roadmap visível no código. |
| L5 | **Quando um contrato termina parcialmente no mês** — `analyticalCurrentPMT` retorna 0 se hoje > dueDate, mas o último mês da vida do contrato pode ter PMT proporcional. Comportamento atual: zero. Esperado pelo CFO: a parcela final ainda conta. |
| L6 | **CDI atual vs CDI médio do período** — O "Spread Médio" usa `latestRates.CDI.value`, ou seja, a última taxa diária conhecida. Mas o CET dos contratos é uma TIR sobre fluxos com taxas projetadas variando ao longo do tempo. Comparar TIR composta com taxa pontual não é apples-to-apples. |
| L7 | **Granularidade de tempo no IRR** — Usa `years = days / 365.25`. Para parcelas de 30/30/30/30 dias o efeito é desprezível; para parcelas com gaps incomuns (entrada + 90 dias) pode haver sensibilidade. Não testado. |
| L8 | **Reprogrammingrules** — Edge function aceita `reprogrammingRules` mas o código atual não as consome em lugar visível. Funcionalidade morta ou não implementada. |
| L9 | **Persistência de `cet_*_rate` versus recálculo** — O front sempre recalcula CET (R6). Por que persistir? Convém alinhar: ou o persistido é a fonte de verdade ou é cache descartável. |
| L10 | **Filtros globais vs filtros de widget** — `Index.tsx:351-381` aplica filtros locais e globais de forma cumulativa (AND). Se o CFO marca "todos" no filtro local mas tem filtro global, o resultado pode parecer não responsivo. Pequena UX, mas vale validar. |

---

## 8. Plano de Ação

> Ordenado por **impacto no risco de decisão errada**, não por esforço.

### Prioridade 1 — Alinhar verdade única para Saldo e PMT

| # | Ação | Arquivo alvo |
|---|---|---|
| P1.1 | Centralizar saldo analítico em **uma** função em `dashboardMetrics.ts` (ou novo `src/lib/balanceCalculator.ts`) e fazer `OutstandingBalanceChart` e `DebtProfileChart` consumirem dela. Eliminar as duas reimplementações com fórmulas divergentes. | `OutstandingBalanceChart.tsx:76-150`, `DebtProfileChart.tsx:175-217` |
| P1.2 | Decidir e documentar: **spread entra no fallback analítico ou não?** Aplicar igualmente nas três trilhas. | `dashboardMetrics.ts:59-66` + as fórmulas centralizadas em P1.1 |
| P1.3 | Definir semântica de `remaining_balance` (abertura vs fechamento) e renomear o campo se necessário, ou ajustar uma das trilhas para reconciliar com a outra. | `…/calculate-amortization/index.ts:430-440, 463`, `debtUtils.ts:155-169`, `dashboardMetrics.ts:98-103` |

### Prioridade 2 — Confiabilidade do CET

| # | Ação | Arquivo alvo |
|---|---|---|
| P2.1 | Decidir entre **persistir CET** (gravado pela edge function) **ou recalcular sempre**. Se persistir, remover a chamada `calculateBatchCET` em `dashboardMetrics`. Se recalcular, remover as colunas `cet_*_rate`. | `dashboardMetrics.ts:328-360` + edge function |
| P2.2 | Não gravar CET quando `converged === false`; em vez disso, sinalizar `cet_status` para a UI exibir "—" e tooltip explicativo. | `…/calculate-amortization/index.ts:191-208` |
| P2.3 | Unificar IRR: extrair para um arquivo compartilhado (ou portar a derivada analítica para o TS) para garantir convergência idêntica entre front e edge. | `irrCalculator.ts`, `…/calculate-amortization/index.ts:482-574` |
| P2.4 | Padronizar peso da CET média (saldo OU financedAmount, escolher um) e remover a função vencida. | `cetCalculator.ts:86-112` vs `dashboardMetrics.ts:347-360` |

### Prioridade 3 — Rotular o que não é "real"

| # | Ação | Arquivo alvo |
|---|---|---|
| P3.1 | Remover ou renomear o card de Dívida Líquida enquanto não houver input de caixa; no payload de alertas, parar de enviar `netDebt` com cash=0. | `DashboardStats.tsx:213-217`, `cfoAlerts.ts` |
| P3.2 | Adicionar badge/tooltip "estimativa" nos KPIs cuja base muda silenciosamente (PMT 30/90/180, pico 12m) quando há contratos pós-fixados na carteira. | `DashboardStats.tsx:464-537` |
| P3.3 | No `OutstandingBalanceChart.KpiBlock`, ajustar a coloração do delta para refletir polaridade por métrica (PMT cair = bom; saldo cair = bom; inverter conforme o caso). Hoje o verde/vermelho é uniforme. | `OutstandingBalanceChart.tsx:644-672` |
| P3.4 | Renomear "Spread Médio" para algo que não pressuponha CDI (ex.: "CET vs CDI"), ou exibir N/A se nenhum contrato é CDI. | `DashboardStats.tsx:292-307`, `dashboardMetrics.ts:361` |

### Prioridade 4 — Robustez do pipeline de parcelas

| # | Ação | Arquivo alvo |
|---|---|---|
| P4.1 | Não deletar `debt_installments` no front (`useDebts.tsx:140`) antes do edge function ser chamado. Deixar o edge function ser a única responsável pelo ciclo delete + insert (idempotente, já implementado). | `useDebts.tsx:137-173` |
| P4.2 | Tornar o ciclo de delete + insert na edge function transacional (Postgres function ou `rpc`), evitando estado intermediário visível ao front. | `…/calculate-amortization/index.ts:131-178` |
| P4.3 | Se um recálculo on-the-fly via edge function falhar (R10), expor erro no UI em vez de retornar zeros silenciosos. | `useDebtInstallments.tsx:106-132, 187-189` |

### Prioridade 5 — Documentação e validação

| # | Ação | Arquivo alvo |
|---|---|---|
| P5.1 | Validar com o time as 10 lacunas da §7 e materializar as decisões em `CLAUDE.md` ou em um `docs/FINANCIAL_CONVENTIONS.md`. | (novo) |
| P5.2 | Adicionar testes (vitest) para casos de borda — pré-fixado simples, pós-fixado com spread, contrato terminando no mês corrente, IRR de contrato com IOF alto. Hoje só há validação manual no browser. | (novo `src/lib/__tests__/`) |
| P5.3 | Atualizar `calculationRules.ts` para refletir as decisões da Prioridade 1 (já está bem feito como pseudocódigo, mas vai ficar desatualizado se P1 mudar fórmulas). | `src/lib/calculationRules.ts` |

---

## Apêndice — Referências cruzadas com pseudocódigo existente

O projeto já documenta as regras de cálculo em popovers (`CalculationInfoPopover` ← `src/lib/calculationRules.ts`), em **pseudocódigo amigável**. Esta auditoria não duplica esse conteúdo; recomenda-se manter sincronia entre as decisões da Prioridade 1 e os pseudocódigos lá descritos. Discrepâncias atuais entre o pseudocódigo e a implementação:

- `calculationRules.CURRENT_OUTSTANDING_BALANCE` descreve a fórmula **com spread implícito** (usa "taxa mensal"), o que casa com `dashboardMetrics` mas não com os fallbacks de `OutstandingBalanceChart`/`DebtProfileChart`.
- `calculationRules.AVERAGE_MONTHLY_CET` documenta corretamente o fallback "taxa cadastrada se TIR não convergir" (§4.4), mas não distingue que essa taxa **não inclui IOF/TAC** — informação relevante para o leitor.
- `calculationRules.OUTSTANDING_BALANCE` (gráfico por banco) afirma "KPIs do header usam fórmula analítica idêntica ao Saldo Devedor Atual" — não é literalmente verdade hoje (§4.1).
