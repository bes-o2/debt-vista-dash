import { useEffect } from "react";

const Docs = () => {
  useEffect(() => {
    document.title = "Auditoria Financeira — Dashboard CFO";
  }, []);

  return (
    <>
      <style>{docsStyles}</style>
      <div className="docs-page">
        <aside className="docs-toc" aria-label="Sumário">
          <div className="toc-inner">
            <p className="toc-eyebrow">debt-vista-dash · docs</p>
            <h2 className="toc-title">Auditoria Financeira</h2>
            <p className="toc-meta">2026-05-05 · branch <code>feature/modal-selecao-empresa</code></p>
            <nav>
              <ol>
                <li><a href="#sec-1">1. Resumo Executivo</a></li>
                <li><a href="#sec-2">2. Arquitetura do Fluxo de Dados</a></li>
                <li><a href="#sec-3">3. Mapa de Fluxo por Métrica</a></li>
                <li><a href="#sec-4">4. Divergências e Inconsistências</a></li>
                <li><a href="#sec-5">5. Riscos Matemáticos</a></li>
                <li><a href="#sec-6">6. Auditoria de UI</a></li>
                <li><a href="#sec-7">7. Lacunas</a></li>
                <li><a href="#sec-8">8. Plano de Ação</a></li>
                <li><a href="#sec-apendice">Apêndice</a></li>
              </ol>
            </nav>
            <p className="toc-foot">
              <a href="/">← voltar para o app</a>
            </p>
          </div>
        </aside>

        <main className="docs-body">
          <header className="docs-header">
            <p className="kicker">Documento de auditoria</p>
            <h1>Auditoria Financeira — Dashboard CFO</h1>
            <p className="lede">
              Auditoria da lógica financeira (SAC, PRICE, CET, TIR) e sua representação
              no Dashboard. Escopo: arquivos de cálculo (<code>src/lib</code>), edge
              function <code>calculate-amortization</code>, hooks de dados e cards do
              dashboard.
            </p>
            <dl className="docs-meta">
              <div><dt>Data</dt><dd>2026-05-05</dd></div>
              <div><dt>Branch</dt><dd><code>feature/modal-selecao-empresa</code></dd></div>
              <div><dt>Confiança geral</dt><dd><span className="badge badge-warn">Média</span></dd></div>
            </dl>
          </header>

          <hr />

          <section id="sec-1">
            <h2>1. Resumo Executivo <a className="anchor" href="#sec-1" aria-label="Link para esta seção">¶</a></h2>
            <p>
              <strong>Confiança geral: MÉDIA.</strong>
            </p>
            <p>
              O núcleo de cálculo (SAC/PRICE no edge function, IRR/CET via
              Newton-Raphson) está bem estruturado e segue as fórmulas padrão. A
              representação no dashboard prioriza <strong>parcelas reais</strong>{" "}
              persistidas no banco, com fallbacks analíticos quando necessário — uma
              decisão correta.
            </p>
            <p>
              A confiança não é Alta porque <em>a mesma métrica é calculada por
              funções diferentes em cada componente</em>, com pequenas variações que
              produzem números visualmente próximos mas não idênticos. Em particular:
            </p>
            <ul>
              <li>
                O <strong>spread</strong> de contratos pós-fixados é incluído no
                cálculo do dashboard (<code>dashboardMetrics</code>) mas{" "}
                <strong>ignorado</strong> nos fallbacks analíticos de{" "}
                <code>OutstandingBalanceChart</code> e <code>DebtProfileChart</code>.
              </li>
              <li>
                "Dívida Líquida" é hardcoded <strong>igual à Dívida Bruta</strong>{" "}
                porque não há campo de caixa/equivalente, mas o sistema de alertas
                opera sobre essa métrica como se fosse real.
              </li>
              <li>
                O <strong>CET médio</strong> é ponderado por{" "}
                <code>financedAmount</code> em <code>cetCalculator.ts</code> e por{" "}
                <strong>saldo devedor</strong> em <code>dashboardMetrics.ts</code> —
                duas verdades coexistem.
              </li>
            </ul>
            <p>
              Não há bugs matemáticos graves identificados, mas há ambiguidades
              semânticas (especialmente o significado de <code>remaining_balance</code>)
              que merecem alinhamento antes que o dashboard seja usado para decisões
              de refinanciamento.
            </p>
          </section>

          <hr />

          <section id="sec-2">
            <h2>2. Arquitetura do Fluxo de Dados <a className="anchor" href="#sec-2" aria-label="Link para esta seção">¶</a></h2>

            <h3>Camadas</h3>
            <table>
              <thead>
                <tr><th>Camada</th><th>Responsabilidade</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Banco (Postgres)</strong></td>
                  <td>Persiste contratos (<code>debts</code>), parcelas calculadas (<code>debt_installments</code>), CET por contrato (<code>debts.cet_*</code>), histórico de taxas usadas (<code>debt_installment_rate_refs</code>) e índices econômicos (<code>economic_indices</code>, <code>index_projections</code>).</td>
                </tr>
                <tr>
                  <td><strong>Edge Function (Deno)</strong></td>
                  <td><code>calculate-amortization</code> — única fonte de verdade para gerar o cronograma SAC/PRICE e calcular o CET via IRR. Chamado tanto na criação quanto on-demand quando faltam parcelas.</td>
                </tr>
                <tr>
                  <td><strong>Hooks de dados (React)</strong></td>
                  <td><code>useDebts</code> (CRUD), <code>useDebtInstallments</code> (busca parcelas; aciona o edge function se faltarem), <code>useDashboardMetrics</code> (orquestra agregações), <code>useEconomicIndices</code> (CDI/SELIC/IPCA).</td>
                </tr>
                <tr>
                  <td><strong>Lib pura (<code>src/lib</code>)</strong></td>
                  <td><code>dashboardMetrics.ts</code> (KPIs do header), <code>cetCalculator.ts</code> + <code>irrCalculator.ts</code> (CET por TIR), <code>debtUtils.ts</code> (normalização e saldo legado).</td>
                </tr>
                <tr>
                  <td><strong>Componentes</strong></td>
                  <td><code>DashboardStats</code> (cards de KPIs), <code>OutstandingBalanceChart</code> (saldo por banco + KPIs próprios), <code>DebtProfileChart</code> (curto vs longo prazo), <code>DebtChart</code> (comparativo). <em>Cada um faz suas próprias agregações.</em></td>
                </tr>
              </tbody>
            </table>

            <h3>User Story end-to-end</h3>
            <pre><code>{`1. CFO cadastra dívida via DebtForm
   └── handleSaveDebt (Index.tsx:188)
       ├── createDebtAsync → INSERT em \`debts\`
       └── syncDebtInstallments → invoca edge function \`calculate-amortization\`
           ├── Para SAC: amortização constante = financiado / N
           │   parcela = amortização + saldo × taxa_efetiva_do_período
           ├── Para PRICE pré-fixado: PMT fixa pela fórmula clássica
           ├── Para PRICE pós-fixado: PMT recalculada a cada período
           │   usando saldo remanescente e a taxa efetiva resolvida
           ├── Resolve indexador (CDI/SELIC/IPCA) via \`getEffectiveRate.ts\`
           │   consulta \`economic_indices\` (passado) ou \`index_projections\` (futuro)
           ├── DELETE + INSERT em \`debt_installments\`
           └── Calcula CET via IRR (Newton-Raphson) e UPDATE em \`debts.cet_*_rate\`

2. CFO abre Dashboard
   └── useDashboardMetrics (useDashboardMetrics.tsx:21)
       ├── useDebts → SELECT * FROM debts WHERE company_id = …
       ├── useDebtInstallments → SELECT * FROM debt_installments WHERE debt_id IN (…)
       │   └── Se algum debt está sem parcelas → invoca edge function on-the-fly
       ├── useDebtGuarantees → métricas de garantias
       ├── useEconomicIndices → última taxa CDI conhecida
       └── computeDashboardMetrics(…) → agrega tudo em DashboardMetrics

3. Componentes renderizam
   ├── DashboardStats consome \`metrics.*\` (números prontos)
   ├── OutstandingBalanceChart e DebtProfileChart **refazem** o cálculo
   │   localmente com seus próprios useDebtInstallments e fórmulas analíticas
   └── Cards mostram KPIs com tooltips estáticos + popovers de
       pseudocódigo (CalculationInfoPopover ← src/lib/calculationRules.ts)`}</code></pre>

            <p className="callout">
              <strong>Pegadinha estrutural:</strong> os dados do dashboard descem em
              duas trilhas paralelas. <code>DashboardStats</code> lê de{" "}
              <code>dashboardMetrics</code>. <code>OutstandingBalanceChart</code> e{" "}
              <code>DebtProfileChart</code> reimplementam fórmulas analíticas próprias.
              Isso explica boa parte das divergências da §4.
            </p>
          </section>

          <hr />

          <section id="sec-3">
            <h2>3. Mapa de Fluxo por Métrica <a className="anchor" href="#sec-3" aria-label="Link para esta seção">¶</a></h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Métrica</th>
                    <th>Onde é calculada</th>
                    <th>Persistida?</th>
                    <th>Dinâmica?</th>
                    <th>Arquivo:Linha</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><strong>Saldo Devedor (parcela)</strong></td><td>Edge function — guarda <code>remaining_balance</code> por parcela</td><td>Sim (<code>debt_installments.remaining_balance</code>)</td><td>Sim p/ pós-fixado</td><td><code>…/calculate-amortization/index.ts:430-440</code></td></tr>
                  <tr><td><strong>Saldo Devedor Atual (KPI)</strong></td><td><code>dashboardMetrics</code> — lê próx. parcela; fallback analítico</td><td>Não</td><td>Indireta</td><td><code>dashboardMetrics.ts:243-251</code></td></tr>
                  <tr><td><strong>Saldo Devedor (gráfico Banco)</strong></td><td><code>OutstandingBalanceChart</code> — KPIs analíticos próprios + série mensal por parcelas</td><td>Não</td><td>Não no fallback (ignora indexador)</td><td><code>OutstandingBalanceChart.tsx:76-111, 195-254</code></td></tr>
                  <tr><td><strong>Saldo Devedor (Perfil Dívida)</strong></td><td><code>DebtProfileChart</code> — analítico próprio + parcelas</td><td>Não</td><td>Não no fallback</td><td><code>DebtProfileChart.tsx:175-217</code></td></tr>
                  <tr><td><strong>PMT (parcela do mês)</strong></td><td>Edge function — <code>installment_amount</code> por parcela</td><td>Sim (<code>debt_installments.total_amount</code>)</td><td>Sim p/ pós-fixado</td><td><code>…/calculate-amortization/index.ts:430-440</code></td></tr>
                  <tr><td><strong>PMT Corrente (KPI)</strong></td><td><code>dashboardMetrics</code> — próx. parcela; fallback analítico</td><td>Não</td><td>Indireta</td><td><code>dashboardMetrics.ts:253-263, 149-185</code></td></tr>
                  <tr><td><strong>PMT 30/90/180d, pico 12m</strong></td><td><code>dashboardMetrics</code> — soma <code>total_amount</code> por janela</td><td>Não</td><td>Indireta</td><td><code>dashboardMetrics.ts:265-308</code></td></tr>
                  <tr><td><strong>CET por contrato</strong></td><td>Edge function — IRR (Newton-Raphson, anual ↔ mensal)</td><td>Sim (<code>debts.cet_*_rate</code>)</td><td>Sim</td><td><code>…/calculate-amortization/index.ts:482-574</code></td></tr>
                  <tr><td><strong>CET média (carteira)</strong></td><td><code>dashboardMetrics</code> — recalcula via <code>calculateBatchCET</code>, pondera pelo saldo</td><td>Não</td><td>Sim</td><td><code>dashboardMetrics.ts:328-360</code></td></tr>
                  <tr><td><strong>CET média (cetCalculator)</strong></td><td><code>calculateWeightedAverageCET</code> — pondera pelo financedAmount</td><td>Não</td><td>Sim</td><td><code>cetCalculator.ts:86-112</code></td></tr>
                  <tr><td><strong>TIR (IRR)</strong></td><td>Implementação dupla (TS no front + Deno na edge)</td><td>Não</td><td>Depende dos cash flows</td><td><code>irrCalculator.ts:46-114</code> e edge</td></tr>
                  <tr><td><strong>Spread médio sobre CDI</strong></td><td><code>averageAnnualCET − cdiAnnualRate</code></td><td>Não</td><td>Sim (CDI atual do BCB)</td><td><code>dashboardMetrics.ts:361</code></td></tr>
                  <tr><td><strong>Prazo médio restante</strong></td><td>Diff calendário entre <code>releaseDate</code> e <code>dueDate</code>, ponderado pelo saldo</td><td>Não</td><td>Não</td><td><code>dashboardMetrics.ts:363-382</code></td></tr>
                  <tr><td><strong>Dívida Bruta</strong></td><td>Igual a <code>currentOutstandingBalance</code></td><td>Não</td><td>—</td><td><code>DashboardStats.tsx:213-214</code></td></tr>
                  <tr><td><strong>Dívida Líquida</strong></td><td><strong>Hardcoded = Dívida Bruta</strong> (caixa não rastreado)</td><td>Não</td><td>—</td><td><code>DashboardStats.tsx:213-217</code>; <code>dashboardMetrics.ts:434</code></td></tr>
                  <tr><td><strong>Concentração por banco/indexador</strong></td><td>Soma do saldo agrupado</td><td>Não</td><td>Indireta</td><td><code>dashboardMetrics.ts:390-411</code></td></tr>
                  <tr><td><strong>Cobertura de garantias</strong></td><td><code>useDebtGuarantees</code> agrega valores cadastrados</td><td>Sim (<code>debt_guarantees</code>)</td><td>Não</td><td><code>useDebtGuarantees.tsx</code></td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <hr />

          <section id="sec-4">
            <h2>4. Divergências e Inconsistências <a className="anchor" href="#sec-4" aria-label="Link para esta seção">¶</a></h2>

            <h3 id="sec-4-1">4.1 Saldo Devedor — três fórmulas analíticas paralelas <a className="anchor" href="#sec-4-1" aria-label="Link para esta seção">¶</a></h3>
            <p>
              A mesma "Saldo Devedor Atual" tem três implementações analíticas
              independentes para quando não há parcelas persistidas:
            </p>
            <table>
              <thead>
                <tr><th>Implementação</th><th>Diff de meses</th><th>Inclui spread?</th><th>Arquivo:Linha</th></tr>
              </thead>
              <tbody>
                <tr><td><code>dashboardMetrics.calculateAnalyticalOutstandingBalance</code></td><td><code>diffInMonths</code> (calendário)</td><td><strong>Sim</strong> (<code>getMonthlyRate</code> soma <code>spreadRate</code>)</td><td><code>dashboardMetrics.ts:113-147, 59-66</code></td></tr>
                <tr><td><code>OutstandingBalanceChart.analyticalOutstandingBalance</code></td><td><code>(ms diff) / (1000·60·60·24·30.44)</code></td><td><strong>Não</strong> (usa só <code>interestRate</code>)</td><td><code>OutstandingBalanceChart.tsx:76-111</code></td></tr>
                <tr><td><code>DebtProfileChart.analyticalOutstandingBalance</code></td><td><code>(ms diff) / (1000·60·60·24·30.44)</code></td><td><strong>Não</strong></td><td><code>DebtProfileChart.tsx:175-217, 170-173</code></td></tr>
              </tbody>
            </table>
            <p>
              O comentário em <code>OutstandingBalanceChart.tsx:75</code> afirma que a
              fórmula é "Mesma fórmula usada em DashboardStats … para garantir
              consistência entre os KPIs do header e o card de Saldo Devedor Atual" —
              mas isso vale <strong>apenas</strong> para contratos pré-fixados sem
              spread. Qualquer pós-fixado ou contrato com{" "}
              <code>spread_rate &gt; 0</code> produzirá saldos divergentes nos dois
              cards.
            </p>
            <p>Fórmula comum (SAC vs PRICE) é a clássica em ambos:</p>
            <ul>
              <li><strong>SAC:</strong> <code>saldo = principal − (principal/N) × decorridos</code></li>
              <li><strong>PRICE:</strong> <code>saldo = principal × (1+i)^decorridos − PMT × ((1+i)^decorridos − 1)/i</code></li>
            </ul>
            <p>
              Não emito julgamento sobre qual é "a correta" — depende da definição
              contábil que a O2 adota para spread em contratos pós-fixados.
            </p>

            <h3 id="sec-4-2">4.2 PMT Corrente — mesma divergência <a className="anchor" href="#sec-4-2" aria-label="Link para esta seção">¶</a></h3>
            <table>
              <thead>
                <tr><th>Implementação</th><th>Inclui spread?</th><th>Arquivo:Linha</th></tr>
              </thead>
              <tbody>
                <tr><td><code>dashboardMetrics.calculateAnalyticalCurrentPMT</code></td><td><strong>Sim</strong></td><td><code>dashboardMetrics.ts:149-185</code></td></tr>
                <tr><td><code>OutstandingBalanceChart.analyticalCurrentPMT</code></td><td><strong>Não</strong></td><td><code>OutstandingBalanceChart.tsx:114-150</code></td></tr>
              </tbody>
            </table>
            <p>
              Para contratos com parcelas persistidas, ambos usam{" "}
              <code>total_amount</code> da próxima parcela e batem. A divergência só
              aparece em contratos sem parcelas.
            </p>

            <h3 id="sec-4-3">4.3 CET média — duas formas de ponderação <a className="anchor" href="#sec-4-3" aria-label="Link para esta seção">¶</a></h3>
            <table>
              <thead>
                <tr><th>Função</th><th>Peso usado</th><th>Arquivo:Linha</th></tr>
              </thead>
              <tbody>
                <tr><td><code>calculateWeightedAverageCET</code></td><td><code>financedAmount</code></td><td><code>cetCalculator.ts:86-112</code></td></tr>
                <tr><td><code>dashboardMetrics</code> (CET da carteira)</td><td><strong>Saldo devedor atual</strong></td><td><code>dashboardMetrics.ts:347-360</code></td></tr>
              </tbody>
            </table>
            <p>
              Para uma carteira com contratos antigos quase quitados, as duas médias
              divergem significativamente. A função em <code>cetCalculator.ts</code> é
              exportada e poderia ser invocada por outros componentes futuros, criando
              risco de retrabalho.
            </p>

            <h3 id="sec-4-4">4.4 CET no fallback ≠ CET por TIR <a className="anchor" href="#sec-4-4" aria-label="Link para esta seção">¶</a></h3>
            <p>
              Quando o batch IRR não converge (ou não há parcelas),{" "}
              <code>dashboardMetrics.ts:354</code> usa:
            </p>
            <pre><code>{`const monthlyRate = cetResult ? cetResult.monthlyRate : getMonthlyCET(debt);`}</code></pre>
            <p>
              E <code>getMonthlyCET</code> (linha 197-202) retorna{" "}
              <code>cet_monthly_rate</code> persistido <strong>ou</strong> a taxa
              nominal mensal — nunca recalcula com IOF/TAC. Isso significa que, no
              fallback, a "CET" exibida é apenas a taxa nominal, não o custo efetivo.
              Pode confundir um CFO que está comparando contratos onde alguns
              convergiram e outros não.
            </p>

            <h3 id="sec-4-5">4.5 IRR — duas implementações independentes <a className="anchor" href="#sec-4-5" aria-label="Link para esta seção">¶</a></h3>
            <p>
              <code>src/lib/irrCalculator.ts</code> e a função <code>calculateCET</code>
              {" "}dentro de <code>…/calculate-amortization/index.ts:482-574</code>{" "}
              resolvem o mesmo problema com diferenças sutis:
            </p>
            <table>
              <thead>
                <tr><th>Aspecto</th><th>TS (front)</th><th>Deno (edge)</th></tr>
              </thead>
              <tbody>
                <tr><td>Derivada do NPV</td><td>Numérica (diferença finita, <code>delta=1e-5</code>)</td><td>Analítica (linha 525)</td></tr>
                <tr><td><code>maxChange</code> por iteração</td><td><code>annualRate * 0.1</code></td><td><code>Math.abs(annualRate) * 0.1 + 0.01</code></td></tr>
                <tr><td>Comportamento perto de <code>annualRate ≈ 0</code></td><td>Converge devagar</td><td>Mais robusto</td></tr>
                <tr><td>Estado de "não convergiu"</td><td>Retorna mesmo assim</td><td>Idem</td></tr>
              </tbody>
            </table>
            <p>
              Em contratos exóticos (taxa muito baixa, prazo curto, IOF alto) os dois
              podem convergir para valores ligeiramente diferentes — relevante porque
              o front usa <code>calculateBatchCET</code> (TS) e ignora o{" "}
              <code>cet_monthly_rate</code> persistido pelo Deno.
            </p>

            <h3 id="sec-4-6">4.6 Dívida Bruta vs Líquida <a className="anchor" href="#sec-4-6" aria-label="Link para esta seção">¶</a></h3>
            <p>Em <code>DashboardStats.tsx:213-217</code>:</p>
            <pre><code>{`netDebt: {
  grossDebtAmount: currentOutstandingBalance,
  cashAndEquivalents: 0,
  netDebtAmount: currentOutstandingBalance,
}`}</code></pre>
            <p>
              O sistema de alertas (<code>generateCfoAlerts</code>) recebe os dois
              como iguais. Não há rastreamento de caixa em lugar nenhum —{" "}
              <code>dashboardMetrics.netDebt</code> é literalmente <code>null</code>.
              O componente obsoleto <code>_obsolete/NetDebtCard.tsx</code> previa um
              input para o CFO digitar o caixa, mas o <code>return null</code> no fim
              (<code>linha 83</code>) já indica que foi descontinuado sem substituto.
            </p>

            <h3 id="sec-4-7">4.7 Semântica de <code>remaining_balance</code> <a className="anchor" href="#sec-4-7" aria-label="Link para esta seção">¶</a></h3>
            <p>No edge function (<code>…/index.ts:430-440, 463</code>):</p>
            <pre><code>{`installments.push({
  …
  principal_balance: Number(remainingBalance.toFixed(2)),  // ← saldo ABERTURA do período
  …
});
remainingBalance -= amortizationAmount;  // só decrementa depois`}</code></pre>
            <p>
              O campo persistido é <strong>o saldo no início do período da parcela</strong>,
              não após o pagamento. O front consome de duas formas diferentes:
            </p>
            <ul>
              <li>
                <code>dashboardMetrics.ts:98-103</code> busca a{" "}
                <strong>próxima parcela com <code>due_date ≥ hoje</code></strong> e
                usa seu <code>remaining_balance</code> — semanticamente correto (saldo
                antes da próxima parcela = saldo atual devido).
              </li>
              <li>
                <code>debtUtils.ts:155-169</code> busca a{" "}
                <strong>última parcela com <code>due_date ≤ targetDate</code></strong>{" "}
                e usa seu <code>remaining_balance</code> — isso retorna o saldo no
                início daquele mês, <strong>antes</strong> do pagamento.
              </li>
              <li>
                <code>OutstandingBalanceChart.tsx:240-243</code> segue a lógica de{" "}
                <code>debtUtils.ts</code>.
              </li>
            </ul>
            <p>
              Não está claro qual é a intenção de produto (saldo "de manhã" vs "de
              noite"). Para horizontes mensais a diferença é exatamente uma
              amortização — visualmente perceptível.
            </p>

            <h3 id="sec-4-8">4.8 SAC vs PRICE pós-fixado — comportamentos distintos <a className="anchor" href="#sec-4-8" aria-label="Link para esta seção">¶</a></h3>
            <p>No edge function:</p>
            <ul>
              <li>
                <strong>SAC pós-fixado:</strong> amortização <strong>fixa</strong> ={" "}
                <code>financiado/N</code> (linha 337); juros recalculados com taxa
                efetiva do período.
              </li>
              <li>
                <strong>PRICE pós-fixado:</strong> PMT <strong>recalculada a cada
                período</strong> (linha 400-413) usando saldo atual e taxa efetiva.
                Não é a PRICE clássica de PMT constante.
              </li>
            </ul>
            <p>
              Isso é uma decisão de modelagem razoável (PRICE pura não existe sob taxa
              variável), mas está implícita. Um CFO pode esperar PMT constante em
              PRICE.
            </p>
          </section>

          <hr />

          <section id="sec-5">
            <h2>5. Riscos Matemáticos <a className="anchor" href="#sec-5" aria-label="Link para esta seção">¶</a></h2>
            <table>
              <thead>
                <tr><th>#</th><th>Risco</th><th>Onde</th></tr>
              </thead>
              <tbody>
                <tr id="R1"><td><a className="rowref" href="#R1">R1</a></td><td><strong>Sem rollback transacional</strong> entre <code>delete debt_installments</code> e <code>insert</code>. Se o insert falha, o contrato fica sem parcelas e o front re-aciona o edge function — provável recuperação, mas há uma janela onde os KPIs ficam zerados.</td><td><code>…/calculate-amortization/index.ts:131-178</code></td></tr>
                <tr id="R2"><td><a className="rowref" href="#R2">R2</a></td><td><strong>Update de dívida deleta parcelas no front</strong> (<code>useDebts.tsx:140-148</code>) <strong>antes</strong> do edge function ser chamado para recalcular (ocorre depois em <code>Index.handleSaveDebt</code>). Se o passo do edge function falha, o contrato perde parcelas no banco.</td><td><code>useDebts.tsx:137-173</code> + <code>Index.tsx:160-187</code></td></tr>
                <tr id="R3"><td><a className="rowref" href="#R3">R3</a></td><td><strong>Diff de meses por 30.44 dias</strong> (<code>OutstandingBalanceChart</code>, <code>DebtProfileChart</code>, obsolete <code>NetDebtCard</code>) cria desalinhamento de até 1 mês conforme o ano. <code>dashboardMetrics</code> usa <code>diffInMonths</code> por calendário — mais correto.</td><td><code>OutstandingBalanceChart.tsx:82-88</code>, <code>DebtProfileChart.tsx:183-189</code></td></tr>
                <tr id="R4"><td><a className="rowref" href="#R4">R4</a></td><td><strong>Edge function: spread tratado como anual quando <code>interestType === 'annual'</code></strong> (<code>staticRate = spreadRate + interestRate</code> antes da conversão na linha 322). Se o cadastro guarda spread sempre como mensal, contratos com taxa anual vão produzir taxa efetiva incorreta. Não há validação no schema.</td><td><code>…/calculate-amortization/index.ts:300, 321-324</code></td></tr>
                <tr id="R5"><td><a className="rowref" href="#R5">R5</a></td><td><strong>Newton-Raphson não-convergente é silencioso</strong>. O CET retornado quando <code>converged=false</code> ainda é gravado (<code>…/index.ts:194-200</code> não checa <code>converged</code>). O front exibe normalmente.</td><td><code>…/index.ts:191-208</code>, <code>cetCalculator.ts:40-44</code></td></tr>
                <tr id="R6"><td><a className="rowref" href="#R6">R6</a></td><td><strong><code>calculateCET</code> no front recalcula CET a cada render do dashboard</strong> (via <code>calculateBatchCET</code>), ignorando o <code>cet_monthly_rate</code> já persistido. Custo de CPU para carteiras grandes. Resultado pode divergir do persistido (§4.5).</td><td><code>dashboardMetrics.ts:328-345</code></td></tr>
                <tr id="R7"><td><a className="rowref" href="#R7">R7</a></td><td><strong>Datas via <code>new Date('YYYY-MM-DD')</code></strong> no edge function (linha 307-308) parsem como UTC, depois <code>toISOString().split('T')[0]</code> retorna a data UTC. Em servidores com timezone local diferente, parcelas podem deslocar 1 dia em meses-borda.</td><td><code>…/calculate-amortization/index.ts:307-352</code></td></tr>
                <tr id="R8"><td><a className="rowref" href="#R8">R8</a></td><td><strong><code>DebtProfileChart</code> tem reconciliação de "missing"</strong> (linha 420-430): se a soma de <code>principal_amount</code> for menor que o saldo atual, joga a diferença num bucket. Em casos de parcelas parciais ou inconsistentes, pode dobrar amortização.</td><td><code>DebtProfileChart.tsx:420-430</code></td></tr>
                <tr id="R9"><td><a className="rowref" href="#R9">R9</a></td><td><strong><code>OutstandingBalanceChart.kpis.deltaSaldo/deltaPmt</code></strong> comparam "hoje" vs "hoje − 1 mês" via fórmula analítica. O comentário admite ser placeholder (<code>linha 286-289</code>). O CFO pode interpretar o delta como variação real, mas é projeção contra projeção.</td><td><code>OutstandingBalanceChart.tsx:286-322</code></td></tr>
                <tr id="R10"><td><a className="rowref" href="#R10">R10</a></td><td><strong>Toda agregação assume que <code>debt_installments</code> está completa e atualizada</strong>. Se o usuário editar uma dívida e o edge function falhar, a UI renderiza com dados estale por uma sessão inteira sem aviso.</td><td>Vários</td></tr>
              </tbody>
            </table>
            <p>
              Não foram encontrados problemas de <strong>precisão decimal</strong>{" "}
              (uso consistente de <code>toFixed(2)</code> na persistência e{" "}
              <code>Number()</code> em conversões). Sem <code>Decimal.js</code> ou
              similar, mas para a escala de valores típicos (até centenas de milhões
              em BRL) o <code>Number</code> JavaScript é suficiente.
            </p>
          </section>

          <hr />

          <section id="sec-6">
            <h2>6. Auditoria de UI <a className="anchor" href="#sec-6" aria-label="Link para esta seção">¶</a></h2>
            <h3>Cards onde um CFO pode ler errado</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Card</th><th>O que pode confundir</th></tr>
                </thead>
                <tbody>
                  <tr><td><strong>Saldo Devedor Atual</strong> (DashboardStats) e <strong>Saldo total atual</strong> (OutstandingBalanceChart KPI)</td><td>Mesma label, fórmulas diferentes (§4.1). Se o CFO comparar lado a lado, vai ver dois números com a mesma legenda divergindo em alguns por cento.</td></tr>
                  <tr><td><strong>CET Média</strong></td><td>Tooltip diz "ponderado pelo saldo devedor". Correto para a tela atual, mas se um relatório futuro usar <code>calculateWeightedAverageCET</code> (financedAmount), produzirá outro número com a mesma label.</td></tr>
                  <tr><td><strong>Spread Médio sobre CDI</strong></td><td>Tooltip: "Diferença entre o CET dos contratos e a taxa CDI atual". A conta é apenas <code>CET_anual − CDI_anual</code>. Para contratos pré-fixados, IPCA, ou TR, a diferença não é "spread" — é só uma subtração sem significado financeiro.</td></tr>
                  <tr><td><strong>PMT 30/90 dias e Pico mensal</strong></td><td>Soma <code>total_amount</code> das parcelas reais. Para pós-fixado com índice projetado, o "PMT 90 dias" depende da projeção atual de CDI/IPCA — o número muda silenciosamente quando as projeções são atualizadas. Não há indicação de que é uma estimativa.</td></tr>
                  <tr><td><strong>Pontos de atenção (alertas CFO)</strong></td><td>Inclui <code>divida_liquida</code>, mas a Dívida Líquida = Dívida Bruta (§4.6). Os filtros em <code>cfoAlerts.ts:218</code> excluem essa categoria do card de alertas (<code>linha 219</code>), mas o objeto de input ainda é montado como se a métrica existisse — risco de re-aparecer se alguém mexer no filtro.</td></tr>
                  <tr><td><strong>Caixa liberado</strong> (toggle no OutstandingBalanceChart)</td><td>Mostra <code>max(0, PMT_hoje − PMT_mes)</code>. Se um contrato novo for adicionado, PMT futura aumenta e o "caixa liberado" para esse mês cai a zero — pode dar impressão de que a empresa "perdeu caixa" quando na verdade só assumiu novo contrato.</td></tr>
                  <tr><td><strong>Composição por prazo</strong> (DebtProfileChart)</td><td>Curto = ≤12m, longo = &gt;12m. Definição padrão de mercado, mas o card não menciona o ponto de corte. Um CFO acostumado a 24m como "curto" pode interpretar errado.</td></tr>
                  <tr><td><strong>Maior credor</strong></td><td>Threshold de cor (&gt;55% destrutivo, &gt;35% âmbar) é arbitrário. Não há ajuste por porte da empresa nem por política interna.</td></tr>
                  <tr><td><strong>Prazo Médio Restante</strong></td><td>Calculado em meses, ponderado por saldo. Para uma carteira mista (capital de giro 6m + financiamento 10 anos), a média pode esconder a concentração.</td></tr>
                </tbody>
              </table>
            </div>

            <h3>Inconsistências visuais cruzadas</h3>
            <ul>
              <li>
                O <strong>header de OutstandingBalanceChart</strong> mostra "Saldo
                total atual" e "PMT este mês" como se fossem os mesmos números do
                header de KPIs do DashboardStats — mas usam fórmulas independentes
                (§4.1, §4.2). Após qualquer edição de contrato pós-fixado, os dois
                devem divergir.
              </li>
              <li>
                O delta "vs mês anterior" no <code>OutstandingBalanceChart.KpiBlock</code>
                {" "}colore positivo em verde e negativo em vermelho. Para "Saldo total"
                subir é ruim; para "PMT este mês" cair é bom. A coloração trata os
                dois com a mesma lógica → para PMT, "verde = aumentou" pode passar
                mensagem errada.
              </li>
            </ul>
          </section>

          <hr />

          <section id="sec-7">
            <h2>7. Lacunas <span className="muted">(requerem validação com o time)</span> <a className="anchor" href="#sec-7" aria-label="Link para esta seção">¶</a></h2>
            <table>
              <thead>
                <tr><th>#</th><th>Lacuna</th></tr>
              </thead>
              <tbody>
                <tr id="L1"><td><a className="rowref" href="#L1">L1</a></td><td><strong>Spread mensal vs anual no cadastro</strong> — O schema permite <code>spread_rate</code> numérico mas não documenta a base. O edge function (R4) trata como se fosse na mesma base de <code>interestRate</code>. Confirmar com o time qual é o contrato de cadastro.</td></tr>
                <tr id="L2"><td><a className="rowref" href="#L2">L2</a></td><td><strong>Definição contábil de saldo</strong> — Saldo "no início" vs "no fim" do período (§4.7). Qual é a verdade que o CFO espera ver?</td></tr>
                <tr id="L3"><td><a className="rowref" href="#L3">L3</a></td><td><strong>Política de PRICE pós-fixado</strong> — A escolha de re-PRICE (PMT recalculada a cada período) vs price-fixed (PMT constante até o fim) é uma convenção. Nada no código documenta a decisão (§4.8).</td></tr>
                <tr id="L4"><td><a className="rowref" href="#L4">L4</a></td><td><strong>Caixa e equivalentes</strong> — Existe intenção de adicionar input de caixa para Dívida Líquida real? O componente obsoleto sugere que sim, mas não há roadmap visível no código.</td></tr>
                <tr id="L5"><td><a className="rowref" href="#L5">L5</a></td><td><strong>Quando um contrato termina parcialmente no mês</strong> — <code>analyticalCurrentPMT</code> retorna 0 se hoje &gt; dueDate, mas o último mês da vida do contrato pode ter PMT proporcional. Comportamento atual: zero. Esperado pelo CFO: a parcela final ainda conta.</td></tr>
                <tr id="L6"><td><a className="rowref" href="#L6">L6</a></td><td><strong>CDI atual vs CDI médio do período</strong> — O "Spread Médio" usa <code>latestRates.CDI.value</code>, ou seja, a última taxa diária conhecida. Mas o CET dos contratos é uma TIR sobre fluxos com taxas projetadas variando ao longo do tempo. Comparar TIR composta com taxa pontual não é apples-to-apples.</td></tr>
                <tr id="L7"><td><a className="rowref" href="#L7">L7</a></td><td><strong>Granularidade de tempo no IRR</strong> — Usa <code>years = days / 365.25</code>. Para parcelas de 30/30/30/30 dias o efeito é desprezível; para parcelas com gaps incomuns (entrada + 90 dias) pode haver sensibilidade. Não testado.</td></tr>
                <tr id="L8"><td><a className="rowref" href="#L8">L8</a></td><td><strong>Reprogrammingrules</strong> — Edge function aceita <code>reprogrammingRules</code> mas o código atual não as consome em lugar visível. Funcionalidade morta ou não implementada.</td></tr>
                <tr id="L9"><td><a className="rowref" href="#L9">L9</a></td><td><strong>Persistência de <code>cet_*_rate</code> versus recálculo</strong> — O front sempre recalcula CET (R6). Por que persistir? Convém alinhar: ou o persistido é a fonte de verdade ou é cache descartável.</td></tr>
                <tr id="L10"><td><a className="rowref" href="#L10">L10</a></td><td><strong>Filtros globais vs filtros de widget</strong> — <code>Index.tsx:351-381</code> aplica filtros locais e globais de forma cumulativa (AND). Se o CFO marca "todos" no filtro local mas tem filtro global, o resultado pode parecer não responsivo. Pequena UX, mas vale validar.</td></tr>
              </tbody>
            </table>
          </section>

          <hr />

          <section id="sec-8">
            <h2>8. Plano de Ação <a className="anchor" href="#sec-8" aria-label="Link para esta seção">¶</a></h2>
            <p className="callout">
              Ordenado por <strong>impacto no risco de decisão errada</strong>, não
              por esforço.
            </p>

            <h3>Prioridade 1 — Alinhar verdade única para Saldo e PMT</h3>
            <table>
              <thead><tr><th>#</th><th>Ação</th><th>Arquivo alvo</th></tr></thead>
              <tbody>
                <tr id="P1-1"><td><a className="rowref" href="#P1-1">P1.1</a></td><td>Centralizar saldo analítico em <strong>uma</strong> função em <code>dashboardMetrics.ts</code> (ou novo <code>src/lib/balanceCalculator.ts</code>) e fazer <code>OutstandingBalanceChart</code> e <code>DebtProfileChart</code> consumirem dela. Eliminar as duas reimplementações com fórmulas divergentes.</td><td><code>OutstandingBalanceChart.tsx:76-150</code>, <code>DebtProfileChart.tsx:175-217</code></td></tr>
                <tr id="P1-2"><td><a className="rowref" href="#P1-2">P1.2</a></td><td>Decidir e documentar: <strong>spread entra no fallback analítico ou não?</strong> Aplicar igualmente nas três trilhas.</td><td><code>dashboardMetrics.ts:59-66</code> + as fórmulas centralizadas em P1.1</td></tr>
                <tr id="P1-3"><td><a className="rowref" href="#P1-3">P1.3</a></td><td>Definir semântica de <code>remaining_balance</code> (abertura vs fechamento) e renomear o campo se necessário, ou ajustar uma das trilhas para reconciliar com a outra.</td><td><code>…/calculate-amortization/index.ts:430-440, 463</code>, <code>debtUtils.ts:155-169</code>, <code>dashboardMetrics.ts:98-103</code></td></tr>
              </tbody>
            </table>

            <h3>Prioridade 2 — Confiabilidade do CET</h3>
            <table>
              <thead><tr><th>#</th><th>Ação</th><th>Arquivo alvo</th></tr></thead>
              <tbody>
                <tr id="P2-1"><td><a className="rowref" href="#P2-1">P2.1</a></td><td>Decidir entre <strong>persistir CET</strong> (gravado pela edge function) <strong>ou recalcular sempre</strong>. Se persistir, remover a chamada <code>calculateBatchCET</code> em <code>dashboardMetrics</code>. Se recalcular, remover as colunas <code>cet_*_rate</code>.</td><td><code>dashboardMetrics.ts:328-360</code> + edge function</td></tr>
                <tr id="P2-2"><td><a className="rowref" href="#P2-2">P2.2</a></td><td>Não gravar CET quando <code>converged === false</code>; em vez disso, sinalizar <code>cet_status</code> para a UI exibir "—" e tooltip explicativo.</td><td><code>…/calculate-amortization/index.ts:191-208</code></td></tr>
                <tr id="P2-3"><td><a className="rowref" href="#P2-3">P2.3</a></td><td>Unificar IRR: extrair para um arquivo compartilhado (ou portar a derivada analítica para o TS) para garantir convergência idêntica entre front e edge.</td><td><code>irrCalculator.ts</code>, edge function</td></tr>
                <tr id="P2-4"><td><a className="rowref" href="#P2-4">P2.4</a></td><td>Padronizar peso da CET média (saldo OU financedAmount, escolher um) e remover a função vencida.</td><td><code>cetCalculator.ts:86-112</code> vs <code>dashboardMetrics.ts:347-360</code></td></tr>
              </tbody>
            </table>

            <h3>Prioridade 3 — Rotular o que não é "real"</h3>
            <table>
              <thead><tr><th>#</th><th>Ação</th><th>Arquivo alvo</th></tr></thead>
              <tbody>
                <tr id="P3-1"><td><a className="rowref" href="#P3-1">P3.1</a></td><td>Remover ou renomear o card de Dívida Líquida enquanto não houver input de caixa; no payload de alertas, parar de enviar <code>netDebt</code> com cash=0.</td><td><code>DashboardStats.tsx:213-217</code>, <code>cfoAlerts.ts</code></td></tr>
                <tr id="P3-2"><td><a className="rowref" href="#P3-2">P3.2</a></td><td>Adicionar badge/tooltip "estimativa" nos KPIs cuja base muda silenciosamente (PMT 30/90/180, pico 12m) quando há contratos pós-fixados na carteira.</td><td><code>DashboardStats.tsx:464-537</code></td></tr>
                <tr id="P3-3"><td><a className="rowref" href="#P3-3">P3.3</a></td><td>No <code>OutstandingBalanceChart.KpiBlock</code>, ajustar a coloração do delta para refletir polaridade por métrica (PMT cair = bom; saldo cair = bom; inverter conforme o caso).</td><td><code>OutstandingBalanceChart.tsx:644-672</code></td></tr>
                <tr id="P3-4"><td><a className="rowref" href="#P3-4">P3.4</a></td><td>Renomear "Spread Médio" para algo que não pressuponha CDI (ex.: "CET vs CDI"), ou exibir N/A se nenhum contrato é CDI.</td><td><code>DashboardStats.tsx:292-307</code>, <code>dashboardMetrics.ts:361</code></td></tr>
              </tbody>
            </table>

            <h3>Prioridade 4 — Robustez do pipeline de parcelas</h3>
            <table>
              <thead><tr><th>#</th><th>Ação</th><th>Arquivo alvo</th></tr></thead>
              <tbody>
                <tr id="P4-1"><td><a className="rowref" href="#P4-1">P4.1</a></td><td>Não deletar <code>debt_installments</code> no front (<code>useDebts.tsx:140</code>) antes do edge function ser chamado. Deixar o edge function ser a única responsável pelo ciclo delete + insert (idempotente, já implementado).</td><td><code>useDebts.tsx:137-173</code></td></tr>
                <tr id="P4-2"><td><a className="rowref" href="#P4-2">P4.2</a></td><td>Tornar o ciclo de delete + insert na edge function transacional (Postgres function ou <code>rpc</code>), evitando estado intermediário visível ao front.</td><td><code>…/calculate-amortization/index.ts:131-178</code></td></tr>
                <tr id="P4-3"><td><a className="rowref" href="#P4-3">P4.3</a></td><td>Se um recálculo on-the-fly via edge function falhar (R10), expor erro no UI em vez de retornar zeros silenciosos.</td><td><code>useDebtInstallments.tsx:106-132, 187-189</code></td></tr>
              </tbody>
            </table>

            <h3>Prioridade 5 — Documentação e validação</h3>
            <table>
              <thead><tr><th>#</th><th>Ação</th><th>Arquivo alvo</th></tr></thead>
              <tbody>
                <tr id="P5-1"><td><a className="rowref" href="#P5-1">P5.1</a></td><td>Validar com o time as 10 lacunas da §7 e materializar as decisões em <code>CLAUDE.md</code> ou em um <code>docs/FINANCIAL_CONVENTIONS.md</code>.</td><td>(novo)</td></tr>
                <tr id="P5-2"><td><a className="rowref" href="#P5-2">P5.2</a></td><td>Adicionar testes (vitest) para casos de borda — pré-fixado simples, pós-fixado com spread, contrato terminando no mês corrente, IRR de contrato com IOF alto. Hoje só há validação manual no browser.</td><td>(novo <code>src/lib/__tests__/</code>)</td></tr>
                <tr id="P5-3"><td><a className="rowref" href="#P5-3">P5.3</a></td><td>Atualizar <code>calculationRules.ts</code> para refletir as decisões da Prioridade 1 (já está bem feito como pseudocódigo, mas vai ficar desatualizado se P1 mudar fórmulas).</td><td><code>src/lib/calculationRules.ts</code></td></tr>
              </tbody>
            </table>
          </section>

          <hr />

          <section id="sec-apendice">
            <h2>Apêndice — Referências cruzadas com pseudocódigo existente <a className="anchor" href="#sec-apendice" aria-label="Link para esta seção">¶</a></h2>
            <p>
              O projeto já documenta as regras de cálculo em popovers
              (<code>CalculationInfoPopover</code> ← <code>src/lib/calculationRules.ts</code>),
              em <strong>pseudocódigo amigável</strong>. Esta auditoria não duplica
              esse conteúdo; recomenda-se manter sincronia entre as decisões da
              Prioridade 1 e os pseudocódigos lá descritos. Discrepâncias atuais entre
              o pseudocódigo e a implementação:
            </p>
            <ul>
              <li>
                <code>calculationRules.CURRENT_OUTSTANDING_BALANCE</code> descreve a
                fórmula <strong>com spread implícito</strong> (usa "taxa mensal"), o
                que casa com <code>dashboardMetrics</code> mas não com os fallbacks de{" "}
                <code>OutstandingBalanceChart</code>/<code>DebtProfileChart</code>.
              </li>
              <li>
                <code>calculationRules.AVERAGE_MONTHLY_CET</code> documenta
                corretamente o fallback "taxa cadastrada se TIR não convergir" (§4.4),
                mas não distingue que essa taxa <strong>não inclui IOF/TAC</strong> —
                informação relevante para o leitor.
              </li>
              <li>
                <code>calculationRules.OUTSTANDING_BALANCE</code> (gráfico por banco)
                afirma "KPIs do header usam fórmula analítica idêntica ao Saldo
                Devedor Atual" — não é literalmente verdade hoje (§4.1).
              </li>
            </ul>
          </section>

          <footer className="docs-footer">
            <p>
              <em>Fim do documento.</em> · Gerado em 2026-05-05 ·{" "}
              <a href="/">voltar para o app</a>
            </p>
          </footer>
        </main>
      </div>
    </>
  );
};

const docsStyles = `
.docs-page {
  --bg: #fbfaf6;
  --bg-soft: #f3f0e8;
  --ink: #2a2620;
  --ink-soft: #5a554c;
  --rule: #d8d2c4;
  --rule-soft: #ebe6da;
  --accent: #7a3b2e;
  --accent-soft: #c45a44;
  --code-bg: #efeadd;
  --warn: #b06b1f;
  --serif: Charter, "Iowan Old Style", "Sitka Text", Cambria, Georgia, serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;

  position: fixed;
  inset: 0;
  overflow: auto;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--serif);
  font-size: 17px;
  line-height: 1.62;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-feature-settings: "kern" 1, "liga" 1, "onum" 1;
  display: grid;
  grid-template-columns: minmax(240px, 280px) 1fr;
  gap: 0;
}

.docs-page * { box-sizing: border-box; }

/* ─────────── Sidebar ─────────── */
.docs-toc {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  border-right: 1px solid var(--rule);
  background: var(--bg-soft);
  padding: 32px 24px;
  overflow-y: auto;
}
.toc-inner { font-size: 14px; }
.toc-eyebrow {
  margin: 0 0 12px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-soft);
  font-family: var(--mono);
}
.toc-title {
  margin: 0 0 4px;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.01em;
}
.toc-meta {
  margin: 0 0 24px;
  font-size: 12px;
  color: var(--ink-soft);
  font-style: italic;
}
.toc-meta code { font-style: normal; font-size: 11px; }
.docs-toc nav ol {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--rule);
}
.docs-toc nav li { border-bottom: 1px solid var(--rule); }
.docs-toc nav a {
  display: block;
  padding: 9px 0;
  color: var(--ink);
  text-decoration: none;
  font-size: 13.5px;
  transition: color 0.15s ease, padding 0.15s ease;
}
.docs-toc nav a:hover {
  color: var(--accent);
  padding-left: 6px;
}
.toc-foot {
  margin-top: 24px;
  font-size: 12px;
}
.toc-foot a { color: var(--accent); text-decoration: none; }
.toc-foot a:hover { text-decoration: underline; }

/* ─────────── Body ─────────── */
.docs-body {
  padding: 56px 64px 96px;
  max-width: 820px;
  margin: 0 auto;
  width: 100%;
}

.docs-header { margin-bottom: 48px; }
.kicker {
  margin: 0 0 8px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}
.docs-header h1 {
  margin: 0 0 16px;
  font-size: 38px;
  line-height: 1.12;
  letter-spacing: -0.02em;
  font-weight: 700;
}
.lede {
  font-size: 18px;
  line-height: 1.55;
  color: var(--ink-soft);
  margin: 0 0 24px;
}
.docs-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin: 24px 0 0;
  padding: 14px 0;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  font-size: 13px;
}
.docs-meta div { display: flex; gap: 8px; align-items: baseline; }
.docs-meta dt {
  margin: 0;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.docs-meta dd { margin: 0; color: var(--ink); }

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-family: var(--mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.badge-warn {
  background: rgba(176, 107, 31, 0.12);
  color: var(--warn);
  border: 1px solid rgba(176, 107, 31, 0.3);
}

/* Headings */
.docs-body h2 {
  margin: 56px 0 16px;
  font-size: 26px;
  line-height: 1.2;
  letter-spacing: -0.015em;
  font-weight: 700;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--rule);
  scroll-margin-top: 24px;
}
.docs-body h3 {
  margin: 36px 0 12px;
  font-size: 18px;
  line-height: 1.3;
  font-weight: 700;
  color: var(--ink);
}
.muted { color: var(--ink-soft); font-weight: 400; font-size: 0.85em; }

/* Text blocks */
.docs-body p { margin: 0 0 16px; }
.docs-body strong { color: var(--ink); font-weight: 700; }
.docs-body em { font-style: italic; }

/* Lists */
.docs-body ul, .docs-body ol { margin: 0 0 20px; padding-left: 28px; }
.docs-body li { margin-bottom: 8px; }
.docs-body li::marker { color: var(--ink-soft); }

/* Inline code */
.docs-body code {
  font-family: var(--mono);
  font-size: 0.86em;
  background: var(--code-bg);
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--ink);
  border: 1px solid rgba(0, 0, 0, 0.04);
  word-break: break-word;
}

/* Code block */
.docs-body pre {
  margin: 0 0 24px;
  padding: 18px 20px;
  background: #2a2620;
  color: #e8e2d2;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid #1f1c17;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.docs-body pre code {
  background: transparent;
  border: 0;
  padding: 0;
  color: inherit;
  font-size: inherit;
}

/* Tables */
.table-wrap { overflow-x: auto; margin-bottom: 24px; }
.docs-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 1.45;
}
.docs-body table th,
.docs-body table td {
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--rule);
}
.docs-body table th {
  font-weight: 700;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-soft);
  border-bottom: 2px solid var(--ink-soft);
  background: var(--bg-soft);
}
.docs-body table tbody tr:hover { background: rgba(0, 0, 0, 0.015); }
.docs-body table td:first-child { font-weight: 500; }
.docs-body table td code,
.docs-body table th code { font-size: 0.82em; }

/* Callout */
.callout {
  border-left: 3px solid var(--accent);
  background: var(--bg-soft);
  padding: 14px 18px;
  margin: 0 0 24px;
  font-size: 15px;
  border-radius: 0 4px 4px 0;
}

/* Rules */
.docs-body hr {
  border: 0;
  height: 1px;
  background: var(--rule);
  margin: 48px 0;
}

/* Footer */
.docs-footer {
  margin-top: 64px;
  padding-top: 24px;
  border-top: 1px solid var(--rule);
  text-align: center;
  color: var(--ink-soft);
  font-size: 13px;
}
.docs-footer a { color: var(--accent); text-decoration: none; }
.docs-footer a:hover { text-decoration: underline; }

/* Links em geral */
.docs-body a { color: var(--accent); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
.docs-body a:hover { color: var(--accent-soft); }

/* Responsivo */
@media (max-width: 900px) {
  .docs-page {
    grid-template-columns: 1fr;
  }
  .docs-toc {
    position: static;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--rule);
  }
  .docs-body { padding: 32px 24px 64px; }
  .docs-header h1 { font-size: 30px; }
}

@media print {
  .docs-toc { display: none; }
  .docs-page { display: block; background: white; }
  .docs-body { max-width: none; padding: 0; }
  .docs-body pre { background: #f5f5f5; color: #000; }
  .docs-body a { color: inherit; text-decoration: none; }
}
`;

export default Docs;
