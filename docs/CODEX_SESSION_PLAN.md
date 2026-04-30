# Plano da sessão Codex - 2026-04-30

## Premissas

- Branch de trabalho: `feat/codex-session-2026-04-30`.
- A worktree já tinha alterações não relacionadas antes desta sessão (`index.html`, `src/hooks/useAuth.tsx`, `src/pages/Index.tsx`, `public/og-image.png`, `src/components/ChangePasswordDialog.tsx`, `graphify-out/`, `supabase/.temp/`). Elas não entram nos commits desta sessão.
- A validação automatizada disponível é `npm run build`; `npm run lint` tem débitos conhecidos e só será tratado em tarefa própria.
- Parcelas da empresa demo não serão inseridas por migration; precisam ser geradas acessando cada contrato pelo app ou chamando manualmente a edge function `calculate-amortization`.

## Tarefas desta sessão

- [x] SEED-DEMO — Concluído. Migration SQL idempotente criada para "Empresa Demo O2"; parcelas não são inseridas pela migration e precisam ser geradas acessando cada contrato pelo app ou chamando manualmente a edge function `calculate-amortization`.
- [x] DSH-005 — Concluído. `DashboardStats` agora renderiza até 5 pontos de atenção determinísticos via `generateCfoAlerts`, com evidência numérica e links para widgets/áreas já disponíveis; build passou após a alteração.
- [x] DSH-006 — Concluído. O dashboard principal mostra valor total de garantias, cobertura sobre saldo, contratos sem garantia e top 3 gaps por banco usando `metrics.guaranteeCoverage`; build passou após a alteração.

## Tarefas puladas nesta sessão

- [ ] DSH-007 a DSH-010 — Cards colapsáveis, ocultáveis e reordenáveis. Motivo: mudança estrutural de layout e persistência por empresa; deve vir depois do Epic 2 fechado.
- [ ] DSH-011 — Avaliação de drag-and-drop. Motivo: depende do MVP de reordenação simples.
- [ ] DSH-012 a DSH-014 — Drill-downs, presets e ranking acionável. Motivo: escopo funcional maior; DSH-005 pode documentar destinos básicos sem implementar fluxo completo.
- [ ] DSH-015 — Code splitting. Motivo: otimização posterior, precisa comparação de bundle e não desbloqueia QA CFO.
- [ ] DSH-016 — Lint bloqueante. Motivo: tarefa separada obrigatória; não deve ser misturada com feature de dashboard.
- [ ] DSH-017 — Matriz de QA manual. Motivo: ideal após dados demo e Epic 2; nesta sessão será registrada pendência em `AGENT_SYNC.md`.

## Verificação planejada

- Após cada tarefa: atualizar este plano no mesmo commit da tarefa.
- Antes do encerramento: rodar `npm run build`.
- Se a build falhar por mudança desta sessão: documentar em `docs/AGENT_SYNC.md` e reverter apenas o commit causador.

## Extensão solicitada pelo usuário

- [x] DSH-007 — Concluído. Registry de widgets formalizado com `defaultOrder`, `canCollapse`, `canHide` e `settingsSchema`; `useDashboardWidgets` respeita `defaultOrder` para layout padrão e novos widgets; `DashboardWidgetShell` respeita permissões de colapsar/ocultar. Build passou após a alteração.
- [x] DSH-008 — Concluído por verificação. O código atual já permite colapsar/expandir e ocultar cards, com `aria-label`, botões de 40px, estado persistido por usuário+empresa e reativação de widgets ocultos. Sem mudança de código necessária nesta tarefa.
