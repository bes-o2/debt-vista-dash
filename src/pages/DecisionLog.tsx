import { useEffect } from "react";

const decisions: Array<{
  id: string;
  title: string;
  v2: React.ReactNode;
  current: React.ReactNode;
  tradeoff: React.ReactNode;
  decision: React.ReactNode;
  decisionTag: "Adotar V2" | "Manter atual" | "Adaptar" | "Adotar V2 + Adaptar" | "Manter + Adaptar";
  acceptance: React.ReactNode;
}> = [
  {
    id: "D1",
    title: "Saldo devedor — semântica de abertura/fechamento",
    v2: <>O <code>principal_balance</code> é <strong>saldo de abertura</strong> (antes do pagamento). KPI "saldo atual" usa abertura da próxima parcela futura. Séries mensais usam <strong>saldo de fechamento do mês</strong>.</>,
    current: <>Edge Function persiste abertura. <code>dashboardMetrics</code> consome corretamente. <code>debtUtils</code> e <code>OutstandingBalanceChart</code> consomem saldo pré-pagamento na própria data — divergência de até 1 amortização.</>,
    tradeoff: <>Padronizar fechamento em séries é O(N) (irrelevante). Custo: refatorar 2 trilhas de UI.</>,
    decisionTag: "Adotar V2 + Adaptar",
    decision: <>Manter <code>principal_balance</code> como abertura no banco. Criar <code>src/lib/balanceCalculator.ts</code> com <code>getOutstandingAt(debt, date, mode)</code>. KPI = abertura da próxima parcela; séries = fechamento do mês.</>,
    acceptance: <>Em uma data exatamente igual a um vencimento, KPI e ponto da série não diferem por uma amortização inteira.</>,
  },
  {
    id: "D2",
    title: "Spread em fallback analítico",
    v2: <><code>taxaEfetivaPeriodo = taxaIndexador + spread</code>. Spread é <strong>anual</strong>, conversão explícita: <code>(1 + spreadAnual/100)^(1/12) − 1</code>. Fallback usa as mesmas funções do cronograma.</>,
    current: <><code>dashboardMetrics</code> soma spread (correto). <code>OutstandingBalanceChart</code> e <code>DebtProfileChart</code> ignoram spread. Risco R4: schema não documenta a base do spread.</>,
    tradeoff: <>Centralizar é barato (1 helper). Custo real: padronizar base de spread no cadastro.</>,
    decisionTag: "Adotar V2",
    decision: <>Padronizar <code>spread_rate</code> como <strong>anual</strong>. Centralizar conversão em <code>src/lib/rateUtils.ts</code>. Eliminar fallbacks que ignoram spread.</>,
    acceptance: <>Em contrato pós-fixado com spread, KPI do header e KPI do <code>OutstandingBalanceChart</code> retornam valores idênticos ao centavo.</>,
  },
  {
    id: "D3",
    title: "PRICE pós-fixado — re-PRICE por período",
    v2: <>PRICE pós-fixado <strong>não é PMT constante</strong>. A cada período, recalcula PMT com saldo, taxa efetiva e prazo remanescente.</>,
    current: <>Edge Function já implementa re-PRICE corretamente. Comportamento <em>implícito</em> — sem tooltip ao CFO.</>,
    tradeoff: <>Manter é correto financeiramente. Custo é apenas comunicacional.</>,
    decisionTag: "Manter + Adaptar",
    decision: <>Documentar em <code>CLAUDE.md</code> e <code>calculationRules.ts</code>. Badge "PMT recalculada por período" em PRICE pós-fixado. Tooltip no KPI "PMT Corrente".</>,
    acceptance: <>Tooltip do PMT em contrato PRICE+CDI mostra: indexador, projeção em uso, data-base e a regra de recálculo.</>,
  },
  {
    id: "D4",
    title: "Ponderação do CET médio",
    v2: <>Não fixa peso, mas exige fonte única e cálculo persistido pela Edge Function.</>,
    current: <>Duas funções coexistem: <code>calculateWeightedAverageCET</code> pondera por <code>financedAmount</code>; <code>dashboardMetrics</code> pondera por saldo devedor.</>,
    tradeoff: <>Saldo devedor reflete custo presente da carteira (visão CFO). FinancedAmount reflete custo histórico (tesouraria). Para o dashboard, saldo é mais útil.</>,
    decisionTag: "Adaptar",
    decision: <>Adotar ponderação por <strong>saldo devedor</strong> como padrão único. Deprecar <code>calculateWeightedAverageCET</code> ou parametrizar com <code>'outstanding' | 'financed'</code>.</>,
    acceptance: <>Apenas uma função de média ponderada existe; busca por <code>WeightedAverageCET</code> retorna no máximo um símbolo público.</>,
  },
  {
    id: "D5",
    title: "CET — persistir vs recalcular",
    v2: <>Edge Function calcula e persiste. Front exibe e só recalcula sob ação explícita (ex: cenário).</>,
    current: <>Edge persiste, mas front recalcula a cada render via <code>calculateBatchCET</code> (R6). Resultado pode divergir do persistido (§4.5).</>,
    tradeoff: <>Persistir + exibir é mais barato e auditável. Recalcular é necessário só em cenários temporários.</>,
    decisionTag: "Adotar V2",
    decision: <><code>dashboardMetrics</code> lê <code>debts.cet_monthly_rate</code> direto. <code>calculateBatchCET</code> mantido só para cenários e contratos sem parcelas. Não gravar CET quando <code>converged === false</code>.</>,
    acceptance: <>Em condições normais, CET exibido = <code>debts.cet_monthly_rate</code>. <code>git grep calculateBatchCET</code> mostra uso restrito a cenários.</>,
  },
  {
    id: "D6",
    title: "IRR — paridade entre TS e Deno",
    v2: <>"A função de IRR deve ser única ou produzir resultado idêntico no front e na Edge."</>,
    current: <>Duas implementações divergem em casos de borda (taxa baixa, IOF alto). TS usa derivada numérica; Deno usa analítica.</>,
    tradeoff: <>Pacote compartilhado tem overhead (Vite × Deno). Duplicar a versão analítica em TS é mais barato e robusto.</>,
    decisionTag: "Adaptar",
    decision: <>Portar derivada analítica e <code>maxChange</code> da Edge para <code>irrCalculator.ts</code>. Manter arquivos separados <strong>com testes de paridade</strong> (deltas &lt; 1e-9).</>,
    acceptance: <>Suite Vitest cobre 6+ cenários (pré/pós, SAC/PRICE, IOF alto, taxa ≈ 0, prazo curto, IRR negativa) — ambas as implementações concordam.</>,
  },
  {
    id: "D7",
    title: "Saldo analítico — três fórmulas → uma",
    v2: <>"Fallbacks devem usar exatamente as mesmas funções do cronograma" e ser rotulados como estimativa.</>,
    current: <>Três fórmulas com diferenças (<code>30.44</code> vs calendário; com/sem spread). KPIs com mesma label divergem.</>,
    tradeoff: <>Centralizar é baixo risco. Custo: refatorar 2 componentes; ganho: eliminar inconsistência visível.</>,
    decisionTag: "Adotar V2",
    decision: <>Criar <code>src/lib/balanceCalculator.ts</code> com <code>getAnalyticalOutstanding</code> e <code>getAnalyticalCurrentPMT</code> (com spread, calendário). Substituir as 3 implementações.</>,
    acceptance: <><code>git grep "30.44"</code> retorna zero. KPIs com mesma label batem ao centavo entre <code>DashboardStats</code> e <code>OutstandingBalanceChart</code>.</>,
  },
  {
    id: "D8",
    title: "Auditoria de taxa por parcela (debt_installment_rate_refs)",
    v2: <>Toda parcela pós-fixada tem linha em <code>debt_installment_rate_refs</code> com <code>index_type</code>, <code>period_start/end</code>, <code>rate</code>, <code>source</code>, <code>scenario_label</code>, <code>source_reference_date</code>.</>,
    current: <>Tabela existe e é populada pela Edge. UI ainda não consome para tooltips.</>,
    tradeoff: <>Custo de payload desprezível. Ganho de auditabilidade alto.</>,
    decisionTag: "Manter + Adaptar",
    decision: <>Tooltip por parcela na <code>AmortizationTable</code> mostrando origem da taxa. KPIs agregados ganham badge se janela contém <code>projecao_base</code> ou <code>cenario_temporario</code>.</>,
    acceptance: <>Hover em parcela pós-fixada exibe: indexador, taxa, fonte, data-base. Cards agregados sinalizam projeção quando aplicável.</>,
  },
  {
    id: "D9",
    title: "Período misto realizado/futuro",
    v2: <>Período que cruza "hoje" usa <strong>projeção base inteira</strong> na V1.</>,
    current: <>Edge Function alinhada.</>,
    tradeoff: <>Split realizado+projetado é mais preciso, mas exige campo de breakdown. Adiar é correto para V1.</>,
    decisionTag: "Manter atual",
    decision: <>Documentar em <code>calculationRules.ts</code>. Reavaliar em V2 do produto.</>,
    acceptance: <>Documentação cita a regra; CFO sabe que mês corrente não é "meio realizado, meio projetado".</>,
  },
  {
    id: "D10",
    title: "Projeção base por empresa (company_index_projections)",
    v2: <>Único valor por (empresa, indexador): último real do BCB. Sem curva forward na V1.</>,
    current: <>Estrutura existe. <code>useEffect</code> de inicialização foi desativado por causar loop 401.</>,
    tradeoff: <>Atualização automática é frágil (RLS+auth). On-demand é seguro.</>,
    decisionTag: "Adotar V2 + Adaptar",
    decision: <>Manter regra simples. Botão "Atualizar projeções" na UI (chama <code>fetch-bcb-rates</code> e grava). Não reativar <code>useEffect</code> sem estabilizar refs.</>,
    acceptance: <>CFO atualiza com 1 clique, vê data-base do dado, sem loop de 401.</>,
  },
  {
    id: "D11",
    title: "Cenários temporários",
    v2: <>Override em memória, sem persistência nomeada na V1. Default = apenas futuros; opção "tudo" rotulada como simulação.</>,
    current: <>Funcionalidade parcial (sensitivity dashboard recente).</>,
    tradeoff: <>"Aplicar a tudo" distorce histórico — V2 é a regra correta.</>,
    decisionTag: "Adotar V2",
    decision: <>Default = futuro. Toggle "incluir histórico" rotulado "simulação contrafactual". Auditoria com <code>source='cenario_temporario'</code>.</>,
    acceptance: <>UI deixa claro escopo do override. Histórico realizado nunca muda silenciosamente.</>,
  },
  {
    id: "D12",
    title: "IOF/TAC e CET",
    v2: <>IOF/TAC reduzem desembolso líquido inicial; entram só no fluxo do CET. CET = XIRR datado, cashflow inicial positivo, parcelas negativas.</>,
    current: <>Edge alinhada. Mas R5: grava CET mesmo quando Newton-Raphson não converge.</>,
    tradeoff: <>Adicionar <code>cet_status</code> é migração pequena. Ganho: KPI deixa de mentir.</>,
    decisionTag: "Adotar V2",
    decision: <>Adicionar <code>debts.cet_status</code> (<code>ok | nao_convergiu | nao_aplicavel</code>). UI exibe "—" + tooltip quando <code>nao_convergiu</code>. Validação cruzada via testes de D6.</>,
    acceptance: <>Contrato com Newton-Raphson não convergente exibe "—" em vez de número arbitrário.</>,
  },
  {
    id: "D13",
    title: "Dívida Líquida",
    v2: <>V2 não trata diretamente.</>,
    current: <><code>netDebt = grossDebt</code> (caixa = 0). Sistema de alertas opera como se a métrica fosse real.</>,
    tradeoff: <>Implementar caixa real exige nova tabela + UX. Manter como "=bruta" engana o CFO.</>,
    decisionTag: "Adaptar",
    decision: <>Curto prazo: remover Dívida Líquida da UI principal e do payload de <code>cfoAlerts</code>. Médio prazo: <code>companies.cash_position</code> manual ou tabela <code>cash_balances</code>.</>,
    acceptance: <>Nenhum card menciona "Dívida Líquida" até existir input de caixa. Alertas não consomem <code>netDebt</code> zerado.</>,
  },
  {
    id: "D14",
    title: "Datas e timezone na Edge Function",
    v2: <>V2 não detalha; auditabilidade exige datas estáveis.</>,
    current: <>R7: <code>new Date('YYYY-MM-DD')</code> parseado como UTC pode deslocar 1 dia em meses-borda.</>,
    tradeoff: <>UTC é a solução padrão. Custo: revisão pontual; ganho: fim de bug latente.</>,
    decisionTag: "Adaptar",
    decision: <>Padronizar datas em UTC. Documentar em <code>CLAUDE.md</code>. Teste para meses-borda (jan/fev, fev/mar bissexto).</>,
    acceptance: <>Suite cobre <code>due_date</code> em 31/01, 28/02, 29/02. Servidor com TZ não-UTC produz datas idênticas.</>,
  },
  {
    id: "D15",
    title: "Pipeline de delete + insert de parcelas",
    v2: <>Cronograma persistido é a verdade — não pode haver janela de inconsistência.</>,
    current: <>R1+R2: front deleta parcelas antes de chamar Edge. Se Edge falha, contrato fica sem parcelas.</>,
    tradeoff: <>Mover ciclo para RPC ou Edge transacional é correto. Custo médio.</>,
    decisionTag: "Adaptar",
    decision: <>Remover <code>delete</code> do front. Edge é única responsável (idempotente). UI mostra erro explícito se Edge falhar.</>,
    acceptance: <>Falha simulada do recálculo deixa parcelas anteriores intactas; UI exibe erro acionável.</>,
  },
  {
    id: "D16",
    title: "Diferenciação real vs estimativa",
    v2: <>KPIs que dependem de projeção devem informar qual projeção foi usada, desde quando vale, se há cenário, qual parcela é histórica vs projetada.</>,
    current: <>PMT 30/90/180, Pico 12m, Spread Médio mudam silenciosamente quando projeções mudam. Sem badges.</>,
    tradeoff: <>UX moderado, alto valor para o CFO.</>,
    decisionTag: "Adotar V2",
    decision: <>Componente <code>&lt;ProjectionBadge /&gt;</code> reutilizável: dado um conjunto de parcelas, exibe ícone se ≥1 vier de <code>projecao_base</code> ou <code>cenario_temporario</code>.</>,
    acceptance: <>Carteira só pré-fixada não exibe badge. Ao adicionar 1 contrato CDI, badge aparece nos KPIs afetados.</>,
  },
  {
    id: "D17",
    title: "Spread Médio sobre CDI",
    v2: <>Não trata diretamente. Auditoria L6: comparar TIR composta com taxa pontual não é apples-to-apples.</>,
    current: <>Card aplica subtração mesmo para contratos não-CDI.</>,
    tradeoff: <>Renomear + filtrar é UX simples.</>,
    decisionTag: "Adaptar",
    decision: <>Renomear para "CET vs CDI" ou "Prêmio sobre CDI". Calcular só sobre contratos CDI/SELIC. Mostrar "N/A" se ninguém qualifica. Nota de rodapé: comparação simplificada.</>,
    acceptance: <>Carteira 100% pré-fixada/IPCA exibe N/A. Tooltip explica metodologia.</>,
  },
  {
    id: "D18",
    title: "Reprogramming rules (funcionalidade morta)",
    v2: <>Não menciona.</>,
    current: <>L8: Edge aceita <code>reprogrammingRules</code>, mas o input não é consumido.</>,
    tradeoff: <>Decisão de produto.</>,
    decisionTag: "Adaptar",
    decision: <>Default proposto: <strong>remover</strong> do contrato da Edge até existir caso de uso. Alternativa: ADR documentando contrato reservado.</>,
    acceptance: <>Edge tem superfície enxuta; ou (b) ADR documentando contrato reservado.</>,
  },
];

const tagColor = (tag: string) => {
  if (tag.startsWith("Adotar V2")) return "tag tag-adopt";
  if (tag.startsWith("Manter")) return "tag tag-keep";
  return "tag tag-adapt";
};

const DecisionLog = () => {
  useEffect(() => {
    document.title = "Decision Log — V2 × Aplicação Atual";
  }, []);

  return (
    <>
      <style>{decisionStyles}</style>
      <div className="docs-page">
        <aside className="docs-toc" aria-label="Sumário">
          <div className="toc-inner">
            <p className="toc-eyebrow">debt-vista-dash · docs</p>
            <h2 className="toc-title">Decision Log</h2>
            <p className="toc-meta">2026-05-05 · proposta para revisão</p>
            <nav>
              <ol>
                <li><a href="#sec-sumario">Sumário Executivo</a></li>
                <li><a href="#sec-matriz">Matriz de Decisões</a></li>
                <li><a href="#sec-produto">Pendências de Produto</a></li>
                <li><a href="#sec-fases">Sequência de Implementação</a></li>
                <li><a href="#sec-tabela">Resumo</a></li>
              </ol>
            </nav>
            <p className="toc-foot">
              <a href="/docs">← Auditoria</a><br />
              <a href="/">← voltar para o app</a>
            </p>
          </div>
        </aside>

        <main className="docs-body">
          <header className="docs-header">
            <p className="kicker">Matriz de Decisões Técnicas</p>
            <h1>Decision Log — V2 × Aplicação Atual</h1>
            <p className="lede">
              Documento analítico que cruza o modelo financeiro de referência (V2) com
              a auditoria do estado atual do <code>debt-vista-dash</code>, produzindo
              decisões executáveis para convenções financeiras, semântica de saldos,
              PMT, CET e paridade <code>src/lib</code> ↔ Edge Function.
            </p>
            <dl className="docs-meta">
              <div><dt>Data</dt><dd>2026-05-05</dd></div>
              <div><dt>Status</dt><dd><span className="badge badge-warn">Proposta</span></dd></div>
              <div><dt>Escopo</dt><dd>Estritamente analítico — sem código</dd></div>
            </dl>
          </header>

          <hr />

          <section id="sec-sumario">
            <h2>Sumário Executivo <a className="anchor" href="#sec-sumario">¶</a></h2>
            <p>
              A auditoria mostra um núcleo de cálculo correto na Edge Function{" "}
              <code>calculate-amortization</code>, mas <strong>três fontes de verdade
              analíticas paralelas</strong> no front (<code>dashboardMetrics</code>,{" "}
              <code>OutstandingBalanceChart</code>, <code>DebtProfileChart</code>) que
              divergem em três pontos sensíveis ao CFO:
            </p>
            <ol>
              <li><strong>Spread em fallback analítico</strong> (incluído em uma trilha, ignorado em duas).</li>
              <li><strong>Semântica de <code>remaining_balance</code></strong> (saldo de abertura é persistido, mas consumido inconsistentemente).</li>
              <li><strong>Ponderação do CET médio</strong> (saldo devedor vs valor financiado coexistem).</li>
            </ol>
            <p>
              O modelo V2 resolve cada ponto com regras explícitas. A recomendação
              geral é <strong>adotar V2 como verdade</strong>, eliminar fórmulas
              analíticas duplicadas e tratar <code>debt_installments</code> +{" "}
              <code>debt_installment_rate_refs</code> como única fonte de verdade.
              Fallbacks analíticos passam a ser <strong>estritamente temporários</strong>
              {" "}(parcelas ainda não geradas), com rótulo de "estimativa" na UI.
            </p>
            <p className="callout">
              <strong>Princípio guia:</strong> paridade total entre <code>src/lib</code>{" "}
              e Edge Function. Onde houver divergência, a Edge Function é canônica e o
              front a espelha.
            </p>
          </section>

          <hr />

          <section id="sec-matriz">
            <h2>Matriz de Decisões <a className="anchor" href="#sec-matriz">¶</a></h2>
            {decisions.map((d) => (
              <article key={d.id} id={d.id} className="decision-card">
                <header className="decision-head">
                  <span className="decision-id">{d.id}</span>
                  <h3>{d.title}</h3>
                  <span className={tagColor(d.decisionTag)}>{d.decisionTag}</span>
                </header>
                <dl className="decision-body">
                  <div><dt>Regra V2</dt><dd>{d.v2}</dd></div>
                  <div><dt>Estado atual</dt><dd>{d.current}</dd></div>
                  <div><dt>Trade-off</dt><dd>{d.tradeoff}</dd></div>
                  <div><dt>Decisão</dt><dd>{d.decision}</dd></div>
                  <div><dt>Critério de aceite</dt><dd>{d.acceptance}</dd></div>
                </dl>
              </article>
            ))}
          </section>

          <hr />

          <section id="sec-produto">
            <h2>Pendências de Produto <a className="anchor" href="#sec-produto">¶</a></h2>
            <p>Itens que dependem de validação com produto antes de qualquer decisão técnica:</p>
            <table>
              <thead>
                <tr><th>#</th><th>Pergunta</th><th>Bloqueia</th></tr>
              </thead>
              <tbody>
                <tr><td>Q1</td><td>Spread é cadastrado em base <strong>anual</strong>? (V2 recomenda)</td><td>D2, R4</td></tr>
                <tr><td>Q2</td><td>Saldo em séries mensais é <strong>abertura</strong> ou <strong>fechamento</strong>?</td><td>D1, D7</td></tr>
                <tr><td>Q3</td><td>Há roadmap para Dívida Líquida com caixa real? Em que prazo?</td><td>D13</td></tr>
                <tr><td>Q4</td><td><code>reprogrammingRules</code> deve ser implementado ou removido?</td><td>D18</td></tr>
                <tr><td>Q5</td><td>Curto prazo é ≤12m (mercado) ou outro corte?</td><td>UI <code>DebtProfileChart</code></td></tr>
                <tr><td>Q6</td><td>Política de armazenamento histórico de projeções: sobrescrever ou versionar?</td><td>D10</td></tr>
              </tbody>
            </table>
          </section>

          <hr />

          <section id="sec-fases">
            <h2>Sequência de Implementação <a className="anchor" href="#sec-fases">¶</a></h2>
            <p>Ordem otimizada para reduzir risco de decisão errada do CFO antes de refatorações estruturais:</p>
            <ol className="phase-list">
              <li><strong>Fase 1 — Verdade única e rotulagem</strong> (sem mudança matemática para o usuário final na maioria dos casos): D2, D7, D1, D16, D17, D13.</li>
              <li><strong>Fase 2 — Confiabilidade do CET:</strong> D5, D12, D6.</li>
              <li><strong>Fase 3 — Robustez do pipeline:</strong> D15, D14, D10.</li>
              <li><strong>Fase 4 — Auditabilidade fina e housekeeping:</strong> D8, D11, D18, D4.</li>
              <li><strong>Fase 5 — Documentação:</strong> atualizar <code>calculationRules.ts</code>, <code>CLAUDE.md</code>, criar <code>docs/FINANCIAL_CONVENTIONS.md</code>.</li>
            </ol>
            <p>Cada fase deve produzir testes Vitest validando paridade <code>src/lib</code> ↔ Edge Function.</p>
          </section>

          <hr />

          <section id="sec-tabela">
            <h2>Resumo — todas as decisões <a className="anchor" href="#sec-tabela">¶</a></h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>ID</th><th>Tema</th><th>Decisão</th></tr>
                </thead>
                <tbody>
                  {decisions.map((d) => (
                    <tr key={d.id}>
                      <td><a href={`#${d.id}`}>{d.id}</a></td>
                      <td>{d.title}</td>
                      <td><span className={tagColor(d.decisionTag)}>{d.decisionTag}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="docs-footer">
            <p>
              <em>Fim do documento.</em> · 2026-05-05 ·{" "}
              <a href="/docs">Auditoria</a> · <a href="/">voltar para o app</a>
            </p>
          </footer>
        </main>
      </div>
    </>
  );
};

const decisionStyles = `
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
  --green: #2f6b3a;
  --blue: #2a5e8a;
  --amber: #a86a1a;
  --serif: Charter, "Iowan Old Style", "Sitka Text", Cambria, Georgia, serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  position: fixed; inset: 0; overflow: auto;
  background: var(--bg); color: var(--ink);
  font-family: var(--serif); font-size: 17px; line-height: 1.62;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-feature-settings: "kern" 1, "liga" 1, "onum" 1;
  display: grid; grid-template-columns: minmax(240px, 280px) 1fr;
}
.docs-page * { box-sizing: border-box; }

.docs-toc { position: sticky; top: 0; align-self: start; height: 100vh;
  border-right: 1px solid var(--rule); background: var(--bg-soft);
  padding: 32px 24px; overflow-y: auto; }
.toc-inner { font-size: 14px; }
.toc-eyebrow { margin: 0 0 12px; font-size: 11px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--ink-soft); font-family: var(--mono); }
.toc-title { margin: 0 0 4px; font-size: 20px; line-height: 1.2; font-weight: 700;
  color: var(--ink); letter-spacing: -0.01em; }
.toc-meta { margin: 0 0 24px; font-size: 12px; color: var(--ink-soft); font-style: italic; }
.docs-toc nav ol { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule); }
.docs-toc nav li { border-bottom: 1px solid var(--rule); }
.docs-toc nav a { display: block; padding: 9px 0; color: var(--ink);
  text-decoration: none; font-size: 13.5px; transition: color 0.15s ease, padding 0.15s ease; }
.docs-toc nav a:hover { color: var(--accent); padding-left: 6px; }
.toc-foot { margin-top: 24px; font-size: 12px; line-height: 1.8; }
.toc-foot a { color: var(--accent); text-decoration: none; }
.toc-foot a:hover { text-decoration: underline; }

.docs-body { padding: 56px 64px 96px; max-width: 880px; margin: 0 auto; width: 100%; }
.docs-header { margin-bottom: 48px; }
.kicker { margin: 0 0 8px; font-family: var(--mono); font-size: 11px;
  letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); }
.docs-header h1 { margin: 0 0 16px; font-size: 38px; line-height: 1.12;
  letter-spacing: -0.02em; font-weight: 700; }
.lede { font-size: 18px; line-height: 1.55; color: var(--ink-soft); margin: 0 0 24px; }
.docs-meta { display: flex; flex-wrap: wrap; gap: 24px; margin: 24px 0 0;
  padding: 14px 0; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule);
  font-size: 13px; }
.docs-meta div { display: flex; gap: 8px; align-items: baseline; }
.docs-meta dt { margin: 0; font-family: var(--mono); font-size: 10.5px;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); }
.docs-meta dd { margin: 0; color: var(--ink); }

.badge { display: inline-block; padding: 2px 10px; border-radius: 999px;
  font-size: 11px; font-family: var(--mono); letter-spacing: 0.06em; text-transform: uppercase; }
.badge-warn { background: rgba(176, 107, 31, 0.12); color: var(--warn);
  border: 1px solid rgba(176, 107, 31, 0.3); }

.docs-body h2 { margin: 56px 0 16px; font-size: 26px; line-height: 1.2;
  letter-spacing: -0.015em; font-weight: 700; padding-bottom: 8px;
  border-bottom: 1px solid var(--rule); scroll-margin-top: 24px; }
.docs-body h3 { margin: 0; font-size: 18px; line-height: 1.3; font-weight: 700; color: var(--ink); }
.anchor { color: var(--ink-soft); text-decoration: none; margin-left: 8px; opacity: 0.4; font-weight: 400; }
.anchor:hover { opacity: 1; color: var(--accent); }

.docs-body p { margin: 0 0 16px; }
.docs-body strong { color: var(--ink); font-weight: 700; }
.docs-body em { font-style: italic; }

.docs-body ul, .docs-body ol { margin: 0 0 20px; padding-left: 28px; }
.docs-body li { margin-bottom: 8px; }
.docs-body li::marker { color: var(--ink-soft); }

.docs-body code { font-family: var(--mono); font-size: 0.86em;
  background: var(--code-bg); padding: 1px 5px; border-radius: 3px; color: var(--ink);
  border: 1px solid rgba(0, 0, 0, 0.04); word-break: break-word; }

.table-wrap { overflow-x: auto; margin-bottom: 24px; }
.docs-body table { width: 100%; border-collapse: collapse; margin: 0 0 24px;
  font-size: 14px; line-height: 1.45; }
.docs-body table th, .docs-body table td { padding: 10px 12px; text-align: left;
  vertical-align: top; border-bottom: 1px solid var(--rule); }
.docs-body table th { font-weight: 700; font-family: var(--mono); font-size: 11px;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft);
  border-bottom: 2px solid var(--ink-soft); background: var(--bg-soft); }
.docs-body table tbody tr:hover { background: rgba(0, 0, 0, 0.015); }
.docs-body table td a { color: var(--accent); text-decoration: none; font-family: var(--mono); font-weight: 700; }
.docs-body table td a:hover { text-decoration: underline; }

.callout { border-left: 3px solid var(--accent); background: var(--bg-soft);
  padding: 14px 18px; margin: 0 0 24px; font-size: 15px; border-radius: 0 4px 4px 0; }

.docs-body hr { border: 0; height: 1px; background: var(--rule); margin: 48px 0; }

/* Decision card */
.decision-card { background: #fff; border: 1px solid var(--rule);
  border-radius: 8px; padding: 24px 28px; margin: 0 0 20px;
  scroll-margin-top: 24px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
.decision-head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--rule-soft); }
.decision-id { font-family: var(--mono); font-size: 13px; font-weight: 700;
  color: var(--accent); background: var(--code-bg); padding: 4px 10px;
  border-radius: 4px; letter-spacing: 0.04em; }
.decision-head h3 { flex: 1; min-width: 200px; }
.tag { display: inline-block; padding: 4px 12px; border-radius: 999px;
  font-size: 11px; font-family: var(--mono); letter-spacing: 0.06em;
  text-transform: uppercase; font-weight: 700; white-space: nowrap; }
.tag-adopt { background: rgba(47, 107, 58, 0.12); color: var(--green);
  border: 1px solid rgba(47, 107, 58, 0.3); }
.tag-keep { background: rgba(42, 94, 138, 0.12); color: var(--blue);
  border: 1px solid rgba(42, 94, 138, 0.3); }
.tag-adapt { background: rgba(168, 106, 26, 0.12); color: var(--amber);
  border: 1px solid rgba(168, 106, 26, 0.3); }

.decision-body { margin: 0; display: grid; gap: 14px; }
.decision-body > div { display: grid; grid-template-columns: 160px 1fr; gap: 16px;
  align-items: start; }
.decision-body dt { margin: 0; font-family: var(--mono); font-size: 11px;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft);
  font-weight: 700; padding-top: 2px; }
.decision-body dd { margin: 0; font-size: 15px; line-height: 1.55; }

.phase-list li { margin-bottom: 12px; }

.docs-footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--rule);
  text-align: center; color: var(--ink-soft); font-size: 13px; }
.docs-footer a { color: var(--accent); text-decoration: none; }
.docs-footer a:hover { text-decoration: underline; }

.docs-body a { color: var(--accent); text-decoration: underline;
  text-decoration-thickness: 1px; text-underline-offset: 2px; }
.docs-body a:hover { color: var(--accent-soft); }

@media (max-width: 900px) {
  .docs-page { grid-template-columns: 1fr; }
  .docs-toc { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--rule); }
  .docs-body { padding: 32px 24px 64px; }
  .docs-header h1 { font-size: 30px; }
  .decision-body > div { grid-template-columns: 1fr; gap: 4px; }
}
@media print {
  .docs-toc { display: none; }
  .docs-page { display: block; background: white; }
  .docs-body { max-width: none; padding: 0; }
  .decision-card { break-inside: avoid; box-shadow: none; }
}
`;

export default DecisionLog;
