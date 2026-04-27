# Dashboard principal - revisao CFO e plano de evolucao

> Data: 2026-04-27
> Escopo: dashboard principal atual em `src/pages/Index.tsx`, ignorando `CfoDashboardV2`.
> Objetivo: documentar o que o dashboard ja responde, o que falta para uma leitura de CFO e quais tasks devem ser implementadas em outro momento.

## Premissas

- O experimento `CfoDashboardV2` esta fora do escopo desta analise.
- A evolucao deve acontecer sobre o dashboard principal atual, sem criar outra experiencia paralela.
- A primeira entrega futura deve ser incremental e reversivel: melhorar leitura, controle de cards e confianca dos dados antes de adicionar IA ou automacoes.
- Edicao de cards significa editar layout, visibilidade, titulo local e preferencias de exibicao. Nao significa editar valores financeiros calculados.
- A persistencia inicial de layout pode ser local por usuario/empresa; persistencia no Supabase fica para etapa posterior se houver validacao de valor.

## Verificacao rodada

| Check | Resultado | Observacao |
| --- | --- | --- |
| `npm run build` | Passou | Build Vite gerado com sucesso. Aviso de bundle grande: `assets/index-BbrAuUN7.js` com ~1.196 MB minificado. |
| `npm run lint` | Falhou | 8 erros e 14 warnings ja conhecidos: `no-explicit-any`, interface vazia em `textarea.tsx`, `require()` no `tailwind.config.ts`, warnings de hooks/Fast Refresh. |
| Analise estatica do dashboard | Concluida | O dashboard principal usa `GlobalFilters`, `DashboardStats`, `OutstandingBalanceChart`, `DebtProfileChart` e `DebtChart`. |
| Validacao visual no browser | Nao rodada | Requer ambiente autenticado e dados representativos. Deve entrar no QA manual das tasks. |

## Superficie atual do dashboard principal

| Area | Arquivo | O que responde hoje | Gap CFO |
| --- | --- | --- | --- |
| Filtros globais | `src/components/GlobalFilters.tsx` | Banco, sistema de amortizacao, dividas especificas e intervalo de datas. | A semantica de data e por intersecao da vigencia da divida, nao por vencimento de parcela. Isso pode confundir uma leitura de fluxo de caixa. |
| KPIs principais | `src/components/DashboardStats.tsx` | Saldo devedor atual, parcela corrente, prazo medio restante, CET medio, spread medio. | Falta ranking de prioridade: qual numero exige acao primeiro. |
| Saldo por banco | `src/components/OutstandingBalanceChart.tsx` | Evolucao de saldo por banco, PMT do mes, saldo atual, horizonte 12m/24m/total e opcao de caixa liberado. | Muito rico, mas a resposta executiva fica escondida dentro do card. O CFO precisa enxergar pico, alivio e concentracao sem procurar. |
| Perfil da divida | `src/components/DebtProfileChart.tsx` | Curto prazo vs longo prazo por banco e data-base. | Bom para estrutura de vencimentos, mas nao explicita "quanto vence nos proximos 12 meses" como alerta de caixa. |
| Comparativo por banco | `src/components/DebtChart.tsx` | Principal/saldo, juros, CET medio e filtro pre/pos-fixado. | A visao e analitica, mas ainda nao conecta custo alto a uma acao sugerida. |
| Fluxo de pagamento | `src/components/CashFlowAnalysis.tsx` | Projecao mensal/acumulada por banco e divida, com tabela de apoio. | Fica em outra aba, com filtros proprios. O dashboard principal nao herda a leitura de proximos 30/90/180 dias. |
| Sensibilidade | `src/components/SensitivityAnalysis.tsx` via Settings | Simulacao simples de +/-2% nas taxas. | Escondida em configuracoes e matematicamente simplificada. Nao deve ser promovida sem revisar o modelo. |
| Garantias | `src/hooks/useDebtGuarantees.tsx` e `docs/DEBT_GUARANTEES.md` | Dados e metricas existem para garantias. | O dashboard principal nao mostra cobertura, contratos sem garantia ou gap por banco. |

## Simulacao CFO: perguntas de 10 segundos

| Pergunta do CFO | Resposta atual | Status |
| --- | --- | --- |
| Quanto devo hoje? | `Saldo Devedor Atual` e saldo atual por banco. | Responde bem. |
| Quanto sai de caixa agora? | `Parcela Corrente` e PMT do mes no saldo por banco. | Responde, mas sem janela 30/90/180 dias no topo. |
| Qual credor concentra meu risco? | Saldo por banco e composicao atual. | Responde parcialmente; falta limiar/alerta. |
| Qual indexador me deixa exposto? | Filtro pre/pos no comparativo e `DebtProfileChart` nao foca indexador. | Parcial. Falta card claro de exposicao por indexador. |
| O custo da carteira esta caro? | CET medio e spread medio vs CDI. | Responde, mas falta comparacao por contrato/banco para priorizar renegociacao. |
| Quando vem o maior aperto de caixa? | Fluxo de pagamento consegue mostrar, mas em outra aba. | Parcial. Falta "maior PMT mensal" e "vencimentos 12m" no dashboard. |
| Quais contratos eu deveria atacar primeiro? | Nao existe ranking executivo. | Nao responde. |
| Minhas garantias cobrem a exposicao? | O cadastro existe, mas o dashboard principal nao mostra. | Nao responde. |
| Posso organizar o dashboard para a minha rotina? | Layout fixo. | Nao responde. |

## Achados principais

1. O dashboard ja tem bons blocos analiticos, mas ainda nao tem uma camada de decisao.
2. O CFO precisa de "prioridade e proxima acao", nao apenas mais graficos.
3. A semantica do filtro de data precisa ficar explicita: carteira vigente no periodo vs parcelas que vencem no periodo.
4. Varias superficies buscam ou derivam parcelas separadamente; antes de crescer, vale consolidar uma fonte de metricas do dashboard.
5. A feature de cards customizaveis e uma boa direcao, desde que comece simples: colapsar, ocultar, reordenar e editar preferencias, sem mexer nos valores calculados.
6. O bundle ja esta grande; uma feature de drag-and-drop deve ser avaliada com cuidado ou carregada sob demanda.
7. Existem componentes/ideias soltas que precisam decisao: `NetDebtCard` retorna `null`; `SensitivityAnalysis` existe, mas fica escondida e simplificada.

## Recomendacoes de produto

### P0 - Confianca e leitura executiva

- Criar um bloco de "Resumo executivo" dentro do dashboard principal, nao uma nova V2.
- Mostrar no topo: saldo devedor, PMT 30/90 dias, maior pico mensal, maior concentracao por banco, CET/spread e quantidade de contratos sem garantia.
- Adicionar uma lista curta de "pontos de atencao" deterministica, sem IA no primeiro momento.
- Explicitar nos filtros se o periodo esta filtrando vigencia da divida ou fluxo de parcelas.

### P1 - Cards colapsaveis, moveis e editaveis

- Criar um `DashboardWidgetShell` reutilizavel para cards do dashboard.
- Cada widget deve ter `id`, titulo, descricao curta, tamanho padrao, componente, estado colapsado e configuracoes permitidas.
- Evitar card dentro de card: o shell deve substituir o `Card` raiz dos widgets ou receber modo `unstyled`.
- Persistir ordem, colapso e visibilidade por `company_id` e usuario no `localStorage` primeiro.
- Comecar com mover para cima/baixo por botoes acessiveis. Drag-and-drop pode vir depois com `@dnd-kit`, se o bundle permitir.
- Configuracoes editaveis devem ser especificas: horizonte 12m/24m/total, visao atual/total, densidade compacta/padrao, titulo local e filtros do card.

### P2 - Drill-down e acao

- Cada KPI ou alerta deve levar para a tabela, fluxo ou cadastros ja filtrados.
- Adicionar ranking: contratos por maior CET, maior PMT futuro, maior saldo, vencimento proximo e falta de garantia.
- Levar garantias para o dashboard principal com cobertura total, gap e contratos sem garantia.
- Promover sensibilidade apenas depois de revisar a matematica e explicar premissas.

## Plano de tasks para segundo momento

### Epic 1 - Fonte unica de metricas do dashboard

**DSH-001 - Inventariar metricas e widgets atuais**
- Objetivo: registrar todos os widgets, entradas, filtros e metricas usadas no dashboard principal.
- Escopo: `Index.tsx`, `DashboardStats`, `OutstandingBalanceChart`, `DebtProfileChart`, `DebtChart`, `CashFlowAnalysis`.
- Aceite: documento curto com lista de widgets, metricas, dependencias de parcelas/garantias e semantica de data.
- Verificacao: build passa; nenhuma alteracao visual obrigatoria.

**DSH-002 - Criar hook de metricas consolidadas do dashboard**
- Objetivo: reduzir logica duplicada e preparar KPIs executivos.
- Escopo sugerido: `src/hooks/useDashboardMetrics.tsx` ou `src/lib/dashboardMetrics.ts`.
- Aceite: saldo, PMT corrente, PMT 30/90/180, CET medio, spread, concentracao por banco/indexador e vencimentos 12m saem de uma fonte compartilhada.
- Verificacao: comparar valores com os widgets atuais usando dados representativos.

**DSH-003 - Definir semantica de filtro de periodo**
- Objetivo: separar "contratos vigentes no periodo" de "parcelas vencendo no periodo".
- Aceite: UI usa labels em pt-BR sem ambiguidade e os widgets aplicam a mesma regra.
- Verificacao: testar contrato vigente sem parcela no periodo e contrato com vencimento dentro do periodo.

### Epic 2 - Resumo executivo no dashboard principal

**DSH-004 - Adicionar bloco "Resumo executivo"**
- Objetivo: responder em ate 10 segundos: quanto devo, quanto pago, onde esta o risco e qual item pede atencao.
- Escopo: novo bloco no topo da aba `Dashboard`, antes ou junto dos KPIs atuais.
- Aceite: sem criar nova aba; todo texto em pt-BR; moeda em BRL; estados vazio/carregando/erro tratados.
- Verificacao: desktop e mobile com poucos dados e carteira grande.

**DSH-005 - Criar pontos de atencao deterministicos**
- Objetivo: listar 3 a 5 alertas baseados em regra, sem IA.
- Regras iniciais: concentracao por banco, pico de PMT, CET acima de limite, vencimentos 12m, garantia insuficiente.
- Aceite: cada alerta mostra evidencia numerica e destino de drill-down.
- Verificacao: fixtures manuais ou dados reais representativos.

**DSH-006 - Incluir garantias no dashboard principal**
- Objetivo: mostrar cobertura de garantias sem depender de tela experimental.
- Aceite: total de garantias, cobertura sobre saldo, contratos sem garantia e gap por banco.
- Verificacao: empresa com zero, uma e multiplas garantias.

### Epic 3 - Cards colapsaveis, moveis e editaveis

**DSH-007 - Criar registry de widgets do dashboard**
- Objetivo: declarar os cards em uma lista controlada.
- Campos minimos: `id`, `title`, `defaultOrder`, `defaultSize`, `canCollapse`, `canHide`, `settingsSchema`.
- Aceite: dashboard renderiza widgets pela registry sem mudar comportamento visual.
- Verificacao: ordem igual a atual antes de ligar customizacao.

**DSH-008 - Implementar colapsar/expandir e ocultar cards**
- Objetivo: permitir reduzir ruido visual sem perder dados.
- Aceite: controles com `aria-label`, hit area minima de 40px, estado persistido por empresa.
- Verificacao: recarregar pagina mantem estado; teclado consegue alternar.

**DSH-009 - Implementar reordenacao simples**
- Objetivo: permitir mover cards sem adicionar dependencia pesada no primeiro corte.
- Abordagem inicial: botoes "mover para cima/baixo" em menu do card.
- Aceite: ordem persistida; mobile nao quebra; foco do teclado continua previsivel.
- Verificacao: mover cards em desktop e mobile; limpar layout volta ao padrao.

**DSH-010 - Implementar configuracoes editaveis por card**
- Objetivo: editar preferencias do widget, nao os numeros.
- Exemplos: titulo local, modo compacto, horizonte do grafico, visao atual/total, exibir/ocultar linha de CET.
- Aceite: configuracoes sao validadas, reversiveis e persistidas por empresa.
- Verificacao: card de saldo por banco, perfil e comparativo usam preferencias sem alterar calculos.

**DSH-011 - Avaliar drag-and-drop com carregamento sob demanda**
- Objetivo: decidir se vale usar `@dnd-kit` depois do MVP com botoes.
- Aceite: decisao documentada com impacto de bundle e acessibilidade.
- Verificacao: comparar tamanho do bundle antes/depois se a dependencia for adicionada.

### Epic 4 - Drill-down e fluxo de decisao

**DSH-012 - Drill-down de KPI para tabela/fluxo**
- Objetivo: clicar em KPI/alerta e abrir tabela ou fluxo ja filtrado.
- Aceite: filtro preserva banco, dividas e periodo; botao de limpar filtros visivel.
- Verificacao: saldo por banco abre tabela consolidada daquele banco; pico de PMT abre fluxo no mes correto.

**DSH-013 - Presets de filtros**
- Objetivo: salvar visoes recorrentes do CFO.
- Exemplos: "Proximos 90 dias", "Banco principal", "Pos-fixado", "Vencimentos 12m".
- Aceite: presets em pt-BR, reversiveis e sem misturar empresas.
- Verificacao: trocar empresa ativa nao reaproveita preset indevido.

**DSH-014 - Ranking de contratos acionaveis**
- Objetivo: transformar analise em fila de acao.
- Rankings: maior CET, maior saldo, maior PMT futuro, vencimento mais proximo, sem garantia.
- Aceite: cada item mostra motivo e acao: abrir cadastro, abrir tabela ou abrir fluxo.
- Verificacao: carteira com 10+ contratos.

### Epic 5 - Qualidade, performance e QA manual

**DSH-015 - Code splitting das areas pesadas**
- Objetivo: reduzir impacto do bundle principal.
- Alvos: Settings/Sensitivity e widgets abaixo da dobra se aplicavel.
- Aceite: build continua passando; bundle principal reduzido ou justificativa registrada.
- Verificacao: `npm run build` e comparacao dos assets.

**DSH-016 - Corrigir lint bloqueante em tarefa separada**
- Objetivo: remover erros de ESLint sem misturar com feature de dashboard.
- Aceite: `npm run lint` passa ou sobram apenas warnings aceitos.
- Verificacao: `npm run lint`.

**DSH-017 - Matriz de QA manual do dashboard**
- Objetivo: padronizar validacao sem suite de testes automatizada.
- Cenarios minimos: sem dividas, 1 divida, muitos contratos, SAC maduro, PRICE, pre/pos, garantias, filtros por banco/data, mobile 390px, desktop 1440px.
- Aceite: checklist em docs com resultados e screenshots quando possivel.
- Verificacao: navegador autenticado com dados representativos.

## Sequencia recomendada

1. DSH-001 a DSH-003: consolidar entendimento e metricas.
2. DSH-004 a DSH-006: melhorar resposta executiva sem mudar arquitetura visual inteira.
3. DSH-007 a DSH-010: customizacao de cards com persistencia local.
4. DSH-012 a DSH-014: drill-down e fluxo de acao.
5. DSH-015 a DSH-017: performance, lint e QA manual.

## Nao fazer ainda

- Nao recriar uma V2 paralela.
- Nao adicionar IA antes de alertas deterministicos ficarem bons.
- Nao adicionar drag-and-drop antes de provar valor com reordenacao simples.
- Nao salvar layout no Supabase antes de validar o modelo local por empresa.
- Nao promover `SensitivityAnalysis` ao dashboard antes de revisar a matematica.
- Nao editar componentes em `src/components/ui/` para esta feature.
