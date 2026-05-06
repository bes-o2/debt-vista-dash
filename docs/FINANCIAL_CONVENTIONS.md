# Convenções Financeiras — debt-vista-dash

> Consolidação das decisões técnicas aprovadas no CFO Decision Log (2026-05).
> Para raciocínio completo por decisão, ver `docs/CFO_DECISION_LOG.md`.

---

## Saldo devedor (D1)

- `principal_balance` no banco é sempre **saldo de abertura** (antes do pagamento da parcela).
- KPI "Saldo Devedor Atual" = `principal_balance` da **próxima parcela futura** (`due_date >= hoje`).
- Contrato quitado (sem parcela futura) = saldo 0.
- Funções canônicas: `getAnalyticalOutstanding` e `getAnalyticalCurrentPMT` em `src/lib/balanceCalculator.ts`.

## Spread (D2)

- `spread_rate` no banco é sempre **anual (a.a.)**.
- Conversão obrigatória via `src/lib/rateUtils.ts`:
  - `annualToMonthly(rate)` → `(1 + rate/100)^(1/12) − 1`
  - `getEffectiveMonthlyRate(interestRate, spreadRate, rateType)` → taxa mensal efetiva decimal
- Base de dias: **252 dias úteis** (padrão brasileiro) para conversões diárias.

## PRICE pós-fixado (D3)

- PMT **não é constante**. A cada período, recalcula-se com saldo de abertura, taxa efetiva resolvida e prazo remanescente (`nRestante = N − i + 1`).
- Última parcela quita o saldo.
- UI sinaliza com badge "PMT variável" em contratos PRICE + indexador pós-fixado.

## Ponderação do CET médio (D4)

- CET médio ponderado por **saldo devedor atual** (não pelo valor financiado).
- `calculateWeightedAverageCET` em `cetCalculator.ts` está `@deprecated` — usar lógica em `dashboardMetrics.ts`.

## CET — persistência (D5)

- A Edge Function calcula e persiste `cet_monthly_rate` / `cet_annual_rate`.
- O front **lê do banco**, não recalcula.
- `cet_status` enum: `calculado` | `nao_convergiu` | `pendente`.
  - `nao_convergiu` → exibir "—" com tooltip; nunca exibir número arbitrário.
  - `pendente` → exibir "calculando…".

## Período misto realizado/futuro (D9)

- Período que cruza "hoje" usa **projeção base inteira** (decisão conservadora da V1).
- Não há split em trecho realizado + projetado. Reavaliar em V2 do produto.

## Datas e timezone (D14)

- Toda string `YYYY-MM-DD` deve ser parseada com sufixo `T00:00:00Z` para evitar desvio de 1 dia em timezones negativos.
- Válido tanto na Edge Function (Deno) quanto nos componentes de front.
- Correto: `new Date(dateString + 'T00:00:00Z')`
- Incorreto: `new Date('2025-03-31')` sem sufixo.

## Pipeline de parcelas (D15)

- O front **não deleta** `debt_installments` diretamente.
- A Edge Function é a única responsável pelo ciclo delete + insert (idempotente).
- Erros de insert são propagados — a Edge nunca retorna 200 OK com insert incompleto.

## Auditoria de taxa por parcela (D8)

- Contratos pós-fixados têm linhas em `debt_installment_rate_refs` com origem da taxa.
- Campos relevantes: `index_type`, `rate`, `source` (`bcb_realizado` | `projecao_base` | `cenario_temporario`), `source_reference_date`.
- Hook de leitura: `src/hooks/useInstallmentRateRefs.ts`.
