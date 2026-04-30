# Avaliação DSH-011 — Drag-and-drop nos widgets do dashboard

Data: 2026-04-30
Agente: Codex

## Decisão

Não adicionar `@dnd-kit` agora.

O MVP atual com botões de mover para cima/baixo atende o fluxo principal do CFO: reorganizar cards com previsibilidade, persistência por empresa e suporte direto a teclado. Drag-and-drop deve ficar como melhoria opcional depois de QA visual do layout atual.

## Motivos

- Acessibilidade: os botões atuais são elementos nativos, têm `aria-label`, foco previsível e não exigem instruções adicionais.
- Simplicidade: o dashboard tem poucos widgets; mover um card por vez é suficiente para a primeira versão customizável.
- Bundle: o build atual já gera um chunk principal grande. Baseline validado em 2026-04-30: `assets/index-DCczRY1x.js` com 1.243,45 kB antes de gzip e 353,91 kB gzip. Adicionar uma biblioteca de ordenação deve exigir ganho claro de usabilidade.
- Risco visual: drag-and-drop em cards densos com gráficos exige estados de arraste, drop target, keyboard sensor e mobile QA. Isso amplia o escopo sem desbloquear a validação CFO.

## Critério para reavaliar

Reavaliar `@dnd-kit` se pelo menos uma destas condições aparecer:

- Dashboard tiver 8+ widgets visíveis e reordenação por botões ficar lenta.
- QA com CFO indicar que reordenar por botões é uma fricção recorrente.
- Houver tempo para implementar drag-and-drop com sensor de teclado, estados visuais de drop e comparação real de bundle antes/depois.

## Verificação

- `package.json` e `package-lock.json` não têm dependência de drag-and-drop hoje.
- `npm run build` passou antes desta avaliação com o baseline acima.
- Nenhuma dependência foi adicionada nesta task.
