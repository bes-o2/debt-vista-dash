# CFO Dashboard V2 - Plano de Execucao

Documento de trabalho para organizar a evolucao do dashboard CFO V2 no `debt-vista-dash`.

## Objetivo

Consolidar o plano de entrega da V2 com foco em:
- melhor leitura executiva para o CFO
- maior previsibilidade de fluxo, risco e compromisso financeiro
- base tecnica consistente com o padrao atual do projeto
- preparacao para alertas narrativos com IA em etapa futura

## Regras que nao podem ser quebradas

- [ ] Todo texto de UI continua em pt-BR.
- [ ] Moeda continua sempre em BRL.
- [ ] Nao criar inputs monetarios manuais; manter o padrao `useBRLInput` + `CurrencyInput`.
- [ ] Preservar os padroes Supabase do projeto, incluindo isolamento por empresa e RLS.
- [ ] Nao introduzir atalhos que bypassam `company_id` ou contexto de empresa ativa.
- [ ] Nao tocar em codigo-fonte fora do escopo da implementacao aprovada.

## Decisoes de produto

- [ ] Definir quais perguntas o CFO V2 precisa responder em 10 segundos.
- [ ] Confirmar se a home da V2 prioriza visao de caixa, risco, cronograma ou custo da divida.
- [ ] Confirmar quais cards sao obrigatorios no primeiro corte da V2.
- [ ] Definir se a V2 tera modo de leitura executiva apenas ou interacao completa com filtros.
- [ ] Definir linguagem de negocio padrao para alertas, insights e explicacoes.
- [ ] Definir quais metricas sao "headline" e quais vao para detalhes.
- [ ] Definir se o usuario pode comparar empresas lado a lado ou apenas uma empresa ativa por vez.
- [ ] Definir se a V2 substitui a experiencia atual ou entra como area/tab progressiva.
- [ ] Definir o criterio de sucesso do produto: reducao de tempo de leitura, mais acao, ou menor ambiguidade.

## Checklist de execucao

### 1. Descoberta e alinhamento

- [ ] Mapear a jornada principal do CFO na V2.
- [ ] Inventariar quais dados ja existem no banco e quais precisam ser derivados.
- [ ] Mapear dependencias de Supabase, RLS, calculos financeiros e filtros globais.
- [ ] Identificar pontos da UI atual que devem ser preservados por compatibilidade.
- [ ] Registrar decisoes bloqueadas por produto antes de mexer em implementacao.

### 2. Subagents e ownership

- [ ] Subagent Produto: fechar prioridades, linguagem executiva e criterio de aceite.
- [ ] Subagent UX/UI: desenhar hierarquia visual, densidade de informacao e estados vazios.
- [ ] Subagent Dados/Supabase: validar consultas, politicas RLS, empresas e origem dos indicadores.
- [ ] Subagent Frontend: aplicar a interface sem quebrar padroes do projeto.
- [ ] Subagent QA: validar texto pt-BR, formataçao BRL, filtros e comportamento responsivo.

### 3. Estrutura de informacao

- [ ] Definir a composicao do topo da pagina: resumo executivo, alertas, tendencias e proximos vencimentos.
- [ ] Definir quais graficos ou cards sao essenciais e quais entram como detalhamento.
- [ ] Definir o ordenamento por impacto: caixa, divida, custo, prazo, risco.
- [ ] Definir quais estados devem existir: carregando, vazio, parcial, erro e sem permissao.
- [ ] Definir se insights devem ser sempre explicados com dados de origem.

### 4. Dados e consistencia

- [ ] Confirmar que todos os dados respeitam `company_id` e RLS.
- [ ] Confirmar que os calculos financeiros continuam alinhados com as regras existentes.
- [ ] Confirmar que formatos monetarios, taxas e datas mantem consistencia com o restante do app.
- [ ] Confirmar compatibilidade com o formato legado e com o formato de banco, quando aplicavel.
- [ ] Confirmar que a V2 nao introduz uma segunda fonte de verdade para os mesmos indicadores.

### 5. UI e comportamento

- [ ] Manter rotulos, toasts, erros e microcopy em pt-BR.
- [ ] Manter exibicao monetaria em BRL com padrao ja adotado no app.
- [ ] Manter padrao de input monetario do projeto para qualquer campo editavel.
- [ ] Garantir leitura rapida em desktop sem perder clareza no mobile.
- [ ] Garantir que a pagina continue util mesmo com poucos dados.
- [ ] Garantir que a densidade visual ajude o CFO sem criar ruido.

### 6. Observabilidade de produto

- [ ] Registrar quais interacoes indicam valor real da V2.
- [ ] Definir eventos ou sinais de uso que justificam evolucao futura.
- [ ] Definir se o usuario precisa exportar, compartilhar ou apenas consumir a visao.
- [ ] Definir quais erros devem virar feedback acionavel e nao mensagem generica.

### 7. QA e aceite

- [ ] Validar textos 100% em pt-BR.
- [ ] Validar formatacao BRL em todas as superficies monetarias.
- [ ] Validar que os dados respeitam a empresa ativa.
- [ ] Validar comportamento com dados vazios e com volume alto.
- [ ] Validar responsividade em larguras comuns de desktop e mobile.
- [ ] Validar que nenhum fluxo novo exige input monetario fora do padrao do projeto.
- [ ] Validar que a experiencia nao quebra os padroes Supabase/RLS existentes.

## Critérios de aceite

- [ ] A V2 responde rapidamente as perguntas principais do CFO sem exigir leitura longa.
- [ ] A interface permanece coerente com o produto atual e com a localizacao pt-BR.
- [ ] Toda moeda exibida ou editada continua em BRL.
- [ ] Toda leitura de dados respeita `company_id` e RLS.
- [ ] Nenhum campo monetario novo viola o padrao `useBRLInput` + `CurrencyInput`.
- [ ] A solucao nao cria duplicacao de fonte de verdade para indicadores financeiros.
- [ ] Os estados de erro, vazio e carregamento estao tratados.
- [ ] O comportamento foi validado em desktop e mobile.

## Task futura: alertas narrativos com IA

Esta entrega fica registrada como fase posterior, para nao misturar descoberta com implementacao principal.

- [ ] Definir quais alertas merecem narrativa gerada por IA.
- [ ] Definir tom, limite e nivel de assertividade das mensagens.
- [ ] Definir se a IA apenas explica sinais existentes ou tambem sugere acao.
- [ ] Definir requisito de explicabilidade com origem do dado.
- [ ] Definir se o alerta vira card, toast, feed ou resumo executivo.
- [ ] Definir guardrails para evitar alarmismo, duplicidade ou conteudo sem lastro.
- [ ] Definir revisao humana antes de ativar em ambiente real.
- [ ] Definir critério de aceite especifico para qualidade linguistica em pt-BR.

## Entregáveis esperados

- [ ] Documento de decisoes de produto fechado.
- [ ] Lista de tarefas priorizada por dependencia.
- [ ] Definicao de subagents por frente de trabalho.
- [ ] Checklist de aceite para validacao manual.
- [ ] Backlog separado para alertas narrativos com IA.

## Observacao final

Se houver conflito entre a ideia da V2 e os padroes do projeto, os padroes do projeto vencem: pt-BR, BRL, Supabase com RLS e input monetario padrao continuam obrigatorios.
