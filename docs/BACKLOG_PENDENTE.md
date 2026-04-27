# Backlog pendente — retomar aqui

> Atualizado em 2026-04-27. Retomar lendo este arquivo e o plano em `MAIN_DASHBOARD_CFO_REVIEW.md`.

---

## Epic 1 — concluído (DSH-001/002/003)

- [x] `docs/DASHBOARD_METRICS_INVENTORY.md` criado
- [x] `src/lib/dashboardMetrics.ts` criado (lib pura, sem React)
- [x] `src/hooks/useDashboardMetrics.tsx` criado
- [x] `src/components/DashboardStats.tsx` migrado para o hook
- [x] `src/components/GlobalFilters.tsx` com toggle Vigência/Vencimento
- [x] `src/pages/Index.tsx` com `globalPeriodMode` + persistência por empresa
- [x] `src/components/CashFlowAnalysis.tsx` aceita `periodMode` + range global
- [x] `src/components/_obsolete/` criado com `CfoDashboardV2`, `NetDebtCard` e `README`
- [x] Build passa (`npm run build`)
- [ ] **COMMIT pendente** — todos os arquivos acima ainda não foram commitados

## Próximos passos obrigatórios (antes de continuar)

### 1. QA manual de paridade numérica (DSH-002)

Abrir o app no browser com dados reais e confirmar que `DashboardStats` mostra os mesmos valores de antes da migração:
- Empresa vazia → zero em tudo, sem crash
- Empresa com 1 contrato → saldo, PMT, CET, prazo médio batem
- Empresa real → delta R$ 0,00 em todos os KPIs visíveis

### 2. QA do toggle de período (DSH-003)

- Toggle aparece no GlobalFilters abaixo dos date pickers
- Mudar para "Vencimento de parcelas" e confirmar que contratos sem parcela no range somem dos KPIs
- Trocar de empresa → modo recarrega do localStorage daquela empresa (não vaza)
- Mobile 390px → toggle não quebra layout

### 3. Commit das mudanças

```bash
git add src/lib/dashboardMetrics.ts \
        src/hooks/useDashboardMetrics.tsx \
        src/components/DashboardStats.tsx \
        src/components/GlobalFilters.tsx \
        src/pages/Index.tsx \
        src/components/CashFlowAnalysis.tsx \
        src/components/_obsolete/ \
        docs/DASHBOARD_METRICS_INVENTORY.md \
        docs/BACKLOG_PENDENTE.md
git commit -m "feat(dashboard): centralizar métricas em useDashboardMetrics e toggle de período (Epic 1)"
```

---

## Epic 2 — próxima entrega (DSH-004 a DSH-006)

Ver detalhes em `docs/MAIN_DASHBOARD_CFO_REVIEW.md`.

### DSH-004 — Bloco "Resumo executivo" ✅ ENTREGUE (2026-04-27)

- `DashboardStats.tsx` ampliado com duas novas seções:
  - "Fluxo de caixa próximo": PMT 30d, PMT 90d, Pico mensal 12m (com alerta amber se pico > 1,5× PMT atual)
  - "Concentração e garantias": maior credor (com badge de risco por threshold), contratos sem garantia (badge verde/amber)
- Consome `useDashboardMetrics` (sem nova query)
- Estados vazio/loading tratados; texto pt-BR; moeda BRL
- Build passou, sem regressão nos outros 4 widgets

### DSH-005 — Pontos de atenção determinísticos

- Usa `generateCfoAlerts` em `src/lib/cfoAlerts.ts` (já existe, já recebe `DashboardMetrics`)
- 3 a 5 alertas com evidência numérica + link de drill-down

### DSH-006 — Garantias no dashboard principal

- `useDashboardMetrics` já retorna `guaranteeCoverage` (passthrough de `useDebtGuarantees`)
- Só montar a UI: total, cobertura, contratos sem garantia, gap por banco

### Migração dos 4 widgets restantes (débito técnico do Epic 1)

- `OutstandingBalanceChart`, `DebtProfileChart`, `DebtChart` ainda duplicam saldo analítico
- Migrar para `useDashboardMetrics` — elimina as últimas duplicatas
- Fazer junto com DSH-004 para não regredir

---

## Epic 3 — Cards colapsáveis (DSH-007 a DSH-010)

- `src/components/dashboard/DashboardWidgetShell.tsx` e `dashboardWidgetTypes.ts` já existem (untracked)
- Registrar widgets, implementar colapsar/expandir e reordenar com botões
- Ver detalhes em `MAIN_DASHBOARD_CFO_REVIEW.md`

---

## Lint pré-existente (DSH-016)

8 erros e 14 warnings já existentes antes deste Epic. Corrigir em PR separado.
```bash
npm run lint
```
