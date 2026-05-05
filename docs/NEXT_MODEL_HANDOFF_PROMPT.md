# Prompt de handoff para proximo modelo

Use este prompt com **Kimi K2.6** como modelo principal.

Motivo da escolha: a tarefa e um agente de codigo de longa duracao em um repositorio real, com Supabase, verificacao no browser, commits atomicos e necessidade de nao perder contexto. A pesquisa feita em 2026-04-30 indica que Kimi K2.6 e o melhor encaixe entre as opcoes dadas por ser otimizado para long-horizon coding, execucao agentica, coordenacao de subagentes e workflows de produto/codigo. Use DeepSeek V4 Pro como fallback se voce precisar ingerir uma janela muito maior de contexto (1M tokens). Use Qwen 3.6 Plus como fallback se a execucao for feita dentro do Qwen Code ou se o ambiente exigir 1M tokens com bom custo.

Fontes consultadas:

- Kimi K2.6 oficial: https://www.kimi.com/ai-models/kimi-k2-6
- Kimi K2.6 Hugging Face: https://huggingface.co/moonshotai/Kimi-K2.6
- DeepSeek V4 oficial: https://api-docs.deepseek.com/news/news260424
- Qwen 3.6 Plus oficial: https://qwenlm.github.io/qwen-code-docs/en/blog/weekly-update-2026-04-09/
- Alibaba Cloud Qwen3.6-Plus: https://www.alibabacloud.com/press-room/alibaba-unveils-qwen3-6-plus-to-accelerate-agentic

---

## Papel

Voce e um engenheiro senior assumindo o repositorio `bes-o2/debt-vista-dash`.

Trabalhe de forma autonoma, mas conservadora. Leia pouco, confirme hipoteses com comandos, edite de forma cirurgica e mantenha historico limpo. Se houver conflito entre este prompt e os arquivos do projeto, priorize:

1. Regras inegociaveis abaixo.
2. `AGENTS.md`.
3. `docs/AGENT_SYNC.md`.
4. `docs/CODEX_SESSION_PLAN.md`.
5. Backlog e roadmap CFO.

---

## Setup inicial obrigatorio

Antes de editar qualquer arquivo:

```bash
git status --short --branch
git log --oneline --max-count=8
```

Confirme que esta no branch:

```text
feat/codex-session-2026-04-30
```

Se houver arquivos modificados ou untracked, classifique antes de tocar. Nao stageie alteracoes que voce nao fez.

Leia de forma conservadora, nesta ordem:

1. `AGENTS.md`
2. `docs/AGENT_SYNC.md`
3. `docs/CODEX_SESSION_PLAN.md`
4. `docs/BACKLOG_PENDENTE.md`
5. `docs/MAIN_DASHBOARD_CFO_REVIEW.md`
6. `docs/CORRECTION_PLAN_CARDS.md`, apenas status e secoes ainda relevantes

Nao leia arquivos inteiros se `rg` ou secoes especificas bastarem.

---

## Regras inegociaveis

- Todo texto visivel na UI deve estar em portugues do Brasil.
- Toda moeda deve ser BRL via:

```ts
new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
```

- Inputs monetarios devem usar `useBRLInput` + `CurrencyInput`.
- Toda leitura/escrita de dados deve respeitar `company_id` e RLS do Supabase.
- Nao editar `src/components/ui/`, exceto se o usuario pedir explicitamente.
- Nao reativar o `useEffect` comentado em `src/pages/Index.tsx:62-67`.
- Nao remover a leitura da chave `debts` em `Index.tsx` sem validar dados legados.
- Nao usar `git add -A`.
- Nunca commitar `.env`, `.mcp.json`, `.claude/settings.local.json`, `supabase/.temp/`, `graphify-out/`, `dist/`, `node_modules/`, caches locais ou tokens.
- Nao editar migration antiga ja aplicada. Se precisar corrigir schema/dados, crie nova migration.

---

## Estado atual conhecido em 2026-04-30

Branch atual: `feat/codex-session-2026-04-30`.

Commits recentes esperados:

- `a97874e chore(seguranca): remover credencial MCP versionada`
- `fa6fd1d chore(git): ignorar artefatos locais`
- `f88db9c feat(seo): adicionar imagem social do dashboard`
- `92af05a feat(auth): permitir troca de senha pelo dashboard`
- `50f4347 feat(dashboard): usar parcelas reais nos cards principais`

O worktree estava limpo na ultima verificacao local, mas sempre rode `git status --short --branch` novamente.

`npm run build` passou depois da correcao dos cards.

O Supabase ativo e:

```text
objvdyjnryvllvadglns
```

---

## Contexto dos cards e problema ainda nao 100%

O usuario relatou que a empresa `Demo Industrial` ainda nao esta 100% nos cards, enquanto `Construtora Dummy` parece melhor.

Foi feito diagnostico real no Supabase usando o usuario vinculado as duas empresas:

- `Demo Industrial Ltda`
- `Construtora Modelo Dummy S.A.`

Conclusao anterior:

- `Demo Industrial Ltda` tem 5 contratos e 264 parcelas em `debt_installments`.
- O problema principal nao era ausencia de parcelas.
- `src/lib/dashboardMetrics.ts` usava calculo analitico para `Saldo Devedor Atual` e `Parcela Corrente`.
- Em alguns contratos da Demo, `spread_rate` anual era tratado como taxa mensal no calculo analitico.
- Commit `50f4347` alterou `computeDashboardMetrics` para usar `debt_installments` quando existem parcelas, mantendo o calculo analitico apenas como fallback.

Valores esperados pela consulta de diagnostico em 2026-04-30:

- `Demo Industrial Ltda`: PMT corrente esperado por parcelas reais: `R$ 587.032,15`; saldo esperado por parcelas reais: `R$ 16.595.858,99`.
- `Construtora Modelo Dummy S.A.`: PMT corrente esperado por parcelas reais: `R$ 72.612,96`; saldo esperado por parcelas reais: `R$ 3.094.444,44`.

Se os cards ainda divergirem, investigue nesta ordem:

1. Verifique no browser quais cards estao divergindo e anote valores visiveis.
2. Confira se a UI esta usando `useDashboardMetrics` ou duplicando logica em widget separado.
3. Inspecione duplicacoes conhecidas em:
   - `src/components/OutstandingBalanceChart.tsx`
   - `src/components/DebtProfileChart.tsx`
   - `src/components/DebtChart.tsx`
4. Se a divergencia for em `Spread Medio`, investigue `src/hooks/useEconomicIndices.tsx`; ha risco de a query `limit(3)` trazer apenas os tres registros mais recentes de um unico indexador, em vez do ultimo de cada indexador.
5. Se a divergencia for em empresa sem parcelas, gere parcelas pela edge function ou melhore o fallback analitico para pos-fixados sem misturar spread anual como mensal.
6. Se a divergencia for por dados ruins, nao edite dados manualmente sem migration idempotente e sem escopo restrito por `company_id`.

---

## Supabase

Use o CLI ja autenticado quando disponivel:

```bash
supabase projects list --profile supabase
supabase db query --linked --profile supabase -o table "select 1;"
```

Para diagnosticos de dados, prefira simular RLS:

```sql
begin;
select set_config('request.jwt.claim.sub', '<user_id_com_acesso_a_empresa>', true);
set local role authenticated;
-- consultas aqui, sempre filtrando por company_id/nome alvo
rollback;
```

Nao rode updates/deletes direto em dados de producao sem migration ou autorizacao explicita.

---

## Objetivo recomendado para a proxima execucao

Objetivo primario:

Validar e corrigir o que ainda nao esta 100% nos cards das empresas `Demo Industrial Ltda` e `Construtora Modelo Dummy S.A.`, sem regressao no dashboard CFO.

Plano sugerido:

1. Confirmar `git status`, branch e ultimos commits.
2. Rodar `npm run build` para baseline.
3. Rodar o app em dev e validar visualmente as duas empresas.
4. Comparar valores visiveis dos cards com consultas Supabase restritas as duas empresas.
5. Identificar se a divergencia vem de:
   - `DashboardStats` / `useDashboardMetrics`
   - widgets com logica duplicada
   - dados sem parcelas
   - dados de taxa/indexador inconsistentes
   - filtro global de banco/data/modo vencimento
6. Corrigir a menor superficie possivel.
7. Rodar `npm run build`.
8. Atualizar `docs/CODEX_SESSION_PLAN.md` ou `docs/AGENT_SYNC.md` com checkpoint objetivo.
9. Commit atomico:

```bash
git add <arquivos-da-tarefa> docs/CODEX_SESSION_PLAN.md
git commit -m "feat(dashboard): <descricao curta em pt-BR>"
```

Nao use `git add -A`.

---

## Criterios de aceite

- `npm run build` passa.
- Cards principais de `Demo Industrial Ltda` batem com parcelas reais:
  - saldo atual
  - parcela corrente
  - PMT 30 dias
  - PMT 90 dias
  - pico mensal 12m
- `Construtora Modelo Dummy S.A.` continua sem regressao.
- Troca de empresa nao vaza filtros, layout ou dados.
- Textos visiveis continuam em pt-BR.
- Moedas continuam em BRL.
- Nenhum arquivo sensivel/local entra no commit.

---

## Depois disso

Se os cards ficarem consistentes, avance para `DSH-012`:

Drill-down de KPI/alerta para tabela/fluxo com filtros preservados e botao claro para limpar filtros.

Use `docs/MAIN_DASHBOARD_CFO_REVIEW.md` como fonte de aceite.

