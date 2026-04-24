# /handoff — Encerramento de sessão e sync entre agentes

Você está encerrando uma sessão de trabalho no projeto **debt-vista-dash**. Execute os passos abaixo em sequência.

## Passo 1 — Leia o estado atual

Leia `docs/AGENT_SYNC.md` para entender o que o agente anterior deixou.

## Passo 2 — Monte o resumo da sessão atual

Com base em tudo que foi feito nesta conversa, preencha as seções abaixo. Seja objetivo — o próximo agente (Claude Code ou Codex) vai ler isso antes de qualquer outra coisa.

## Passo 3 — Escreva em `docs/AGENT_SYNC.md`

Substitua o conteúdo existente com o seguinte template preenchido:

```markdown
# Agent Sync — debt-vista-dash

> Leia este arquivo antes de qualquer tarefa. Ele é o estado compartilhado entre Claude Code e Codex.

## Última sessão

- **Data:** <data de hoje>
- **Agente:** <Claude Code | Codex>
- **Resumo:** <2-3 frases do que foi feito>

## O que está funcionando

<lista bullet do que foi implementado e validado — seja específico com arquivos e comportamentos>

## Em andamento / incompleto

<lista bullet do que ficou pela metade, com arquivo e linha se possível>

## Problemas conhecidos

<bugs confirmados, comportamentos incorretos, itens que precisam de atenção>

## Decisões tomadas

<decisões de produto, arquitetura ou convenção que foram acordadas — com contexto do porquê>

## Próximo agente deve fazer

<lista priorizada do que vem a seguir, do mais urgente para o menos urgente>

## Não tocar

<lista de coisas que NÃO devem ser alteradas, com motivo>

## Contexto rápido para Codex

<3-5 regras do projeto que o Codex sempre esquece ou costuma violar — com exemplo prático>
```

## Passo 4 — Git: commit e push

Depois de escrever o arquivo, execute:

```bash
git add docs/AGENT_SYNC.md
git add -A  # somente se houver código modificado que deve ser commitado
```

Pergunte ao usuário se quer commitar só o sync ou também o código modificado. Se quiser código também, monte uma mensagem de commit adequada seguindo Conventional Commits em português.

Depois faça push:

```bash
git push origin main
```

## Passo 5 — Confirme

Informe ao usuário:
- O que foi documentado
- Quais arquivos foram commitados
- Se o push teve sucesso
- O que o próximo agente vai encontrar quando abrir o projeto
