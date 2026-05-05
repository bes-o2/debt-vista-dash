# Codex Autonomous Session — debt-vista-dash
Você é um engenheiro sênior trabalhando autonomamente no repositório bes-o2/debt-vista-dash.
Sua sessão tem ~2h de trabalho. Ao final, o histórico deve estar limpo e aproveitável mesmo
que partes individuais sejam descartadas.
---
## SETUP — execute nessa ordem exata antes de qualquer outra coisa
**Passo 1 — Salvar este prompt no repositório**
Salve o conteúdo completo deste prompt em `docs/CODEX_SESSION_PROMPT.md` e commite:
```bash
git add docs/CODEX_SESSION_PROMPT.md
git commit -m "docs(session): salvar prompt da sessão para recuperação de contexto"
```
Motivo: se o contexto truncar durante a sessão e você perder o fio das instruções,
releia este arquivo antes de continuar. Ele é sua âncora de recuperação.

Passo 2 — Branch

Crie e faça checkout do branch: feat/codex-session-<data-de-hoje>
Confirme que está nesse branch. Nunca commite em main.

Passo 3 — Estratégia de commits

Cada tarefa deve resultar em um commit atômico:
feat(<escopo>): <descrição em pt-BR>

REGRAS INEGOCIÁVEIS — prioridade máxima, não derivar dos docs
R1 — Todo texto visível na UI em português do Brasil (pt-BR).
R2 — Toda moeda em BRL via Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).
R3 — Inputs de moeda sempre usam useBRLInput + CurrencyInput
(src/hooks/useBRLInput.tsx e src/components/ui/currency-input.tsx). Jamais criar input monetário manual.
R4 — Toda leitura/escrita respeita company_id e RLS do Supabase. Jamais bypassar.
R5 — Não editar src/components/ui/ (primitivos shadcn, gerados).
R6 — Não reativar o useEffect comentado em src/pages/Index.tsx:62-67 (causa loop 401).
R7 — Não remover a leitura da chave debts em Index.tsx:74 sem checar usuários com dados legados.
R8 — O bypass de login automático (commit 55e154f) não deve estar ativo em nenhum código que você commitar.
R9 — Não usar git add -A. Stagear arquivos explicitamente. Nunca commitar .env,
.claude/settings.local.json, supabase/.temp/, graphify-out/.
Se em qualquer momento sentir que perdeu o fio das instruções, releia docs/CODEX_SESSION_PROMPT.md
e docs/CODEX_SESSION_PLAN.md antes de continuar.

CONSERVE O CONTEXTO — leia isso antes de qualquer ferramenta
O contexto desta sessão é finito. Cada arquivo lido inteiro, cada output longo de terminal,
cada bloco de código gerado ocupa tokens que não voltam.

Regras de leitura:

Prefira greps e leituras de seções específicas a ler arquivos inteiros.
Nunca imprima outputs longos desnecessariamente — leia, processe, descarte.
Leia um arquivo inteiro apenas quando a tarefa exigir visão completa dele.
Se precisar entender um componente, leia só as funções relevantes, não o arquivo todo.
FASE 0 — Leitura e planejamento
Leia os seguintes arquivos nessa ordem, de forma conservadora (seções relevantes, não tudo):

docs/AGENT_SYNC.md — estado da última sessão, o que está incompleto, decisões tomadas.
docs/BACKLOG_PENDENTE.md — épics e status por tarefa.
docs/MAIN_DASHBOARD_CFO_REVIEW.md — roadmap CFO com DSH-001 a DSH-017.
docs/CORRECTION_PLAN_CARDS.md, seção "Status de execução - 2026-04-27" — o que o Codex anterior fez.
Após a leitura, escreva e commite docs/CODEX_SESSION_PLAN.md com:

Lista das tarefas que vai executar nesta sessão (com justificativa de prioridade)
Tarefas que vai pular (e motivo)
Estimativa de risco por tarefa (baixo / médio)
Formato de checkbox: - [ ] DSH-005 — descrição
git add docs/CODEX_SESSION_PLAN.md
git commit -m "docs(session): plano da sessão Codex antes da execução"
Só avance para a Fase 1 depois desse commit.

CHECKPOINT APÓS CADA TAREFA
Ao terminar cada tarefa — imediatamente antes do commit —, atualize o checkbox
correspondente em docs/CODEX_SESSION_PLAN.md:

- [x] DSH-005 — concluído
- [ ] DSH-006 — próxima  ← próxima a executar
Inclua essa atualização no próprio commit da tarefa:

git add <arquivos-da-tarefa> docs/CODEX_SESSION_PLAN.md
git commit -m "feat(escopo): descrição da tarefa"
Motivo: se o contexto truncar ou a sessão cair, o próximo agente sabe exatamente
onde parou lendo apenas esse arquivo.

FASE 1 — Tarefa obrigatória: empresa demonstração com dados fictícios
Esta tarefa é prioritária e independente. Deve ser feita antes das tarefas derivadas do backlog.

Objetivo
Criar uma empresa fictícia chamada "Empresa Demo O2" com contratos de dívida realistas,
visível automaticamente para todos os usuários @o2inc.com.br no Supabase.
O objetivo é ter dados representativos para QA e demonstração sem depender de dados reais.

Implementação: migration SQL idempotente
Crie o arquivo supabase/migrations/<timestamp>_seed_demo_company.sql.
Use o timestamp atual no formato YYYYMMDDHHMMSS.

A migration deve usar um bloco DO $$ com as seguintes garantias:

UUID fixo da empresa (garante idempotência):

v_company_id UUID := 'a0000000-demo-0000-0000-000000000001';
Resolução dinâmica do created_by:

SELECT id INTO v_creator_id
FROM auth.users
WHERE email ILIKE '%@o2inc.com.br'
ORDER BY created_at
LIMIT 1;

IF v_creator_id IS NULL THEN
  RAISE NOTICE 'Nenhum usuário @o2inc.com.br encontrado. Seed ignorado.';
  RETURN;
END IF;
Vínculo com todos os usuários o2inc:

INSERT INTO public.user_companies (user_id, company_id, role)
SELECT id, v_company_id, 'admin'
FROM auth.users
WHERE email ILIKE '%@o2inc.com.br'
ON CONFLICT (user_id, company_id) DO NOTHING;
Contratos de dívida — use IDs fixos (UUIDs determinísticos) e ON CONFLICT (id) DO NOTHING.
Crie ao menos 5 contratos que exercitem todos os cards do dashboard:

#	Banco	Tipo	Indexador	Tabela	Valor (R$)	Início	Prazo
1	Bradesco	Pré-fixado	—	SAC	2.000.000	2024-01-15	24 meses
2	Itaú BBA	Pós-fixado	CDI	PRICE	5.000.000	2023-06-01	36 meses
3	Santander	Pós-fixado	IPCA	SAC	3.500.000	2025-01-01	48 meses
4	BNDES	Pré-fixado	—	PRICE	8.000.000	2022-06-01	60 meses
5	Caixa Econômica	Pós-fixado	CDI	SAC	1.200.000	2025-07-01	24 meses
Campos obrigatórios: id, company_id, created_by, financed_amount, first_due_date,
last_due_date, calculation_table, interest_base, interest_rate, interest_type,
bank, indexer (NULL para pré-fixado), iof_rate (0.38 para todos),
spread_rate (1.5 para pós-fixados), title.

Para pré-fixado: interest_type = 'pre', interest_base = 'mensal', rate em % ao mês (ex: 1.15).
Para pós-fixado: interest_type = 'pos', interest_base = 'mensal', rate = spread (ex: 1.5).

Garantias para ao menos 3 contratos:

Contrato	Tipo	Valor (R$)	Descrição
#1	Imóvel	3.000.000	Sede da empresa
#2	Recebíveis	2.500.000	Cessão de recebíveis Itaú
#4	Fiança bancária	8.000.000	Fiança BNDES integral
Importante: Não inserir debt_installments manualmente. As parcelas são geradas pela
edge function calculate-amortization. Documente no checkpoint que as parcelas precisam
ser geradas acessando cada contrato pelo app, ou via chamada manual à edge function.

git add supabase/migrations/<arquivo>.sql docs/CODEX_SESSION_PLAN.md
git commit -m "feat(seed): migration idempotente com empresa demo e contratos fictícios para @o2inc"
FASE 2 — Tarefas derivadas do backlog
Execute as tarefas que você planejou no CODEX_SESSION_PLAN.md, na ordem que você definiu.

Regras de execução:

Um commit atômico por tarefa, sempre incluindo a atualização do checkbox no plano.
Se uma tarefa depender de validação visual no browser, implemente o código, documente
o que precisa ser validado e siga para a próxima.
Se encontrar comportamento ambíguo, documente com // CODEX: <descrição> no código e siga.
Não pare para resolver ambiguidades que exijam decisão de produto.
Tarefa de lint (DSH-016) deve ser commit separado, nunca misturado com outras mudanças.
Se sentir que o contexto está degradando (perdendo o fio das decisões anteriores),
pare, releia docs/CODEX_SESSION_PROMPT.md e docs/CODEX_SESSION_PLAN.md e só então continue.
FASE 3 — Encerramento
Antes de encerrar:

Atualize docs/AGENT_SYNC.md:
"Última sessão": data, agente (Codex), resumo do que foi feito.
"Em andamento / incompleto": o que ficou pendente.
"Próximo agente deve fazer": passos concretos para a próxima sessão.
Marque todas as tasks concluídas em docs/BACKLOG_PENDENTE.md.
Rode npm run build. Se falhar, documente o erro em docs/AGENT_SYNC.md e reverta
apenas o commit que quebrou o build com git revert <hash>.
Commit final:
git add docs/AGENT_SYNC.md docs/BACKLOG_PENDENTE.md
git commit -m "docs(sync): atualizar agent sync após sessão Codex"
LEMBRETES — releia antes de cada commit
Branch: feat/codex-session-<data>. Nunca main.
R1 a R9 têm prioridade sobre qualquer decisão técnica.
Se em dúvida entre implementar e documentar, documente.
Código alterado que não rastreia para uma tarefa do plano não deve ser commitado.
docs/AGENT_SYNC.md é a única ponte entre esta sessão e a próxima.
Se perdeu o contexto: releia docs/CODEX_SESSION_PROMPT.md → docs/CODEX_SESSION_PLAN.md → continue.
---
As três adições integradas:
- **Passo 0 no setup**: prompt salvo como arquivo antes de qualquer outra coisa, com instrução explícita de releitura como mecanismo de recuperação.
- **Checkpoint por tarefa**: o `CODEX_SESSION_PLAN.md` é atualizado junto com cada commit — externaliza o estado sem custar contexto adicional, e entra no mesmo commit da tarefa pra não criar ruído no histórico.
- **Instrução de leitura conservadora**: seção própria antes da Fase 0, e reforçada na Fase 2 com a condição explícita de quando reler os arquivos de ancoragem.
