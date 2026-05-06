# CFO Decision Log — Matriz de Decisões Técnicas (V2 × Aplicação Atual)

> Documento analítico que cruza o modelo financeiro de referência (`CFO_AUDIT_REPORT_V2.md`) com a auditoria do estado atual (`CFO_AUDIT_REPORT.md`), produzindo decisões executáveis para o `debt-vista-dash`.
> Escopo: convenções financeiras, semântica de saldos, PMT, ponderação de CET, paridade `src/lib` ↔ Edge Function.
> Data: 2026-05-05 · Status: **Proposta para revisão** (produto + engenharia).
> **Esta etapa é estritamente analítica — nenhum código deve ser alterado antes da aprovação deste log.**

---

## 1. Sumário Executivo

A auditoria mostra um núcleo de cálculo correto na Edge Function `calculate-amortization`, mas **três fontes de verdade analíticas paralelas** no front (`dashboardMetrics`, `OutstandingBalanceChart`, `DebtProfileChart`) que divergem em três pontos sensíveis ao CFO:

1. **Spread em fallback analítico** (incluído em uma trilha, ignorado em duas).
2. **Semântica de `remaining_balance`** (saldo de abertura é persistido, mas consumido como se fosse saldo atual em alguns lugares e como saldo do mês em outros).
3. **Ponderação do CET médio** (saldo devedor vs valor financiado coexistem).

O modelo V2 resolve cada um desses pontos com regras explícitas. A recomendação geral é **adotar V2 como verdade**, eliminar fórmulas analíticas duplicadas e tratar `debt_installments` + `debt_installment_rate_refs` como única fonte de verdade. Os fallbacks analíticos passam a ser **estritamente temporários** (parcelas ainda não geradas), com rótulo de “estimativa” na UI.

Princípio guia para o resto do documento: **paridade total entre `src/lib` e Edge Function**. Onde houver divergência, a Edge Function é canônica e o front a espelha.

---

## 2. Matriz de Decisões

Legenda das colunas:

- **Adotar V2** — implementar exatamente como o documento V2 prescreve.
- **Manter atual** — comportamento corrente já está alinhado e/ou é superior.
- **Adaptar** — V2 + ajustes técnicos para o ecossistema atual (RLS, Deno, React Query etc.).

---

### D1 · Saldo devedor — semântica de abertura/fechamento

| Item | Conteúdo |
|---|---|
| **Regra V2** | `principal_balance` é **saldo de abertura** (antes do pagamento da parcela). Para “saldo atual” na UI, usar saldo de abertura da **próxima parcela futura**. Para séries mensais gerenciais, usar **saldo de fechamento do mês**. |
| **Estado atual** | Edge Function já persiste abertura (`index.ts:430-440`). `dashboardMetrics` consome corretamente (próxima parcela futura). `debtUtils` e `OutstandingBalanceChart` consomem **última parcela com `due_date ≤ targetDate`**, retornando saldo pré-pagamento na própria data de vencimento — divergência semântica de até 1 amortização. |
| **Trade-off** | Padronizar para “fechamento do mês” em séries gerenciais exige uma transformação `saldoFechamento[n] = saldoAbertura[n] − amortization[n]` na agregação mensal. Custo computacional: O(N) por contrato, irrelevante. Custo de migração: ajustar 2 trilhas de UI e tooltips. |
| **Decisão** | **Adotar V2 + Adaptar.** Manter `principal_balance` no banco como saldo de abertura (não renomear — evita migração disruptiva). Criar helper único `getOutstandingAt(debt, date, mode: 'opening' \| 'closing')` em `src/lib/balanceCalculator.ts` (a ser criado) e refatorar consumidores. KPI “Saldo Devedor Atual” = abertura da próxima parcela futura. Séries mensais do `OutstandingBalanceChart` = fechamento do mês. |
| **Critério de aceite** | Em uma data exatamente igual a um vencimento, KPI e ponto da série não diferem por uma amortização inteira. |

---

### D2 · Spread em fallback analítico

| Item | Conteúdo |
|---|---|
| **Regra V2** | `taxaEfetivaPeriodo = taxaIndexadorPeriodo + spreadPeriodo`. Fallback analítico **deve usar exatamente as mesmas funções do cronograma**, incluindo spread. Spread é cadastrado como **anual** e convertido explicitamente: `spreadMensal = (1 + spreadAnual/100)^(1/12) − 1`. |
| **Estado atual** | `dashboardMetrics.getMonthlyRate` soma spread (correto). `OutstandingBalanceChart.tsx:76-111` e `DebtProfileChart.tsx:175-217` ignoram spread. Risco R4: Edge Function trata spread como anual quando `interestType === 'annual'` mas o schema não documenta a base — assume-se que o cadastro é coerente. |
| **Trade-off** | Centralizar a fórmula é barato (1 helper). O custo real é decidir **uma única base contratual de spread**. V2 recomenda anual; o cadastro hoje é ambíguo. |
| **Decisão** | **Adotar V2.** (a) Padronizar `spread_rate` como **anual** em todo o sistema; adicionar comentário no schema (`debts.spread_rate`) e validação de UI no `DebtForm`. (b) Centralizar conversão num único módulo (`src/lib/rateUtils.ts`) consumido por `dashboardMetrics`, fallbacks e — via cópia auditada — pela Edge Function. (c) Eliminar as duas implementações de fallback que ignoram spread. |
| **Critério de aceite** | Para um contrato pós-fixado com spread > 0, o KPI “Saldo Devedor Atual” do header e o KPI do `OutstandingBalanceChart` retornam valores idênticos ao centavo. |

---

### D3 · PRICE pós-fixado — re-PRICE por período

| Item | Conteúdo |
|---|---|
| **Regra V2** | PRICE pós-fixado **não é PMT constante**. A cada período, recalcula-se o PMT com saldo de abertura, taxa efetiva resolvida e prazo remanescente (`nRestante = N − i + 1`). Última parcela quita o saldo. |
| **Estado atual** | Edge Function já implementa re-PRICE (`index.ts:400-413`). Comportamento correto, **mas implícito**: nenhum tooltip explica ao CFO que a parcela vai variar. Auditoria §4.8 sinaliza risco de leitura. |
| **Trade-off** | Manter re-PRICE é financeiramente correto. O custo é apenas **comunicacional** — adicionar rótulo/tooltip na UI. |
| **Decisão** | **Manter atual + Adaptar UI.** (a) Documentar a convenção em `CLAUDE.md` e em `calculationRules.ts`. (b) Adicionar badge “PMT recalculada por período” em cards/tabelas que exibem parcelas de PRICE pós-fixado. (c) Tooltip do KPI “PMT Corrente” explicita que o número muda quando a projeção do indexador é atualizada. |
| **Critério de aceite** | Tooltip do PMT em contrato PRICE+CDI mostra: indexador, projeção em uso, data-base e que “a parcela é recalculada a cada período”. |

---

### D4 · Ponderação do CET médio

| Item | Conteúdo |
|---|---|
| **Regra V2** | V2 não fixa o peso, mas exige fonte única e cálculo persistido pela Edge Function (CET por contrato). |
| **Estado atual** | Duas funções coexistem: `cetCalculator.calculateWeightedAverageCET` pondera por **`financedAmount`**; `dashboardMetrics` pondera por **saldo devedor**. Para carteira com contratos antigos quase quitados, divergem materialmente. |
| **Trade-off** | Saldo devedor reflete melhor o **custo presente da carteira** (visão CFO “quanto estou pagando hoje”). FinancedAmount reflete o **custo histórico das captações** (visão de tesouraria). Para o dashboard CFO, a primeira é mais útil. |
| **Decisão** | **Adaptar.** Adotar **ponderação por saldo devedor atual** como padrão único. Remover/marcar `calculateWeightedAverageCET` como deprecated (ou parametrizar com peso explícito `'outstanding' \| 'financed'`, default `outstanding`). Tooltip do KPI passa a citar “média ponderada pelo saldo devedor atual”. |
| **Critério de aceite** | Apenas uma função de média ponderada existe no codebase; busca por “WeightedAverageCET” retorna no máximo um símbolo público. |

---

### D5 · CET — persistir vs recalcular

| Item | Conteúdo |
|---|---|
| **Regra V2** | Edge Function **calcula e persiste** `cet_monthly_rate`/`cet_annual_rate`. Front **exibe e só recalcula sob ação explícita** (ex: simulação de cenário). |
| **Estado atual** | Edge Function persiste, **mas o front recalcula a cada render** via `calculateBatchCET` (R6). Resultado pode divergir do persistido por diferenças de implementação Newton-Raphson (§4.5). |
| **Trade-off** | Persistir + exibir é mais barato (CPU), mais consistente e mais auditável. Recalcular é necessário apenas em cenários temporários. |
| **Decisão** | **Adotar V2.** (a) `dashboardMetrics` passa a ler `debts.cet_monthly_rate` direto. (b) `calculateBatchCET` é mantido **apenas** para cenários temporários e contratos sem parcelas persistidas. (c) Não gravar CET quando `converged === false` — gravar `null` e `cet_status='nao_convergiu'` (nova coluna ou enum). UI exibe “—” com tooltip explicativo. |
| **Critério de aceite** | Em condições normais, valor de CET exibido = valor em `debts.cet_monthly_rate` (sem recálculo). `git grep calculateBatchCET` mostra uso restrito a fluxos de cenário. |

---

### D6 · IRR — paridade entre TS e Deno

| Item | Conteúdo |
|---|---|
| **Regra V2** | “A função de IRR deve ser única ou produzir resultado idêntico no front e na Edge Function.” |
| **Estado atual** | Duas implementações (TS Newton-Raphson com derivada numérica vs Deno com derivada analítica) divergem em casos de borda (taxa baixa, IOF alto). |
| **Trade-off** | Compartilhar código entre Vite e Deno via import direto é frágil (Deno usa import_map; TS usa alias). Opções: (i) duplicar a versão analítica em TS — mais robusto e barato; (ii) extrair pacote compartilhado — overhead de tooling; (iii) eliminar IRR do front (D5 já reduz isso). |
| **Decisão** | **Adaptar.** Combinar (i) + (iii): portar a derivada analítica e o controle de `maxChange` para `irrCalculator.ts`, mantendo arquivo separado mas **com testes que validam paridade** com a versão Deno (mesmos vetores de input, deltas < 1e-9). |
| **Critério de aceite** | Suite de testes (Vitest) cobre 6+ cenários (pré/pós, SAC/PRICE, IOF alto, taxa próxima de zero, prazo curto, IRR negativa) e ambas as implementações concordam. |

---

### D7 · Saldo analítico — três fórmulas paralelas → uma

| Item | Conteúdo |
|---|---|
| **Regra V2** | “Fallbacks analíticos devem usar exatamente as mesmas funções de cálculo do cronograma” e ser “rotulados como estimativa quando usados”. |
| **Estado atual** | Três fórmulas coexistem com diferenças sutis (diff de meses por calendário vs `30.44`; com/sem spread). Resultado: KPIs com mesma label divergem entre cards. |
| **Trade-off** | Centralizar é decisão de baixo risco. O custo é refatorar 2 componentes; ganho é eliminar inconsistência visível ao CFO. |
| **Decisão** | **Adotar V2.** Criar `src/lib/balanceCalculator.ts` com (a) `getAnalyticalOutstanding(debt, date)` SAC/PRICE com spread incluído, (b) `getAnalyticalCurrentPMT(debt, date)` espelho do cronograma. Diff de meses sempre via `date-fns:differenceInMonths` (calendário). Substituir as 3 implementações. |
| **Critério de aceite** | `git grep "30.44"` retorna zero. KPIs com mesma label batem ao centavo entre `DashboardStats` e `OutstandingBalanceChart`. |

---

### D8 · Auditoria de taxa por parcela (`debt_installment_rate_refs`)

| Item | Conteúdo |
|---|---|
| **Regra V2** | Toda parcela pós-fixada tem linha em `debt_installment_rate_refs` com `index_type`, `period_start/end`, `rate`, `rate_type`, `source` (`bcb_realizado` \| `projecao_base` \| `cenario_temporario`), `scenario_label`, `source_reference_date`. |
| **Estado atual** | Tabela existe e é populada pela Edge Function. Auditoria não aprofundou esta camada. UI ainda não consome para tooltips. |
| **Trade-off** | Custo do payload na Edge Function é desprezível. Ganho de auditabilidade é alto (CFO consegue explicar “por que esta parcela mudou”). |
| **Decisão** | **Manter atual + Adaptar UI.** Adicionar tooltip por parcela na `AmortizationTable` mostrando origem da taxa. Para KPIs agregados (PMT 90d, juros futuros), exibir badge se a janela contém parcelas com `source = projecao_base` ou `cenario_temporario`. |
| **Critério de aceite** | Hover em qualquer parcela pós-fixada exibe: indexador, taxa do período, fonte, data-base. Cards agregados sinalizam projeção quando aplicável. |

---

### D9 · Período misto realizado/futuro

| Item | Conteúdo |
|---|---|
| **Regra V2** | Período que cruza “hoje” usa **projeção base inteira** na V1 (decisão deliberada, conservadora). |
| **Estado atual** | Comportamento da Edge Function alinhado com V2 nesse aspecto. |
| **Trade-off** | Split em trecho realizado + projetado é mais preciso, mas exige lógica adicional e um campo `effective_rate_breakdown`. Adiar é a decisão correta para V1. |
| **Decisão** | **Manter atual.** Documentar explicitamente em `calculationRules.ts`. Reavaliar em V2 do produto. |
| **Critério de aceite** | Documentação cita a regra; CFO sabe que o mês corrente não é “meio realizado, meio projetado”. |

---

### D10 · Projeção base por empresa (`company_index_projections`)

| Item | Conteúdo |
|---|---|
| **Regra V2** | Único valor por (empresa, indexador): último real do BCB, gravado como projeção. Sem curva forward na V1. |
| **Estado atual** | Estrutura existe (`index_projections` ou `company_index_projections`). Verificar se há lógica de atualização automática implementada — auditoria sugere que `useEffect` de inicialização foi desativado por causar loop 401 (CLAUDE.md, armadilha #1). |
| **Trade-off** | Atualização automática agradável para o CFO, mas frágil (RLS + auth). Atualização manual é segura mas exige UX. |
| **Decisão** | **Adotar V2 + Adaptar.** Manter regra simples (último valor real). Implementar atualização **on-demand**: botão “Atualizar projeções” na UI (chama Edge Function `fetch-bcb-rates` e grava em `company_index_projections`). Não reativar `useEffect` de inicialização sem antes estabilizar refs em `useDataInitialization`. |
| **Critério de aceite** | CFO consegue atualizar projeções com um clique, vê data-base do dado e não há loop de 401 em background. |

---

### D11 · Cenários temporários

| Item | Conteúdo |
|---|---|
| **Regra V2** | Override em memória, sem persistência nomeada na V1. Aplicar **apenas a períodos futuros** por padrão; opção “aplicar a tudo” como simulação rotulada. |
| **Estado atual** | Funcionalidade parcialmente presente (mencionada na auditoria como `Sensitivity dashboard` no commit recente). Detalhes de implementação não auditados. |
| **Trade-off** | Aplicar a tudo é tentador para “stress test” mas distorce histórico. V2 recomendação é a correta. |
| **Decisão** | **Adotar V2.** Default = futuro. Toggle “incluir histórico realizado” explicitamente rotulado “simulação contrafactual”. Auditoria das parcelas geradas com `source='cenario_temporario'` apenas se o usuário recalcular persistentemente. |
| **Critério de aceite** | UI deixa claro o escopo do override. Histórico realizado nunca muda silenciosamente. |

---

### D12 · IOF/TAC e CET

| Item | Conteúdo |
|---|---|
| **Regra V2** | IOF/TAC reduzem desembolso líquido inicial e entram **apenas** no fluxo do CET — não nas parcelas recorrentes. CET = XIRR(cashflows datados); cashflow inicial positivo, parcelas negativas. |
| **Estado atual** | Edge Function alinhada. Mas (R5) grava CET mesmo quando Newton-Raphson não converge — risco de exibir número falso. |
| **Trade-off** | Adicionar `cet_status` é migração pequena. Ganho: KPI deixa de mentir. |
| **Decisão** | **Adotar V2.** (a) Manter regra de cashflow. (b) Adicionar coluna `debts.cet_status` (`ok` \| `nao_convergiu` \| `nao_aplicavel`). (c) UI exibe “—” + tooltip quando `nao_convergiu`. (d) Validação cruzada via testes de paridade D6. |
| **Critério de aceite** | Contrato com Newton-Raphson não convergente exibe “—” em vez de número arbitrário. |

---

### D13 · Dívida Líquida

| Item | Conteúdo |
|---|---|
| **Regra V2** | V2 não trata diretamente. Auditoria §4.6 mostra que hoje `netDebt = grossDebt` (caixa = 0), e o sistema de alertas opera como se a métrica fosse real. |
| **Trade-off** | Implementar caixa real exige nova tabela + UX (input ou integração). Manter como “=bruta” engana o CFO. |
| **Decisão** | **Adaptar.** Curto prazo: remover Dívida Líquida da UI principal e do payload de `cfoAlerts` enquanto não houver caixa rastreado. Médio prazo: adicionar `companies.cash_position` (manual) ou tabela `cash_balances` com snapshot mensal. Decisão de produto pendente. |
| **Critério de aceite** | Nenhum card menciona “Dívida Líquida” até existir input de caixa. Alertas não consomem `netDebt` zerado. |

---

### D14 · Datas e timezone na Edge Function

| Item | Conteúdo |
|---|---|
| **Regra V2** | V2 não detalha, mas o princípio de auditabilidade exige que datas sejam estáveis. |
| **Estado atual** | R7: `new Date('YYYY-MM-DD')` é parseado como UTC. Em timezone local diferente, parcelas podem deslocar 1 dia. |
| **Trade-off** | Tratar tudo como UTC é a solução padrão para Edge Functions. Custo: revisão pontual; ganho: eliminação de bug latente. |
| **Decisão** | **Adaptar.** Padronizar manipulação de datas em UTC na Edge Function. Documentar em `CLAUDE.md`. Adicionar teste para parcelas em meses-borda (jan/fev, fev/mar). |
| **Critério de aceite** | Suite de teste cobre `due_date` em 31/01, 28/02, 29/02 (ano bissexto). Servidor com TZ não-UTC produz datas idênticas. |

---

### D15 · Pipeline de delete + insert de parcelas

| Item | Conteúdo |
|---|---|
| **Regra V2** | V2 não detalha; princípio: cronograma persistido é a verdade — não pode haver janela de inconsistência. |
| **Estado atual** | R1+R2: front deleta parcelas em `useDebts.tsx:140` antes de chamar Edge Function. Se Edge Function falhar, contrato fica sem parcelas. |
| **Trade-off** | Mover ciclo delete+insert para dentro de uma RPC Postgres ou Edge Function transacional é o caminho correto. Custo médio (1 migração + ajuste). |
| **Decisão** | **Adaptar.** (a) Remover `delete debt_installments` do front. (b) Edge Function passa a ser idempotente e única responsável pelo ciclo (pode usar `BEGIN/COMMIT` via SQL function ou apenas `DELETE+INSERT` na mesma chamada — Postgres já cobre). (c) UI mostra erro explícito se Edge Function falhar (R10 / P4.3). |
| **Critério de aceite** | Falha simulada do recálculo deixa parcelas anteriores intactas; UI exibe erro acionável. |

---

### D16 · Diferenciação entre PMT real e estimativa

| Item | Conteúdo |
|---|---|
| **Regra V2** | KPIs que dependem de projeção devem informar “qual projeção foi usada, desde quando vale, se há cenário, qual parcela é histórica vs projetada”. |
| **Estado atual** | Cards `PMT 30/90/180`, `Pico 12m`, `Spread Médio` mudam silenciosamente quando projeções mudam. Sem badges. |
| **Trade-off** | UX trabalho moderado, alto valor para o CFO. |
| **Decisão** | **Adotar V2.** Componente reutilizável `<ProjectionBadge />` que, dado um conjunto de parcelas, exibe ícone se ≥1 vier de `projecao_base` ou `cenario_temporario`, com tooltip detalhado. Aplicar a todos os KPIs agregados. |
| **Critério de aceite** | Em carteira só pré-fixada, badge não aparece. Ao adicionar 1 contrato CDI, badge aparece nos KPIs afetados com tooltip explicativo. |

---

### D17 · Spread Médio sobre CDI

| Item | Conteúdo |
|---|---|
| **Regra V2** | V2 não trata diretamente. Auditoria §6/L6: comparar TIR composta (CET) com taxa pontual (CDI atual) não é apples-to-apples; e contratos não-CDI distorcem o número. |
| **Decisão** | **Adaptar.** (a) Renomear para “CET vs CDI” ou “Prêmio sobre CDI (média)”. (b) Calcular apenas sobre contratos cujo indexador resolve em CDI (incluir SELIC opcionalmente). (c) Mostrar “N/A” se nenhum contrato qualifica. (d) Nota de rodapé: “comparação simplificada — CDI atual vs CET anualizado”. |
| **Critério de aceite** | Card exibe N/A para carteira 100% pré-fixada/IPCA. Tooltip explica metodologia simplificada. |

---

### D18 · Reprogramming rules (funcionalidade morta)

| Item | Conteúdo |
|---|---|
| **Regra V2** | Não menciona. |
| **Estado atual** | L8: Edge Function aceita `reprogrammingRules` mas o input não é consumido. |
| **Decisão** | **Adaptar.** Decidir com produto: (a) remover do contrato da Edge Function se não há roadmap; (b) documentar como “reservado para futuro” com schema explícito. Default proposto: **remover** até existir caso de uso. |
| **Critério de aceite** | Edge Function tem superfície enxuta; ou (b) há ADR documentando o contrato reservado. |

---

## 3. Pontos de Decisão de Produto (não-técnicos)

Itens que dependem de validação com produto antes de qualquer decisão técnica:

| # | Pergunta | Bloqueia |
|---|---|---|
| Q1 | Spread é cadastrado em base **anual**? (V2 recomenda) | D2, R4 |
| Q2 | Saldo em séries mensais é **abertura** ou **fechamento** do mês? (V2 recomenda fechamento) | D1, D7 |
| Q3 | Há roadmap para Dívida Líquida com caixa real? Em que prazo? | D13 |
| Q4 | `reprogrammingRules` deve ser implementado ou removido? | D18 |
| Q5 | Curto prazo é ≤12m (mercado) ou outro corte? | UI `DebtProfileChart` |
| Q6 | Política de armazenamento histórico de projeções: sobrescrever ou versionar? | D10 |

---

## 4. Sequência de Implementação Recomendada

Ordem proposta, otimizando para reduzir risco de decisão errada do CFO **antes** de refatorações estruturais:

1. **Fase 1 — Verdade única e rotulagem (sem mudança matemática para o usuário final em maioria dos casos):**
   - D2 (centralizar spread), D7 (centralizar saldo analítico), D1 (semântica de saldo), D16 (badges de projeção), D17 (renomear Spread CDI), D13 (remover Dívida Líquida).
2. **Fase 2 — Confiabilidade do CET:**
   - D5 (parar de recalcular CET no front), D12 (`cet_status`), D6 (paridade IRR + suite Vitest).
3. **Fase 3 — Robustez do pipeline:**
   - D15 (delete+insert na Edge), D14 (timezone UTC), D10 (atualização on-demand de projeções).
4. **Fase 4 — Auditabilidade fina e housekeeping:**
   - D8 (tooltips de fonte por parcela), D11 (cenários temporários polidos), D18 (reprogramming rules), D4 (deprecar `calculateWeightedAverageCET`).
5. **Fase 5 — Documentação:**
   - Atualizar `calculationRules.ts`, `CLAUDE.md`, criar `docs/FINANCIAL_CONVENTIONS.md` consolidando este Decision Log + decisões de produto.

Cada fase deve produzir testes de regressão (Vitest) que validem paridade `src/lib` ↔ Edge Function nos cenários afetados.

---

## 5. Resumo de Decisões em Uma Tabela

| ID | Tema | Decisão | Origem |
|---|---|---|---|
| D1 | Saldo abertura/fechamento | Adotar V2 + Adaptar (helper único) | V2 §2, Aud §4.7 |
| D2 | Spread em fallback | Adotar V2 (anual + central) | V2 §8, Aud §4.1 R4 |
| D3 | PRICE pós-fixado | Manter atual + UI | V2 §7, Aud §4.8 |
| D4 | Ponderação CET médio | Adaptar (saldo, deprecar a outra) | V2 §16, Aud §4.3 |
| D5 | CET persistir vs recalcular | Adotar V2 (persistido) | V2 §14/§16, Aud §4.4 R6 |
| D6 | Paridade IRR | Adaptar (port + testes) | V2 §14, Aud §4.5 |
| D7 | Saldo analítico único | Adotar V2 (centralizar) | V2 §16, Aud §4.1 |
| D8 | Auditoria de taxa | Manter + UI | V2 §13 |
| D9 | Período misto | Manter atual (V1) | V2 §8 |
| D10 | Projeção base | Adotar V2 + on-demand | V2 §11 |
| D11 | Cenários temporários | Adotar V2 (futuro por padrão) | V2 §12 |
| D12 | IOF/TAC e CET status | Adotar V2 + `cet_status` | V2 §14, Aud R5 |
| D13 | Dívida Líquida | Adaptar (remover até ter caixa) | Aud §4.6 |
| D14 | Timezone Edge | Adaptar (UTC) | Aud R7 |
| D15 | Pipeline parcelas | Adaptar (Edge transacional) | Aud R1/R2 |
| D16 | Real vs estimativa | Adotar V2 (badges) | V2 §16 |
| D17 | Spread vs CDI | Adaptar (renomear + filtrar) | Aud §6 L6 |
| D18 | Reprogramming rules | Adaptar (remover ou ADR) | Aud L8 |

---

## 6. Próximos Passos

1. **Revisar este documento com produto + engenharia** (1 sessão, ~60 min).
2. Resolver Q1–Q6 da §3.
3. Materializar decisões aprovadas em `docs/FINANCIAL_CONVENTIONS.md` e adicionar referência em `CLAUDE.md`.
4. Quebrar Fase 1 em tarefas executáveis em `docs/CFO_DASHBOARD_V2_TASKS.md`.
5. Iniciar implementação **somente após** aprovação explícita deste log.

---

## 7. Planos de Implementação (aprovados em revisão)

> Cada bloco abaixo é uma instrução autocontida para o agente de implementação.
> O agente deve ler este arquivo, executar apenas os planos listados aqui, e não alterar decisões ainda sem plano.

---

### IMPL-D2 · Centralizar conversão de spread e corrigir bug de edição

**Decisão de referência:** D2 — Spread em fallback analítico  
**Fase:** 1  
**Status:** aprovado

**Contexto para o agente:**
- O banco já armazena `spread_rate` sempre em a.a. (convertido pelo `DebtForm` antes do save).
- O `DebtForm` tem `spreadType: "annual" | "monthly"` e converte corretamente no save.
- Bug: ao carregar uma dívida existente para edição, `spreadType` é sempre resetado para `"annual"` (linhas ~183 e ~229 do `DebtForm.tsx`), perdendo a informação de base original. Como o valor já foi convertido para a.a. no save, o valor numérico está correto — mas o rótulo exibido pode confundir o usuário.
- Os fallbacks analíticos em `OutstandingBalanceChart.tsx` e `DebtProfileChart.tsx` ignoram `spread_rate` ao calcular saldo e PMT, divergindo de `dashboardMetrics.ts` que inclui spread corretamente.

**Tarefas:**

1. **Criar `src/lib/rateUtils.ts`** com as seguintes funções exportadas (sem dependências externas):
   ```
   annualToMonthly(annualRatePct: number): number
     → (1 + annualRatePct / 100)^(1/12) - 1  [retorna decimal, não percentual]

   monthlyToAnnual(monthlyRatePct: number): number
     → (1 + monthlyRatePct / 100)^12 - 1  [retorna decimal, não percentual]

   annualToDaily(annualRatePct: number): number
     → (1 + annualRatePct / 100)^(1/252) - 1  [base 252 dias úteis — padrão brasileiro]

   monthlyToDaily(monthlyRatePct: number): number
     → (1 + monthlyRatePct / 100)^(1/21) - 1  [base ~21 dias úteis/mês]

   getEffectiveMonthlyRate(interestRatePct: number, spreadRatePct: number, rateType: 'annual' | 'monthly'): number
     → converte cada componente para mensal e soma
     → retorna taxa mensal efetiva em decimal (ex: 0.01 para 1%)
   ```
   - Todas as funções devem receber percentual (ex: 12 para 12%) e retornar decimal (ex: 0.0094 para 0.94% a.m.).
   - Incluir JSDoc mínimo explicando base de entrada e saída.
   - Não importar nada de fora de `src/lib/`.

2. **Corrigir bug de edição no `DebtForm.tsx`:**
   - O campo `spread_rate` no banco é sempre a.a. Ao carregar para edição, exibir o valor como a.a. e setar `spreadType = "annual"` — comportamento atual está correto semanticamente.
   - O bug real é que o label pode confundir: adicionar nota no formulário "(valor salvo em a.a.)" próximo ao campo de spread quando em modo edição (`isEditing === true`).
   - Não alterar a lógica de conversão — ela já está correta.

3. **Fazer `OutstandingBalanceChart.tsx` e `DebtProfileChart.tsx` usarem spread no fallback analítico:**
   - Localizar as funções `analyticalOutstandingBalance` e `analyticalCurrentPMT` em cada componente.
   - Substituir o uso direto de `interestRate` por `getEffectiveMonthlyRate(debt.interest_rate, debt.spread_rate ?? 0, debt.rate_type)` importado de `src/lib/rateUtils.ts`.
   - Substituir o cálculo `(ms diff) / (1000·60·60·24·30.44)` por `differenceInMonths` do `date-fns`.
   - Não alterar nenhuma outra lógica dos componentes.

4. **Verificar paridade:**
   - Após as alterações, o KPI "Saldo Devedor Atual" em `DashboardStats` e o KPI equivalente em `OutstandingBalanceChart` devem retornar o mesmo valor para qualquer contrato pós-fixado com spread > 0.

**Arquivos a tocar:**
- `src/lib/rateUtils.ts` (criar)
- `src/components/OutstandingBalanceChart.tsx` (ajustar fallback)
- `src/components/DebtProfileChart.tsx` (ajustar fallback)
- `src/components/DebtForm.tsx` (nota de UX no modo edição)

**Arquivos a NÃO tocar:** Edge Function, banco, migrations, `dashboardMetrics.ts`.

**Critério de aceite:**
- `git grep "30.44"` retorna zero.
- Em contrato pós-fixado com `spread_rate > 0`, KPI do header e KPI do `OutstandingBalanceChart` retornam valores idênticos ao centavo.
- `src/lib/rateUtils.ts` exporta `annualToMonthly`, `annualToDaily`, `monthlyToDaily`, `getEffectiveMonthlyRate`.

---

### IMPL-D7 · Centralizar saldo analítico e PMT em uma única lib

**Decisão de referência:** D7 — Saldo analítico único  
**Fase:** 1  
**Status:** aprovado — Q2 resolvida: usar **saldo de abertura** em toda a aplicação

**Contexto para o agente:**
- Três implementações paralelas de `analyticalOutstandingBalance` e `analyticalCurrentPMT` existem em `dashboardMetrics.ts`, `OutstandingBalanceChart.tsx` e `DebtProfileChart.tsx`.
- Após IMPL-D2, `OutstandingBalanceChart` e `DebtProfileChart` já usarão `rateUtils.ts` e `differenceInMonths`. Este plano vai um passo além: extrai as funções completas de SAC/PRICE para um módulo próprio.
- Convenção definida: saldo exibido é sempre **saldo de abertura do período** (antes do pagamento da parcela). Não implementar modo "fechamento".

**Tarefas:**

1. **Criar `src/lib/balanceCalculator.ts`** com as funções:

   ```
   getAnalyticalOutstanding(debt: LegacyDebt, targetDate: Date): number
     Retorna o saldo de abertura estimado na data alvo.
     - Se há parcelas persistidas em debt_installments: usar a lógica existente de
       "próxima parcela com due_date >= targetDate → seu principal_balance".
     - Se não há parcelas (fallback analítico):
         decorridos = differenceInMonths(targetDate, releaseDate)
         taxaMensal = getEffectiveMonthlyRate(interest_rate, spread_rate, rate_type)  ← de rateUtils.ts
         SAC:   saldo = principal - (principal / n) * decorridos
         PRICE: saldo = principal*(1+i)^dec - PMT*((1+i)^dec - 1)/i
                onde PMT = principal*(i*(1+i)^n)/((1+i)^n - 1)
         Retornar max(saldo, 0).

   getAnalyticalCurrentPMT(debt: LegacyDebt, referenceDate: Date): number
     Retorna o PMT estimado para o período que contém referenceDate.
     - Se há parcela persistida com due_date >= referenceDate: retornar seu total_amount.
     - Fallback analítico:
         taxaMensal = getEffectiveMonthlyRate(...)
         SAC:   juros = getAnalyticalOutstanding(debt, referenceDate) * taxaMensal
                PMT   = (principal / n) + juros
         PRICE: retornar PMT fixo calculado sobre o principal original.
         Se referenceDate > última due_date: retornar 0.
   ```

2. **Substituir as implementações em `dashboardMetrics.ts`:**
   - Localizar `calculateAnalyticalOutstandingBalance` e `calculateAnalyticalCurrentPMT`.
   - Substituir os corpos por chamadas a `getAnalyticalOutstanding` e `getAnalyticalCurrentPMT` de `balanceCalculator.ts`.
   - Manter as assinaturas externas para não quebrar chamadores.

3. **Substituir as implementações em `OutstandingBalanceChart.tsx` e `DebtProfileChart.tsx`:**
   - Após IMPL-D2 já terão o `rateUtils.ts`. Agora remover as funções locais inteiras e importar de `balanceCalculator.ts`.

4. **Não alterar** a lógica que consome `debt_installments` persistidas — ela já está correta nos três lugares.

**Arquivos a tocar:**
- `src/lib/balanceCalculator.ts` (criar)
- `src/lib/dashboardMetrics.ts` (substituir funções analíticas)
- `src/components/OutstandingBalanceChart.tsx` (remover funções locais)
- `src/components/DebtProfileChart.tsx` (remover funções locais)

**Dependência:** executar após IMPL-D2 (precisa de `rateUtils.ts`).

**Critério de aceite:**
- `git grep "analyticalOutstandingBalance\|analyticalCurrentPMT"` retorna zero (funções removidas dos componentes).
- KPI "Saldo Devedor Atual" em `DashboardStats` e em `OutstandingBalanceChart` retornam valores idênticos para qualquer contrato, com ou sem parcelas persistidas.
- Sem regressão em `DebtProfileChart` (barras de curto/longo prazo mantêm proporções).

---

### IMPL-D1 · Corrigir semântica de saldo em debtUtils e OutstandingBalanceChart

**Decisão de referência:** D1 — Saldo devedor, semântica de abertura  
**Fase:** 1  
**Status:** aprovado — convenção: sempre saldo de abertura (antes do pagamento)

**Contexto para o agente:**
- `dashboardMetrics.ts` já busca corretamente a **próxima parcela com `due_date >= hoje`** e usa seu `principal_balance` (saldo de abertura). ✓
- `debtUtils.ts:155-169` busca a **última parcela com `due_date <= targetDate`** — retorna saldo pré-pagamento daquela data, mas na data exata do vencimento isso é o saldo *antes* do pagamento que acabou de ocorrer, divergindo em uma amortização inteira.
- `OutstandingBalanceChart.tsx:240-243` consome `debtUtils` e herda a divergência.
- Após IMPL-D7, `getAnalyticalOutstanding` em `balanceCalculator.ts` já será a fonte para o fallback. Este plano corrige apenas o caminho que lê parcelas persistidas via `debtUtils`.

**Tarefas:**

1. **Corrigir `debtUtils.ts`** na função que resolve saldo por data (linhas ~155-169):
   - Mudar a busca de "última parcela com `due_date <= targetDate`" para "próxima parcela com `due_date >= targetDate`".
   - Se não houver parcela futura (contrato quitado), retornar 0.
   - Não alterar nenhuma outra função do arquivo.

2. **Verificar `OutstandingBalanceChart.tsx:240-243`:**
   - Se consome `debtUtils` diretamente para montar a série mensal, a correção em (1) resolve automaticamente.
   - Se tiver cópia local da lógica, alinhar da mesma forma.

3. **Não alterar** `dashboardMetrics.ts` — já está correto.

**Arquivos a tocar:**
- `src/lib/debtUtils.ts` (ajuste cirúrgico nas linhas ~155-169)
- `src/components/OutstandingBalanceChart.tsx` (verificar e alinhar se necessário)

**Dependência:** pode ser executado em paralelo com IMPL-D2; deve ser executado antes ou junto com IMPL-D7.

**Critério de aceite:**
- Em uma data exatamente igual a um vencimento, o saldo retornado por `debtUtils` é o saldo da *próxima* parcela (após aquele pagamento), não da parcela que venceu.
- Série mensal do `OutstandingBalanceChart` não difere do KPI do header por uma amortização inteira em nenhum mês.

---

### IMPL-D13 · Input de caixa e cálculo de Dívida Líquida

**Decisão de referência:** D13 — Dívida Líquida  
**Fase:** 1  
**Status:** aprovado com escopo ampliado — implementar input simples de caixa

**Contexto para o agente:**
- Não existe card de Dívida Líquida visível na aplicação hoje.
- O objetivo é adicionar um input de saldo de caixa (valor monetário, manual) e exibir a Dívida Líquida calculada como `Saldo Devedor Atual − Caixa`.
- O input deve ficar na mesma linha/altura do botão "Restaurar Layout", mas do **lado esquerdo** da tela. Encontre onde esse botão está renderizado no código para posicionar corretamente.

**Tarefas:**

1. **Localizar o botão "Restaurar Layout"** no codebase e identificar o componente/linha onde ele é renderizado.

2. **Adicionar input de caixa** à esquerda na mesma barra:
   - Label: "Caixa disponível"
   - Usar o componente `CurrencyInput` de `src/components/ui/currency-input.tsx` (padrão obrigatório do projeto — ver `docs/CURRENCY_INPUT_PATTERN.md`).
   - Estado local (não precisa persistir no banco neste momento); manter em `localStorage` com chave `cash_position_{company_id}` para sobreviver a reloads.
   - Valor padrão: 0.

3. **Calcular e exibir Dívida Líquida:**
   - `dividaLiquida = saldoDevedorAtual - caixaDisponivel`
   - Exibir próximo ao input ou como KPI no header, no formato BRL com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
   - Se `dividaLiquida < 0`, exibir em verde (empresa tem mais caixa que dívida).

4. **Alertas:** remover ou não alimentar `netDebt` com `cashAndEquivalents: 0` — usar o valor real do input.

**Arquivos a tocar:**
- Componente que contém o botão "Restaurar Layout" (localizar no codebase)
- `src/lib/dashboardMetrics.ts` se `netDebt` for calculado lá

**Critério de aceite:**
- Input de caixa visível na mesma altura que "Restaurar Layout", à esquerda.
- Alterar o valor do input atualiza a Dívida Líquida em tempo real.
- Valor persiste após reload da página (via `localStorage`).
- Com caixa = 0, Dívida Líquida = Saldo Devedor Atual.

---

### IMPL-D12 · Migration cet_status + não gravar CET não convergido

**Decisão de referência:** D12 — IOF/TAC e CET  
**Fase:** 2 — executar PRIMEIRO (D5 depende desta)  
**Status:** aprovado com ajustes técnicos do arquiteto

**Tarefas:**

1. **Criar migration Supabase** (`supabase/migrations/YYYYMMDD_add_cet_status.sql`):
   ```sql
   CREATE TYPE cet_status_enum AS ENUM ('calculado', 'nao_convergiu', 'pendente');
   ALTER TABLE debts ADD COLUMN cet_status cet_status_enum NOT NULL DEFAULT 'pendente';
   -- Marcar contratos que já têm cet_monthly_rate como calculado
   UPDATE debts SET cet_status = 'calculado' WHERE cet_monthly_rate IS NOT NULL;
   ```

2. **Atualizar `supabase/integrations/supabase/types.ts`** para refletir a nova coluna (ou regenerar via `supabase gen types typescript`).

3. **Corrigir Edge Function** (`supabase/functions/calculate-amortization/index.ts`, linhas ~191-208):
   - Se `converged === false`: gravar `cet_monthly_rate = null`, `cet_annual_rate = null`, `cet_status = 'nao_convergiu'`.
   - Se `converged === true`: gravar os valores calculados e `cet_status = 'calculado'`.
   - Ao iniciar o cálculo de um contrato: gravar `cet_status = 'pendente'` antes do loop (já é o default, mas tornar explícito no UPDATE).

4. **Backfill (executar após a migration):** acionar a Edge Function para todos os contratos com `cet_status = 'pendente'` e parcelas existentes. Pode ser feito via script SQL + Edge Function ou manualmente pelo admin. Documentar o passo no PR.

5. **UI:** nos componentes que exibem CET por contrato ou CET médio, checar `cet_status`:
   - `'calculado'`: exibir o valor normalmente.
   - `'nao_convergiu'`: exibir "—" com tooltip "CET não pôde ser calculado para este contrato".
   - `'pendente'`: exibir spinner ou "calculando…".

**Arquivos a tocar:**
- `supabase/migrations/YYYYMMDD_add_cet_status.sql` (criar)
- `src/integrations/supabase/types.ts` (regenerar ou ajustar manualmente)
- `supabase/functions/calculate-amortization/index.ts` (linhas ~191-208)
- Componentes que exibem CET (localizar no codebase)

**Critério de aceite:**
- Contrato com IRR não convergente exibe "—" e nunca um número arbitrário.
- Contrato novo exibe "calculando…" até a Edge Function completar.
- `cet_status` é um enum Postgres — inserir string inválida falha com erro de constraint.

---

### IMPL-D5 · Parar de recalcular CET no front

**Decisão de referência:** D5 — CET persistir vs recalcular  
**Fase:** 2 — executar APÓS IMPL-D12 + backfill  
**Status:** aprovado

**Tarefas:**

1. **Em `src/lib/dashboardMetrics.ts`** (linhas ~328-345):
   - Remover a chamada a `calculateBatchCET`.
   - Para cada contrato, usar `debt.cet_monthly_rate` diretamente (já lido via `useDebts`).
   - Manter fallback **apenas** para contratos com `cet_status = 'pendente'` ou `cet_monthly_rate === null`: usar `getMonthlyRate` da taxa cadastrada e rotular como estimativa no objeto retornado (ex: `isCetEstimated: true`).

2. **Em `src/lib/cetCalculator.ts`:** marcar `calculateWeightedAverageCET` como `@deprecated` — não remover ainda, apenas evitar novos usos.

3. **Não alterar** `irrCalculator.ts` nesta task.

**Arquivos a tocar:**
- `src/lib/dashboardMetrics.ts`
- `src/lib/cetCalculator.ts` (comentário deprecated)

**Critério de aceite:**
- `git grep "calculateBatchCET"` retorna zero chamadas em `dashboardMetrics.ts`.
- CET exibido no dashboard = valor em `debts.cet_monthly_rate` para contratos com `cet_status = 'calculado'`.
- Sem regressão no CET médio ponderado por saldo.

---

### IMPL-D6 · Paridade IRR — portar derivada analítica para TS

**Decisão de referência:** D6 — Paridade IRR  
**Fase:** 2 — executar após IMPL-D5  
**Status:** aprovado com escopo reduzido

**Contexto:** após D5, `irrCalculator.ts` sai do caminho crítico do dashboard. Este plano apenas alinha a implementação para uso futuro em cenários temporários e simulações.

**Tarefas:**

1. **Em `src/lib/irrCalculator.ts`**, substituir o método de derivada:
   - Remover `calculateNPVDerivative` com diferenças finitas (`delta = 1e-5`).
   - Implementar derivada analítica da fórmula de desconto (espelhar linhas ~518-525 da Edge Function).
   - Adicionar piso no `maxChange`: `Math.abs(annualRate) * 0.1 + 0.01` (igual à Edge).

2. **Não configurar Vitest** nesta task. A paridade é validada manualmente comparando outputs para 3 contratos representativos (pré-fixado simples, pós-fixado com spread, contrato com IOF alto) antes do merge.

3. **Não alterar** assinaturas exportadas — apenas a implementação interna.

**Arquivos a tocar:**
- `src/lib/irrCalculator.ts`

**Critério de aceite:**
- Para os 3 vetores de teste manuais, `irrCalculator.ts` e Edge Function retornam taxas com diferença < 0.001 p.p.
- `calculateNPVDerivative` com diferenças finitas removida do arquivo.

---

---

### IMPL-D15 · Pipeline transacional de parcelas na Edge Function

**Decisão de referência:** D15 — Pipeline de delete + insert  
**Fase:** 3  
**Status:** aprovado

**Tarefas:**

1. **Remover `delete debt_installments` do front** (`src/hooks/useDebts.tsx:140`). O front passa a apenas chamar a Edge Function e aguardar resposta.

2. **Tornar a Edge Function idempotente:** mover o `DELETE FROM debt_installments WHERE debt_id = $1` para dentro da mesma chamada SQL da Edge, executado antes do bulk insert (sem transação explícita — Postgres garante atomicidade do DML em sequência dentro da mesma conexão).

3. **Propagar erros de insert:** remover qualquer `try/catch` silencioso em torno do DML de inserção de parcelas. A Edge deve lançar exceção (ou retornar 4xx/5xx com body `{ error: string }`) em caso de falha — nunca retornar `200 OK` com insert incompleto.

4. **UI:** nos componentes que chamam a Edge Function (localizar via `calculate-amortization`), garantir que resposta com status ≥ 400 seja tratada como erro e exiba toast acionável (padrão `sonner` já usado no projeto).

**Arquivos a tocar:**
- `src/hooks/useDebts.tsx` (remover delete)
- `supabase/functions/calculate-amortization/index.ts` (mover delete, propagar erros)
- Componentes que chamam a Edge (localizar no codebase)

**Critério de aceite:**
- Falha simulada do insert deixa parcelas anteriores intactas (sem janela vazia).
- UI exibe mensagem de erro acionável quando a Edge retorna 4xx/5xx.
- `git grep "delete.*debt_installments"` retorna zero no front.

---

### IMPL-D14 · Padronizar manipulação de datas em UTC (Edge + front)

**Decisão de referência:** D14 — Datas e timezone  
**Fase:** 3  
**Status:** aprovado — escopo inclui Edge Function e front

**Contexto para o agente:**
- `new Date('YYYY-MM-DD')` sem sufixo `Z` é parseado como UTC pela Edge (Deno) mas como local pelo browser. Em timezone `-03:00`, `new Date('2025-03-31')` vira `2025-03-30T21:00:00` local — deslocando 1 dia em datas-borda.
- Candidatos no front: componentes que constroem `Date` a partir de strings ISO sem `T00:00:00Z` (`OutstandingBalanceChart`, `DebtProfileChart`, `debtUtils`).

**Tarefas:**

1. **Edge Function** (`calculate-amortization/index.ts`): revisar todos os `new Date(dateString)` onde `dateString` é `YYYY-MM-DD`. Substituir por `new Date(dateString + 'T00:00:00Z')` ou pelo utilitário Deno equivalente.

2. **Front:** auditar `OutstandingBalanceChart.tsx`, `DebtProfileChart.tsx` e `src/lib/debtUtils.ts` para o mesmo padrão. Substituir da mesma forma.

3. **Validação visual:** após as alterações, usar o skill `make-interfaces-feel-better` ou `ui-ux-pro-max` (ou agente UX) para revisar os gráficos em tela e confirmar que as séries mensais não deslocaram visualmente — especialmente em datas-borda (31/jan, 28/fev, início de mês).

**Arquivos a tocar:**
- `supabase/functions/calculate-amortization/index.ts`
- `src/components/OutstandingBalanceChart.tsx`
- `src/components/DebtProfileChart.tsx`
- `src/lib/debtUtils.ts`

**Critério de aceite:**
- `git grep "new Date(" -- src/ supabase/functions/` não retorna strings `YYYY-MM-DD` sem sufixo `Z`.
- Série mensal dos gráficos não desloca 1 dia em meses com 28/31 dias.
- Agente de frontend confirma ausência de regressão visual.

---

### IMPL-D10 · Botão "Atualizar projeções" on-demand

**Decisão de referência:** D10 — Projeção base por empresa  
**Fase:** 3  
**Status:** aprovado — implementação condicional à verificação de schema

**Contexto para o agente:**
- Existe ambiguidade entre `index_projections` e `company_index_projections`. A Edge Function `fetch-bcb-rates` pode gravar globalmente ou por empresa — comportamento não auditado.
- O `useEffect` de inicialização automática foi desativado (CLAUDE.md armadilha #1) por causar loop 401. **Não reativar.**

**Tarefas — executar nesta ordem:**

1. **Verificar schema:** ler `supabase/migrations/` e `src/integrations/supabase/types.ts` para confirmar qual tabela existe (`index_projections`, `company_index_projections`, ou ambas) e sua estrutura (`company_id` presente?).

2. **Auditar `fetch-bcb-rates`** (`supabase/functions/fetch-bcb-rates/index.ts`): verificar se grava por `company_id` ou globalmente. Se global, o plano de implementação muda (precisa de adaptação para isolamento por empresa).

3. **Só após (1) e (2) confirmados**, implementar o botão "Atualizar projeções":
   - Localizar onde ficam os controles globais do dashboard (próximo a `GlobalFilters.tsx` ou header).
   - Botão chama `fetch-bcb-rates` com `company_id` da empresa ativa.
   - Exibir data-base do último dado gravado próximo ao botão.
   - Loading e erro tratados com toast (padrão `sonner`).

**Arquivos a tocar (após verificação):**
- `supabase/functions/fetch-bcb-rates/index.ts` (se precisar de ajuste de isolamento)
- Componente de controles globais (localizar no codebase)

**Critério de aceite:**
- CFO consegue atualizar projeções com um clique e vê a data-base do dado.
- Nenhum loop de 401 em background.
- Se a tabela não existir ou `fetch-bcb-rates` for global, o agente deve parar e reportar ao produto antes de continuar.

---

---

### IMPL-D3 · Badge "PMT recalculada por período" em contratos PRICE pós-fixado

**Decisão de referência:** D3 — PRICE pós-fixado  
**Fase:** 1 (complemento — não altera lógica financeira)  
**Status:** aprovado

**Contexto para o agente:**
- A Edge Function já implementa re-PRICE corretamente: a PMT é recalculada a cada período com saldo de abertura, taxa efetiva e prazo remanescente. O comportamento está correto, mas invisível ao CFO.
- O objetivo é apenas comunicar que a parcela varia — sem tocar em nenhuma lógica de cálculo.

**Tarefas:**

1. Identificar onde contratos PRICE pós-fixado exibem o valor de PMT — cards de KPI (`DashboardStats`), tabela de parcelas (`AmortizationTable`) e `PaymentScheduleTable`.

2. Adicionar badge ou nota discreta (ex: texto "PMT variável" com ícone de informação) visível apenas quando `calculationTable === 'PRICE'` e `rateType === 'post'` (ou `interest_base` não é pré-fixado).

3. Tooltip do KPI "PMT Corrente": adicionar texto explicando que "a parcela é recalculada a cada período com base no saldo devedor e na projeção do indexador vigente".

4. Não alterar nenhuma lógica de cálculo — apenas UI.

**Arquivos a tocar:**
- `src/components/DashboardStats.tsx` (tooltip do KPI PMT)
- `src/components/AmortizationTable.tsx` (badge por linha ou cabeçalho)
- `src/components/PaymentScheduleTable.tsx` (idem)

**Critério de aceite:**
- Contrato PRICE pré-fixado: badge não aparece.
- Contrato PRICE pós-fixado (ex: PRICE + CDI): badge/nota visível e tooltip explicativo presente.
- Contrato SAC: badge não aparece independente do indexador.

---

---

### IMPL-D8 · Tooltips de fonte por parcela em contratos pós-fixados

**Decisão de referência:** D8 — Auditoria de taxa por parcela  
**Fase:** 4  
**Status:** aprovado

**Contexto para o agente:**
- A Edge Function já popula `debt_installment_rate_refs` via RPC `replace_debt_installment_schedule`. Os dados existem no banco.
- Cada linha da tabela contém: `index_type`, `period_start`, `period_end`, `rate`, `rate_type`, `source` (`bcb_realizado` | `projecao_base` | `cenario_temporario`), `scenario_label`, `source_reference_date`.
- A UI ainda não lê essa tabela.

**Tarefas:**

1. Criar hook `useInstallmentRateRefs(debtId: string)` que lê `debt_installment_rate_refs` filtrado por `debt_id` via Supabase. Agrupar por `installment_number` para lookup O(1).

2. Em `AmortizationTable.tsx`, para cada linha de parcela pós-fixada, adicionar ícone de informação com tooltip exibindo: indexador, taxa do período, fonte (traduzida para pt-BR: "BCB realizado", "Projeção base", "Cenário temporário") e data-base (`source_reference_date`).

3. Parcelas pré-fixadas: não exibir tooltip de fonte (não têm `rate_refs`).

4. KPIs agregados (PMT 90d, juros futuros): exibir badge discreto se a janela contém parcelas com `source = 'projecao_base'` ou `source = 'cenario_temporario'`. Localizar onde esses KPIs são calculados e renderizados.

**Arquivos a tocar:**
- `src/hooks/useInstallmentRateRefs.ts` (criar)
- `src/components/AmortizationTable.tsx`
- Componentes de KPIs agregados (localizar no codebase)

**Critério de aceite:**
- Hover em parcela pós-fixada exibe: indexador, taxa, fonte e data-base.
- Parcelas pré-fixadas não exibem tooltip de fonte.
- KPIs agregados com parcelas projetadas exibem badge visível.

---

### IMPL-D11 · Rotulagem do escopo de cenários temporários e toggle contrafactual

**Decisão de referência:** D11 — Cenários temporários  
**Fase:** 4  
**Status:** aprovado

**Contexto para o agente:**
- `useTemporaryScenario` já existe e funciona: armazena ajustes de CDI/SELIC/IPCA em memória e propaga via CustomEvent.
- `applyOverridesOnlyToFuture: true` já está em `AmortizationTable` e `ConsolidatedAmortizationTable` — o comportamento padrão (aplicar só a períodos futuros) já está correto.
- O que falta: (a) tornar o escopo visível ao CFO e (b) adicionar toggle para simulação contrafactual.

**Tarefas:**

1. Na UI onde o cenário temporário é configurado (localizar `SensitivityDashboard.tsx`), adicionar indicador textual do escopo ativo: "Aplicando a períodos futuros" quando `applyOverridesOnlyToFuture = true`.

2. Adicionar toggle "Incluir histórico realizado" com label explícita "Simulação contrafactual — altera parcelas já ocorridas". Quando ativado, passa `applyOverridesOnlyToFuture: false` nos componentes que consomem `toOverrides()`.

3. O toggle deve ser visivelmente diferenciado (ex: cor de aviso) para deixar claro que é uma simulação fora do padrão.

4. Histórico realizado nunca muda silenciosamente — o toggle deve estar desativado por padrão e resetar ao fechar o painel de cenário.

**Arquivos a tocar:**
- `src/components/SensitivityDashboard.tsx`
- `src/hooks/useTemporaryScenario.tsx` (adicionar flag `applyToHistory`)
- `src/components/AmortizationTable.tsx` (consumir flag)
- `src/components/ConsolidatedAmortizationTable.tsx` (consumir flag)

**Critério de aceite:**
- Com toggle desativado (padrão), histórico realizado não muda ao aplicar cenário.
- Com toggle ativado, label "Simulação contrafactual" visível e destacada.
- Toggle reseta para desativado ao fechar o painel de cenário.

---

---

### IMPL-D18 · Remover reprogrammingRules da Edge Function

**Decisão de referência:** D18 — Reprogramming rules  
**Fase:** 4  
**Status:** aprovado — remover

**Tarefas:**

1. Em `supabase/functions/calculate-amortization/index.ts`:
   - Remover `reprogrammingRules` das interfaces `DebtData` e `CalculationParams`.
   - Remover do destructuring do input (linha ~86).
   - Remover o log `hasReprogrammingRules` (linha ~107).
   - Remover o parâmetro da chamada e assinatura de `calculateAmortizationJS`.

2. Verificar se há outros arquivos na Edge Function que referenciam o campo e limpar.

**Arquivos a tocar:**
- `supabase/functions/calculate-amortization/index.ts`

**Critério de aceite:**
- `grep -r "reprogrammingRules"` retorna zero em todo o projeto.

---

*Fim do documento.*
