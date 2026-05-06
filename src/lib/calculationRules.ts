export enum CalculationRuleKeys {
  CURRENT_OUTSTANDING_BALANCE = "CURRENT_OUTSTANDING_BALANCE",
  CURRENT_PAYMENT = "CURRENT_PAYMENT",
  AVERAGE_REMAINING_TERM = "AVERAGE_REMAINING_TERM",
  AVERAGE_MONTHLY_CET = "AVERAGE_MONTHLY_CET",
  AVERAGE_SPREAD = "AVERAGE_SPREAD",
  PMT_NEXT_30D = "PMT_NEXT_30D",
  PMT_NEXT_90D = "PMT_NEXT_90D",
  PEAK_MONTHLY_PMT_12M = "PEAK_MONTHLY_PMT_12M",
  TOP_CONCENTRATION_BANK = "TOP_CONCENTRATION_BANK",
  GUARANTEE_COVERAGE = "GUARANTEE_COVERAGE",
  DEBT_PROFILE = "DEBT_PROFILE",
  OUTSTANDING_BALANCE = "OUTSTANDING_BALANCE",
  BANK_COMPARISON = "BANK_COMPARISON",
}

export interface CalculationRule {
  title: string;
  description: string;
  pseudocode: string;
}

export const CALCULATION_RULES: Record<CalculationRuleKeys, CalculationRule> = {
  [CalculationRuleKeys.CURRENT_OUTSTANDING_BALANCE]: {
    title: "Saldo Devedor Atual",
    description: "Saldo devedor total dos contratos filtrados na data de hoje.",
    pseudocode: `Para cada contrato:
  Se houver parcelas calculadas:
    saldo = remaining_balance da próxima parcela com vencimento ≥ hoje
  Senão (fallback analítico):
    prazoTotal = meses entre releaseDate e dueDate
    decorridos = max(0, meses entre releaseDate e hoje)
    taxaMensal = cadastro mensal ou (1 + anual)^(1/12) − 1

    Se SAC:
      amortização = financiado / prazoTotal
      saldo = max(0, financiado − amortização × decorridos)
    Se PRICE:
      saldo = max(0, financiado × (1+i)^decorridos − PMT × ((1+i)^decorridos − 1)/i)

Soma os saldos de todos os contratos.`,
  },
  [CalculationRuleKeys.CURRENT_PAYMENT]: {
    title: "Parcela Corrente (PMT)",
    description: "Soma das próximas parcelas mensais a vencer dos contratos filtrados. Para PRICE pós-fixado, a PMT é recalculada a cada período — não é constante.",
    pseudocode: `Para cada contrato:
  Se houver parcelas reais:
    pmt = total_amount da próxima parcela com due_date ≥ hoje
  Senão (analítico):
    taxaMensal = getEffectiveMonthlyRate(interest_rate, spread_rate, rate_type)  ← rateUtils.ts
    prazoTotal = meses entre releaseDate e dueDate
    saldoAtual = getAnalyticalOutstanding(debt, hoje)  ← balanceCalculator.ts

    Se PRICE pré-fixado:
      pmt = VP × (i×(1+i)^n) / ((1+i)^n − 1)  ← constante
    Se PRICE pós-fixado:
      PMT recalculada por período com saldo de abertura e taxa efetiva do período (D3)
    Se SAC:
      amortização = financiado / prazoTotal
      pmt = amortização + (saldoAtual × i)

Soma as PMTs.`,
  },
  [CalculationRuleKeys.AVERAGE_REMAINING_TERM]: {
    title: "Prazo Médio Restante",
    description: "Tempo médio até a quitação ponderado pelo saldo devedor atual.",
    pseudocode: `Para cada contrato ativo:
  prazoTotal = meses entre releaseDate e dueDate
  decorridos = max(0, meses entre releaseDate e hoje)
  restante = max(0, prazoTotal − decorridos)
  saldo = saldo devedor atual do contrato

  acumulador += restante × saldo
  pesoTotal += saldo

Média = acumulador / pesoTotal`,
  },
  [CalculationRuleKeys.AVERAGE_MONTHLY_CET]: {
    title: "CET Média Mensal",
    description: "Custo Efetivo Total ponderado pelo saldo devedor atual. Lê cet_monthly_rate persistido pela Edge Function; fallback para taxa cadastrada quando cet_status ≠ 'calculado'.",
    pseudocode: `Para cada contrato:
  Se cet_status = 'calculado':
    cet = cet_monthly_rate (persistido pela Edge Function)
  Senão (pendente ou não convergiu):
    cet = taxa mensal efetiva do cadastro  ← rotulado como estimativa
    contratos com cet_status = 'nao_convergiu' exibem "—" na UI

  Pondera pelo saldo devedor atual do contrato (D4: não pelo valor financiado)

CET média mensal = Σ(CET_mensal × SaldoAtual) / Σ(SaldoAtual)`,
  },
  [CalculationRuleKeys.AVERAGE_SPREAD]: {
    title: "Spread Médio sobre CDI",
    description: "Diferença entre a CET anual média da carteira e a taxa CDI mais recente do BCB.",
    pseudocode: `CET_Anual_Média = (1 + CET_Mensal_Média/100)^12 − 1
CDI_Atual = último valor do índice econômico CDI (BCB)

Spread = CET_Anual_Média − CDI_Atual`,
  },
  [CalculationRuleKeys.PMT_NEXT_30D]: {
    title: "PMT 30 dias",
    description: "Soma das parcelas reais com vencimento nos próximos 30 dias corridos.",
    pseudocode: `dataLimite = hoje + 30 dias

Para cada contrato filtrado:
  Para cada parcela real:
    Se due_date ≥ hoje E due_date ≤ dataLimite:
      acumula total_amount

Retorna o acumulado.`,
  },
  [CalculationRuleKeys.PMT_NEXT_90D]: {
    title: "PMT 90 dias",
    description: "Soma das parcelas reais com vencimento nos próximos 90 dias corridos.",
    pseudocode: `dataLimite = hoje + 90 dias

Para cada contrato filtrado:
  Para cada parcela real:
    Se due_date ≥ hoje E due_date ≤ dataLimite:
      acumula total_amount

Retorna o acumulado.`,
  },
  [CalculationRuleKeys.PEAK_MONTHLY_PMT_12M]: {
    title: "Pico Mensal de PMT (12m)",
    description: "Mês com maior soma de parcelas nos próximos 12 meses.",
    pseudocode: `dataLimite = hoje + 365 dias

Para cada contrato filtrado:
  Para cada parcela real:
    Se due_date ≥ hoje E due_date ≤ dataLimite:
      bucket[ano-mês] += total_amount

Retorna o bucket com maior valor e seu mês.`,
  },
  [CalculationRuleKeys.TOP_CONCENTRATION_BANK]: {
    title: "Concentração por Banco",
    description: "Participação percentual do maior credor no saldo devedor total.",
    pseudocode: `Para cada contrato:
  saldoBanco[bank] += saldoDevedorAtual

saldoTotal = Σ saldoBanco
maiorBanco = max(saldoBanco)

share = maiorBanco / saldoTotal`,
  },
  [CalculationRuleKeys.GUARANTEE_COVERAGE]: {
    title: "Cobertura de Garantias",
    description: "Relação entre o valor total de garantias cadastradas e o saldo devedor.",
    pseudocode: `garantiasTotais = Σ valor das garantias vinculadas
saldoTotal = saldo devedor atual da carteira

coveragePercentage = (garantiasTotais / saldoTotal) × 100
coverageRatio = garantiasTotais / saldoTotal

Se ratio < 1: exibe alerta "Gap"`,
  },
  [CalculationRuleKeys.DEBT_PROFILE]: {
    title: "Perfil da Dívida",
    description: "Distribuição percentual de amortização em curto (≤12 meses) e longo prazo por banco.",
    pseudocode: `baseDate = hoje (ou mês customizado)
limite12m = baseDate + 12 meses

Para cada banco:
  Para cada contrato do banco:
    Se houver parcelas reais:
      shortTerm += principal_amount das parcelas com due_date entre baseDate e limite12m
      longTerm += principal_amount das parcelas com due_date > limite12m
    Senão (fallback analítico):
      Simula cronograma SAC/PRICE inteiro e acumula principal no mesmo critério

    Se amortização acumulada < saldo devedor atual:
      missing = saldoAtual − amortizaçãoAcumulada
      Se dueDate do contrato < limite12m: shortTerm += missing
      Senão: longTerm += missing

  total = shortTerm + longTerm
  shortTerm% = total > 0 ? shortTerm / total : 0
  longTerm% = total > 0 ? longTerm / total : 0`,
  },
  [CalculationRuleKeys.OUTSTANDING_BALANCE]: {
    title: "Saldo Devedor por Banco",
    description: "Evolução mensal do saldo devedor e PMT por credor, com projeção de caixa liberado.",
    pseudocode: `Para cada mês entre min(releaseDate) e max(dueDate):
  Para cada banco:
    saldoBanco = Σ remaining_balance da última parcela até o mês
                 (ou financedAmount se não houver parcelas)
    pmtBanco = Σ total_amount das parcelas daquele mês

  totalPMT[mês] = Σ pmtBanco
  totalSaldo[mês] = Σ saldoBanco

Caixa liberado (opcional):
  pmtHoje = totalPMT[mês corrente]
  cashFreed[m] = max(0, pmtHoje − totalPMT[m])

KPIs do header usam fórmula analítica idêntica ao Saldo Devedor Atual.`,
  },
  [CalculationRuleKeys.BANK_COMPARISON]: {
    title: "Comparativo por Banco",
    description: "Comparação de valor financiado/saldo, juros e CET médio ponderado por instituição.",
    pseudocode: `Modo "Total":
  principal = financedAmount
  juros = Σ interest_amount das parcelas reais
          ou aproximação: VP × taxaMensal × prazo × 0.5

Modo "Atual":
  principal = remaining_balance da 1ª parcela futura
  juros = Σ interest_amount apenas das parcelas com due_date ≥ hoje

CET médio por banco:
  avgCET = Σ(cet_annual_rate × financedAmount) / Σ(financedAmount)
  (apenas contratos que possuem cet_annual_rate cadastrado)

Agrupa tudo por bank e ordena pelo totalAmount decrescente.`,
  },
};
