# CLAUDE.md

Este arquivo orienta o Claude Code ao trabalhar neste repositório. Tudo aqui é contexto estável do projeto — não é documentação de produto.

## Visão geral

**debt-vista-dash** é um dashboard web da **O2 Inc** para análise de dívidas e financiamentos corporativos. O CFO cadastra contratos de dívida de uma empresa e visualiza informações como:

- Tabelas de amortização (SAC e PRICE)
- Projeções de fluxo de caixa / PMTs
- Saldo devedor por banco e perfil da dívida
- Análise de sensibilidade e CET (Custo Efetivo Total)
- Taxas econômicas do Banco Central (CDI, SELIC, IPCA)

O sistema suporta **múltiplas empresas por usuário** — o usuário escolhe a empresa ativa e todos os dados são filtrados por `company_id` via RLS no Supabase.

## Stack

- **Frontend**: Vite + React 18 + TypeScript
- **UI**: shadcn/ui (Radix primitives) + Tailwind CSS + `next-themes` (dark por padrão)
- **Estado servidor**: `@tanstack/react-query`
- **Formulários**: `react-hook-form` + `zod`
- **Gráficos**: `recharts`
- **Roteamento**: `react-router-dom` v6
- **Backend**: Supabase (Postgres + Auth + Edge Functions em Deno)
- **Notificações**: `sonner` + hook custom `useToast`
- **Origem**: projeto gerado no [Lovable](https://lovable.dev) — o `lovable-tagger` ainda roda em dev (plugin Vite)

## Comandos

```bash
npm run dev        # Vite dev server em http://localhost:8080
npm run build      # Build de produção
npm run build:dev  # Build com flag de desenvolvimento
npm run lint       # ESLint
npm run preview    # Serve o build
```

Não há suite de testes configurada (sem Vitest/Jest). Validação hoje é manual no browser.

## Estrutura

```
src/
├── components/          # Componentes de domínio (DebtForm, DashboardStats, etc.)
│   └── ui/              # Primitivos shadcn/ui — não editar manualmente, usar CLI
├── hooks/               # Hooks de estado e integração (useDebts, useAuth, useCompany)
├── integrations/
│   └── supabase/        # client.ts (não editar) + types.ts (gerado)
├── lib/                 # Lógica pura: debtUtils, cetCalculator, irrCalculator, tooltips
├── pages/               # Auth, Index (dashboard principal), NotFound
├── App.tsx              # Providers: QueryClient, Theme, Auth, Company, Tooltip
└── main.tsx

supabase/
├── functions/           # Edge functions Deno: calculate-amortization, fetch-bcb-rates
├── migrations/          # SQL versionado (YYYYMMDD_*.sql)
└── config.toml          # project_id = objvdyjnryvllvadglns
```

Alias `@/` aponta para `src/` (configurado em `vite.config.ts` e `tsconfig`).

## Supabase

- **Project ID ativo**: `objvdyjnryvllvadglns` (veja `.env` e `supabase/config.toml`)
- Variáveis lidas em `src/integrations/supabase/client.ts`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- **Tabelas principais**: `companies`, `user_companies`, `profiles`, `debts`, `debt_installments`, `economic_indices`, `index_projections`, `archived_companies`
- **RLS ativo em todas** — dados são isolados por empresa via `user_companies`
- **Edge Functions**:
  - `calculate-amortization` — gera parcelas SAC/PRICE e salva em `debt_installments`
  - `fetch-bcb-rates` — puxa CDI/SELIC/IPCA da API SGS do Banco Central
- `src/integrations/supabase/types.ts` é **gerado** — regenerar via `supabase gen types typescript` se o schema mudar

## Convenções do projeto

### Idioma e localização
- **Todo texto de UI em português do Brasil** (pt-BR). Labels, placeholders, toasts, erros — tudo.
- **Moeda é sempre BRL** com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- **Datas em `date-fns`** com locale pt-BR quando aplicável

### Inputs de moeda (importante)
Existe um padrão obrigatório — veja `docs/CURRENCY_INPUT_PATTERN.md`. Use sempre:
- Hook: `useBRLInput` em `src/hooks/useBRLInput.tsx`
- Componente: `CurrencyInput` em `src/components/ui/currency-input.tsx`

Motivo: formatar durante digitação faz o cursor pular. O padrão formata só no `onBlur` e habilita teclado numérico no mobile. **Não criar inputs de moeda manuais.**

### Autenticação
- Cadastro bloqueado a emails `@o2inc.com.br` (validação em `useAuth.tsx:51`)
- `ProtectedRoute` envolve rotas que exigem sessão
- Sessão persiste em `localStorage`; ao iniciar, se a sessão for inválida (ex: mudou o projeto Supabase), faz `signOut` automaticamente

### Formato Legacy vs Database
O tipo `Debt` (banco) usa `snake_case` e o `LegacyDebt` usa `camelCase`. A conversão vive em `src/hooks/useDebts.tsx` (`convertToLegacyFormat`, `convertLegacyDebt`) e `src/lib/debtUtils.ts` (`normalizeDebtForCalculation`).

Componentes antigos consomem `LegacyDebt`; componentes novos podem consumir o formato do banco direto. **Ao tocar nesses tipos, conferir ambos os caminhos.**

### Multi-empresa
- `CompanyProvider` (em `useCompany.tsx`) mantém a empresa ativa em `localStorage`
- Toda query de dados (`useDebts`, etc.) é `enabled: !!selectedCompany?.id`
- Se uma mutação não tem `selectedCompany`, ela deve falhar com toast amigável (padrão já seguido em `Index.tsx:handleSaveDebt`)

## Cuidados e armadilhas

1. **`useEffect` desativado em `pages/Index.tsx:62-67`** — a inicialização automática de dados econômicos causava loop de 401. Há um comentário explicando. **Não reativar** sem antes estabilizar as refs em `useDataInitialization`.

2. **Modo dev com login automático** — commit `55e154f` introduziu isso. Antes de commitar, verificar se esse bypass está desligado em produção (build).

3. **`MIGRATIONS_LOG.md` pode estar desatualizado** — referencia o project ID antigo `zujkmyfwfhjkixlymgiv`. O projeto atual é `objvdyjnryvllvadglns` (migração feita no commit `23ac182`/`57804e7`). Tratar o log como histórico, não como tarefa ativa.

4. **localStorage tem dados legados** — chave `debts` ainda é lida em `Index.tsx:74` e oferece migração. Não remover sem checar se algum usuário ainda tem dados antigos.

5. **Componentes em `src/components/ui/`** — shadcn/ui. Evitar edição manual; se precisar customizar, idealmente via CLI do shadcn ou copiando para outro arquivo.

6. **Edge Functions em Deno** — usam `import_map` do Supabase, não resolvem imports do node. Ao editar, testar com `supabase functions serve`.

## Git / PRs

- Branch principal: `main` (histórico mostra commits direto em main)
- Mensagens de commit em **português**, seguindo Conventional Commits: `feat:`, `fix:`, `chore:`, `revert:`
- Escopo curto, foco no "porquê"

## Onde procurar

- Cálculo financeiro (SAC, PRICE, CET, TIR): `src/lib/cetCalculator.ts`, `src/lib/irrCalculator.ts`, `supabase/functions/calculate-amortization/`
- Tooltips explicativos reutilizados: `src/lib/tooltips.ts`
- Filtros globais do dashboard: `src/components/GlobalFilters.tsx`
- Cards do dashboard: `DashboardStats`, `NetDebtCard`, `DebtProfileChart`, `OutstandingBalanceChart`
- Tabelas: `AmortizationTable`, `ConsolidatedAmortizationTable`, `PaymentScheduleTable`

## Planejamento CFO V2

Para o plano executivo, checklist e criterios de aceite da evolucao CFO V2, consulte `docs/CFO_DASHBOARD_V2_TASKS.md`.
