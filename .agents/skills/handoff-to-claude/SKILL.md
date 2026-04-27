---
name: handoff-to-claude
description: Finalize a Codex session so Claude Code can continue safely. Use when the user says to hand off, wrap up, finish a session, sync with Claude, prepare Claude Code, update AGENT_SYNC, or move work from Codex to Claude. Reads and updates docs/AGENT_SYNC.md, summarizes current work, inspects git state, and handles commit/push only with explicit user confirmation.
---

# Handoff to Claude

Use this skill to leave a clean continuation point for Claude Code.

## Workflow

1. Read the shared handoff context:
   - `docs/AGENT_SYNC.md`
   - `CLAUDE.md`
   - `.claude/commands/handoff.md` if present

2. Inspect the current worktree before writing:
   - Run `git status --short`
   - Run focused diffs for files changed during this Codex session
   - Identify unrelated or sensitive changes, especially `.env`, `.claude/settings.local.json`, `supabase/.temp/`, and local tool settings

3. Update `docs/AGENT_SYNC.md` with the current session:
   - Data: use the current date from the environment
   - Agente: `Codex`
   - Resumo: 2-3 concise sentences
   - O que esta funcionando: implemented and verified behavior
   - Em andamento / incompleto: unfinished work with paths and lines when useful
   - Problemas conhecidos: confirmed bugs or risks
   - Decisoes tomadas: product, architecture, or process decisions
   - Proximo agente deve fazer: prioritized next steps
   - Nao tocar: files or decisions Claude should avoid changing
   - Contexto rapido para Claude: 3-5 practical reminders for Claude Code

4. Keep the handoff factual:
   - Do not claim tests passed unless they were run successfully
   - Name commands that were run and their result
   - Distinguish confirmed facts from assumptions
   - Include exact file paths for anything Claude should inspect next

5. Handle git carefully:
   - Do not stage all changes by default
   - Default safe staging target is only `docs/AGENT_SYNC.md`
   - Ask before including code changes, generated files, settings, or secrets
   - Never commit `.env`, local credentials, or temporary Supabase files unless the user explicitly confirms after the risk is stated
   - Commit and push only if the user explicitly asks or confirms

6. Final response:
   - Say what was written to `docs/AGENT_SYNC.md`
   - List what was staged/committed/pushed, or say no git action was taken
   - State what Claude Code should read first and what it should do next

## Recommended `docs/AGENT_SYNC.md` Shape

```markdown
# Agent Sync - debt-vista-dash

> Leia este arquivo antes de qualquer tarefa. Ele e o estado compartilhado entre Claude Code e Codex.

## Ultima sessao

- **Data:** YYYY-MM-DD
- **Agente:** Codex
- **Resumo:** ...

## O que esta funcionando

- ...

## Em andamento / incompleto

- ...

## Problemas conhecidos

- ...

## Decisoes tomadas

- ...

## Proximo agente deve fazer

1. ...

## Nao tocar

- ...

## Contexto rapido para Claude

1. ...
```
