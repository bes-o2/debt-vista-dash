# Carência: Implementação Fase 3A e Planejamento Fase 3B

## Status Atual (Fase 3A - Capitalizada)

A feature de **carência capitalizada** foi implementada na Fase 3A (commit com tag de fase 3).

### O que foi implementado

- Campo `grace_period_type` na tabela `debts` (valores: `'none'`, `'capitalized'`)
- UI no DebtForm: seletor RadioGroup com opções "Nenhuma" e "Capitalizada"
- Quando `gracePeriodType === "capitalized"`:
  - Obriga preenchimento de `indexerStartDate` (data de desembolso)
  - Valida que essa data é anterior a `firstDueDate`
  - Mostra label apropriado na UI
- Motor de cálculo na edge function `calculate-amortization`:
  - Acumula indexador + spread mês a mês entre `indexerStartDate` e `firstDueDate`
  - Principal cresce durante a carência
  - Amortização começa no 1º vencimento sobre o principal capitalizado
  - SAC: amortização fixa é `openingBalance / totalMonths` (não `financedAmount`)
  - PRICE: PMT é recalculado com base no principal maior

### Limitação conhecida

O spread é composto por sub-período mensal cheio na carência. Um último sub-período parcial (quando a carência não fecha em meses inteiros) pode resultar em leve sobre-acúmulo do spread. Para carências que fecham em meses inteiros, o cálculo é exato.

### CET

O CET passa a começar na data de desembolso (`indexerStartDate`) quando há carência capitalizada, refletindo que o fluxo de caixa inicia no desembolso, não no primeiro vencimento.

---

## Fase 3B (Futuro) - Carência com Juros Pagos (Interest-Only)

### Ideia

Suportar um segundo tipo de carência: **carência com juros pagos durante a carência** (interesse apenas).

Durante a carência:
- Principal permanece intacto
- Juros (indexador + spread) são pagos periodicamente em parcelas menores (antes do 1º vencimento de amortização)
- Amortização começa normalmente no 1º vencimento

Exemplo:
- Desembolso: 01/01/2025 (R$ 100.000)
- Data de juros durante a carência: 01/02/2025, 01/03/2025, ..., 01/06/2025
- 1º vencimento de amortização: 01/07/2025
- Parcelas de juros (6 meses): ~(100.000 × taxa mensal)
- Parcelas de amortização (a partir de 01/07): SAC ou PRICE sobre R$ 100.000

### Impacto Técnico

1. **Motor (`calculate-amortization`)**
   - Gerar parcelas interest-only entre `indexerStartDate` e `firstDueDate`
   - Amortização = 0 para essas parcelas
   - Interest = principal × taxa efetiva mensal
   - Estrutura do cronograma muda: parcelas extras antes de `firstDueDate`

2. **DebtForm**
   - Adicionar terceira opção ao seletor de carência: "Com Juros Mensais"
   - Quando selecionada:
     - Mostrar frequência de pagamento dos juros (e.g., mensal, bimestral)
     - Obriga `indexerStartDate` anterior a `firstDueDate`

3. **Spread em sub-períodos**
   - Como em Fase 3A, aplicar limitação: spread composto mensalmente cheio

4. **Dados persistidos**
   - `grace_period_type` passa a ser `'none'`, `'capitalized'`, ou `'interest_only'`
   - Possível novo campo: `grace_period_frequency` (e.g., `'monthly'`)

### Complexidade

Essa implementação muda a **estrutura do cronograma** — adiciona parcelas fora da sequência esperada (antes de `firstDueDate`). Exige:
- Renumerar parcelas corretamente
- Ajustar `rate_refs` para as parcelas de juros
- Testar conversão para/de LegacyDebt
- Revalidar CET (fluxo inclui parcelas interest-only)

Por isso ficou para Fase 3B.

---

## Próximos Passos

1. Validar Fase 3A em produção (carência capitalizada)
2. Coletar feedback de usuários
3. Avaliar impacto de complexidade em Fase 3B
4. Implementar Fase 3B se validado pelo negócio

