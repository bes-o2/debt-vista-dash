# Guia de Prompts — Debt Vista Dash

Documento de conhecimento para auxiliar o assistente de IA a gerar prompts eficazes
para este projeto específico. Use como referência antes de formular qualquer prompt
destinado ao Claude/Lovable sobre este repositório.

---

## 0. SINCRONIZAÇÃO ENTRE AGENTES — LEIA PRIMEIRO

Este projeto é editado alternadamente por **Claude Code** e **Codex**. O estado compartilhado entre as sessões fica em:

```
docs/AGENT_SYNC.md
```

**Ao iniciar qualquer sessão neste repositório:**
1. Leia `docs/AGENT_SYNC.md` completamente antes de qualquer outra ação
2. Verifique a seção "Próximo agente deve fazer" — é a fila de trabalho priorizada
3. Verifique "Não tocar" — respeite estritamente
4. Verifique "Contexto rápido para Codex" — regras que costumam ser esquecidas

**Ao encerrar qualquer sessão:**
1. Atualize `docs/AGENT_SYNC.md` com o que foi feito, o que ficou pendente e decisões tomadas
2. Faça commit e push do arquivo atualizado junto com o código

> Claude Code usa o comando `/handoff` para gerar e pushar o sync automaticamente.
> No Codex, siga o mesmo processo manualmente ao encerrar.

---

## 1. CONTEXTO DO PROJETO

### 1.1 Visão geral
- **Nome:** Debt Vista Dash (Dashboard de Análise de Endividamento)
- **Origem:** Projeto Lovable (lovable.dev), com sync bidirecional para GitHub.
- **Idioma da UI e dos dados:** Português (Brasil).
- **Domínio:** Gestão financeira corporativa — cadastro de dívidas, cronogramas de
  amortização, análise de fluxo de caixa, projeções de indexadores e indicadores
  consolidados por empresa.

### 1.2 Stack técnica
- **Build/Runtime:** Vite + React 18 + TypeScript.
- **UI:** shadcn-ui (Radix primitives) + Tailwind CSS + `tailwindcss-animate`.
- **Ícones:** lucide-react. **Gráficos:** recharts. **Forms:** react-hook-form + zod.
- **Data fetching:** @tanstack/react-query.
- **Backend:** Supabase (Postgres + Auth + RLS + Edge Functions em Deno).
- **Roteamento:** react-router-dom v6.
- **Datas:** date-fns. **Toasts:** sonner / shadcn toast.

### 1.3 Estrutura de pastas
```
src/
  pages/          # Index.tsx, Auth.tsx, NotFound.tsx
  components/     # Componentes de domínio + ui/ (shadcn)
  hooks/          # useDebts, useCompany, useEconomicIndices, useCET, etc.
  integrations/   # supabase/ (client + types gerados)
  lib/            # cetCalculator, irrCalculator, debtUtils, tooltips, utils
supabase/
  migrations/     # SQL versionado (timestamp_uuid.sql)
  functions/      # calculate-amortization, fetch-bcb-rates
```

### 1.4 Entidades e conceitos chave
- **Empresa (Company):** tenant/escopo de filtro global. Todo dado pertence a uma empresa.
- **Dívida (Debt):** contrato de financiamento com indexador (CDI/SELIC/IPCA/Pré),
  taxa, prazo, carência, sistema de amortização (SAC/Price/Bullet).
- **Parcela (Installment):** linha da tabela de amortização gerada a partir da dívida.
- **Índice econômico (Economic Index):** série histórica de CDI/SELIC/IPCA importada
  do BCB via edge function `fetch-bcb-rates`.
- **Projeção de índice (Index Projection):** valor manual futuro anual por indexador.
- **CET:** Custo Efetivo Total, calculado em `lib/cetCalculator.ts` (usa IRR).
- **Dívida líquida (Net Debt):** dívida bruta menos caixa/aplicações.

### 1.5 Convenções do codebase
- **Formatação monetária:** BRL com `useBRLInput` e utilitários em `lib/debtUtils.ts`.
  Padrão detalhado em `docs/CURRENCY_INPUT_PATTERN.md`.
- **Datas:** inputs usam `useDateInput`; exibição com `date-fns` (pt-BR).
- **Supabase types:** gerados automaticamente — não editar manualmente
  `src/integrations/supabase/types.ts`.
- **Migrations:** nunca editar migrações existentes; criar novo arquivo
  `YYYYMMDDHHMMSS_<uuid>.sql` em `supabase/migrations/`.
- **RLS obrigatório:** toda tabela nova precisa habilitar RLS + policies por usuário/empresa.
- **Theming:** modo claro/escuro via `next-themes`, tokens em `index.css` e `tailwind.config.ts`.
- **Aliases:** `@/` → `src/`.

### 1.6 Restrições e armadilhas conhecidas
- Projeto é editado tanto no Lovable quanto no GitHub — evitar refactors massivos
  que quebrem o sync; manter diffs cirúrgicos.
- Há `MIGRATIONS_LOG.md` com migrações pendentes/aplicadas — consultar antes de
  propor mudanças de schema.
- Cálculos financeiros (amortização, CET, IRR) têm contrapartes no frontend
  (`lib/`) e no edge function `calculate-amortization` — manter paridade.
- Valores monetários são `decimal` no Postgres → `number` no TS; cuidado com
  precisão de ponto flutuante em somatórios.
- Edge functions rodam em Deno; imports usam URLs (`https://esm.sh/...`).

---

## 2. INSTRUÇÕES DE PROMPT

Diretrizes para o assistente construir prompts a serem enviados ao Claude neste projeto.

### 2.1 Estrutura recomendada de um prompt
Todo prompt para tarefas de desenvolvimento deve conter, nesta ordem:
1. **Objetivo em uma frase** — o que o usuário quer obter.
2. **Contexto relevante** — qual entidade/tela/fluxo é afetado (cite arquivos
   com caminho, ex.: `src/components/DebtForm.tsx`).
3. **Comportamento atual** (se for bug/refactor) — o que acontece hoje.
4. **Comportamento esperado** — o que deve acontecer depois.
5. **Restrições** — não quebrar X, manter Y, seguir padrão Z.
6. **Critério de aceite** — como validar (lint, build, teste manual específico).

### 2.2 Regras de escrita
- **Idioma:** português, mesmo em prompts técnicos, alinhado à UI do projeto.
- **Seja específico com arquivos e linhas** sempre que possível
  (`src/hooks/useDebts.tsx:L120`).
- **Nomeie entidades do domínio** usando o vocabulário da seção 1.4 (dívida,
  parcela, empresa, indexador) — evitar termos genéricos como "item" ou "registro".
- **Evite pedir reescritas completas** — solicite edições pontuais.
- **Uma tarefa por prompt.** Se houver múltiplos itens, liste-os numerados e peça
  que o Claude confirme o plano antes de executar.

### 2.3 Padrões obrigatórios a citar no prompt
Lembrar o Claude destes pontos sempre que a tarefa os tocar:
- "Use shadcn-ui e tokens do Tailwind, não CSS inline nem cores hardcoded."
- "Para inputs monetários, siga `docs/CURRENCY_INPUT_PATTERN.md` e use `useBRLInput`."
- "Toda mudança de schema → nova migration em `supabase/migrations/`, nunca editar
  migrations existentes. Habilitar RLS e policies."
- "Não editar `src/integrations/supabase/types.ts` manualmente."
- "Cálculos financeiros devem manter paridade entre `src/lib/` e a edge function
  `calculate-amortization`."
- "Queries devem usar `@tanstack/react-query` com keys consistentes e invalidação
  após mutations."
- "Forms novos → react-hook-form + zod + componentes `Form` de shadcn."

### 2.4 Tipos de tarefa e gatilhos de prompt
- **Nova feature de UI:** especificar página/rota, componentes a criar ou estender,
  hooks de dados envolvidos, estado local vs. react-query.
- **Alteração de schema:** listar tabelas afetadas, campos, defaults, policies RLS,
  e se exige backfill ou nova edge function.
- **Ajuste de cálculo financeiro:** citar a função exata em `lib/`, o comportamento
  atual, a fórmula esperada e casos de teste (valores de entrada/saída).
- **Bug fix:** incluir passos para reproduzir, print/stack trace se houver,
  componente/hook suspeito.
- **Refactor:** delimitar escopo (um arquivo/módulo), justificar ganho, proibir
  mudanças fora do escopo.

### 2.5 Checklist antes de enviar o prompt
- [ ] Contexto aponta arquivos concretos do repo.
- [ ] Usa vocabulário de domínio correto.
- [ ] Declara o que NÃO deve mudar.
- [ ] Define critério de aceite verificável.
- [ ] Menciona padrões aplicáveis (currency, RLS, react-query, etc.).
- [ ] Cabe em uma iteração única; tarefas longas foram quebradas.

### 2.6 Modelos rápidos

**Modelo A — Feature incremental**
> Objetivo: <1 frase>.
> Contexto: afeta `<arquivo>` e o hook `<useX>`.
> Hoje: <comportamento atual>.
> Esperado: <novo comportamento>.
> Restrições: não alterar schema; reutilizar `<componente>`; seguir
> `docs/CURRENCY_INPUT_PATTERN.md` se houver valor monetário.
> Aceite: `npm run lint` limpo e fluxo <passos> funcional no browser.

**Modelo B — Migration/backend**
> Objetivo: <1 frase>.
> Schema: criar/alterar tabela `<nome>` com colunas <lista>.
> RLS: policies <select/insert/update/delete> por <company_id/user_id>.
> Frontend: expor via hook `<useX>` com react-query; invalidar após mutation.
> Aceite: nova migration em `supabase/migrations/`, tipos regenerados, tela
> `<rota>` lê/escreve sem erro.

**Modelo C — Bug fix**
> Objetivo: corrigir <bug> em `<arquivo:linha>`.
> Reproduzir: <passos>.
> Causa suspeita: <hipótese>.
> Correção aceita apenas em `<arquivo(s)>`; não refatorar vizinhos.
> Aceite: bug não reproduz + nenhum regressão nos fluxos <X, Y>.
