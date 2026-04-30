# Agent Sync - debt-vista-dash

> Leia este arquivo antes de qualquer tarefa. Ele e o estado compartilhado entre Claude Code e Codex.

## Ultima sessao

- **Data:** 2026-04-30
- **Agente:** Codex
- **Resumo:** Codex abriu o branch `feat/codex-session-2026-04-30`, salvou o prompt em `docs/CODEX_SESSION_PROMPT.md`, registrou o plano em `docs/CODEX_SESSION_PLAN.md`, criou a seed idempotente da "Empresa Demo O2" e entregou DSH-005/DSH-006 no `DashboardStats`. `npm run build` passou no encerramento.

## O que esta funcionando

- `npm run build` passou apos as correcoes dos cards.
- `src/hooks/useDebts.tsx` converte `iof_rate` percentual para `iofAmount` em BRL e migra legacy usando `firstDueDate` em `first_due_date`.
- `src/components/DashboardStats.tsx` calcula PMT SAC com saldo devedor atual, usa `Math.round` para prazo e pondera prazo medio por saldo devedor atual.
- `supabase/functions/calculate-amortization/index.ts` calcula CET persistido usando `releaseDate` como t=0.
- `src/components/DebtChart.tsx` usa CET medio ponderado, respeita o banco global e classifica pre/pos-fixado por normalizacao de string.
- `src/components/DashboardStats.tsx`, `src/components/OutstandingBalanceChart.tsx`, `src/components/DebtProfileChart.tsx` e `src/components/DebtChart.tsx` recebem filtros globais de data.
- `src/lib/debtUtils.ts` exporta `debtIntersectsDateRange`; a semantica escolhida e intersecao entre vigencia da divida (`releaseDate` a `dueDate`) e intervalo selecionado.
- `src/components/AmortizationTable.tsx` mostra "Saldo Devedor" como `principal_balance` antes da amortizacao.
- `src/hooks/useCET.tsx` foi removido porque nao havia importacoes ativas.
- `supabase/migrations/20260430002841_seed_demo_company.sql` cria a "Empresa Demo O2", vincula usuarios `@o2inc.com.br`, insere 5 contratos ficticios e 3 garantias sem inserir parcelas manualmente.
- `src/components/DashboardStats.tsx` exibe ate 5 pontos de atencao deterministicos via `generateCfoAlerts`, com evidencias numericas e links para widgets/areas do dashboard.
- `src/components/DashboardStats.tsx` mostra garantias no resumo executivo: valor total, cobertura sobre saldo, contratos sem garantia e top 3 gaps por banco.

## Em andamento / incompleto

- Validacao visual no browser ainda nao foi feita nesta sessao. Conferir dashboard com a "Empresa Demo O2" depois de gerar as parcelas.
- A migration da empresa demo precisa ser aplicada no Supabase. Depois disso, as parcelas devem ser geradas acessando cada contrato pelo app ou chamando manualmente a edge function `calculate-amortization`.
- Recalcular uma divida de referencia pela edge function para confirmar a diferenca esperada no CET salvo apos mudar o t=0 para `releaseDate`.
- `npm run lint` continua falhando por debitos existentes do projeto, incluindo `no-explicit-any`, interface vazia em `src/components/ui/textarea.tsx`, `require()` em `tailwind.config.ts` e warnings de hooks/Fast Refresh.
- A worktree segue suja com muitas alteracoes anteriores e nao relacionadas. Revisar `git status --short` antes de qualquer commit.

## Problemas conhecidos

- Nao usar `git add -A`: existem alteracoes de produto, docs, tooling e artefatos locais misturados.
- Arquivos/configuracoes locais sensiveis ou temporarios nao devem entrar em commit: `.env`, `.claude/settings.local.json`, `supabase/.temp/`, pastas locais de skills e caches como `graphify-out/`.
- O lint aponta `no-explicit-any` em arquivos que tambem foram tocados ou lidos, mas os `any` reportados sao debitos preexistentes e nao foram resolvidos neste plano.
- `CLAUDE.md` ja esta grande; evitar colar status de sessao nele. Usar `docs/AGENT_SYNC.md` e docs especificos em `docs/`.

## Decisoes tomadas

- Detalhes de execucao do plano dos cards ficam em `docs/CORRECTION_PLAN_CARDS.md`, nao em `CLAUDE.md`.
- Filtro global de data dos cards = intersecao entre vigencia da divida e intervalo selecionado.
- Em `DebtChart`, o filtro interno de banco permanece como refinamento apenas quando o filtro global esta em "todos"; quando ha banco global selecionado, a base ja fica restrita.
- Para `AmortizationTable`, foi escolhida a opcao A do plano: manter o titulo "Saldo Devedor" e exibir o saldo antes do pagamento.
- Contexto persistente anterior: `bes-o2/debt-vista-dash` continua sendo o repositorio canonico e `debt-vista-beta` e o ambiente beta na Vercel.
- O UUID sugerido no prompt para a empresa demo continha `demo`, que nao e hexadecimal e falha como UUID no Postgres. A migration usa `a0000000-de00-0000-0000-000000000001` e documenta a decisao no SQL.
- O prompt usava `interest_type = pre/pos`, mas o schema atual usa `interest_type` como periodicidade (`monthly`/`annual`) e representa pre/pos via `interest_base`, `indexer` e `spread_rate`. A seed segue o schema atual para manter calculos do app.
- O alerta de divida liquida gerado por `generateCfoAlerts` ficou filtrado no dashboard porque ainda nao existe dado de caixa; mostrar caixa zero como critico seria enganoso.

## Proximo agente deve fazer

1. Rodar `git status --short` e manter stage seletivo; ha alteracoes nao relacionadas na worktree.
2. Aplicar/verificar a migration `20260430002841_seed_demo_company.sql` no Supabase e gerar parcelas dos 5 contratos demo pela edge function ou pelo app.
3. Validar no browser a "Empresa Demo O2": pontos de atencao, links/ancoras, card de garantias, filtros globais e mobile 390px.
4. Continuar DSH-007 a DSH-010 ou tratar DSH-016 em commit separado, conforme prioridade.
5. Se for commitar, nao incluir `.claude/settings.local.json`, `supabase/.temp/`, `graphify-out/` ou outros artefatos locais sem confirmacao explicita.

## Nao tocar

- `useEffect` comentado em `src/pages/Index.tsx:62-67`; causava loop de 401 e nao deve ser reativado sem estabilizar refs em `useDataInitialization`.
- `src/integrations/supabase/types.ts`; gerado, nao editar manualmente.
- Migrations antigas; nunca editar uma migration ja aplicada, criar nova se necessario.
- `src/components/ui/`; primitivos shadcn, evitar edicao manual.
- Project ID Supabase atual `objvdyjnryvllvadglns`; nao misturar com o antigo `zujkmyfwfhjkixlymgiv`.
- `.env`, `.claude/settings.local.json`, `supabase/.temp/` e `graphify-out/`; nao stagear/commitar sem confirmacao explicita apos avisar o risco.

## Contexto rapido para Claude

1. UI sempre em pt-BR; moeda sempre BRL com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
2. Inputs monetarios devem usar `useBRLInput` + `CurrencyInput`; nao criar input de moeda manual.
3. Datas vindas do banco em `YYYY-MM-DD` devem passar por `parseLocalDate` quando a comparacao local importar.
4. Componentes de dashboard ja devem receber dividas normalizadas quando esse caminho existir; evitar `.map(normalizeDebtForCalculation)` inline no JSX porque recria arrays.
5. Projeto nao tem suite de testes configurada; hoje a validacao real e build/lint + browser manual.
