# _obsolete — Componentes descontinuados

Arquivos aqui **não estão em uso** em nenhuma rota ou componente ativo. Não importar em código novo.

## Por que existem aqui

Foram preservados por histórico. O git guarda o contexto completo — se precisar entender uma decisão passada, use `git log --follow` no arquivo original.

## Arquivos

### CfoDashboardV2.tsx

Experimento de dashboard executivo paralelo ao principal. Desligado em commit `2ccc46e` (`chore(ui): desabilitar aba CFO V2 no dashboard`). Decisão documentada em `docs/MAIN_DASHBOARD_CFO_REVIEW.md`: a evolução deve acontecer sobre o dashboard principal existente, não em uma experiência paralela.

- 0 importações no código ativo (confirmado em 2026-04-27).
- Os tipos `CfoExecutiveMetrics` e `generateCfoAlerts` que seriam consumidos por ele vivem em `src/lib/cfoAlerts.ts` e continuam ativos para uso pelo Epic 1 (`useDashboardMetrics`).

### NetDebtCard.tsx

Componente que retornava `null` desde sua criação — calculava `netDebt` mas não renderizava nada. Os cálculos de saldo analítico que continham foram absorvidos por `src/lib/dashboardMetrics.ts` (DSH-002, Epic 1).

- 0 importações no código ativo (confirmado em 2026-04-27).

## Posso deletar esses arquivos?

Sim. Qualquer momento após esta data é seguro.
