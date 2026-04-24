export type CfoAlertSeverity = "info" | "warning" | "critical";

export type CfoAlertCategory =
  | "concentracao_banco"
  | "concentracao_indexador"
  | "vencimentos_12m"
  | "pmt_mensal_maximo"
  | "cobertura_garantias"
  | "divida_liquida";

export interface CfoAmountByLabel {
  label: string;
  amount: number;
}

export interface CfoMonthlyAmount {
  month: string;
  amount: number;
}

export interface CfoGuaranteeCoverageInput {
  guaranteeValue: number;
  coveredDebtAmount: number;
}

export interface CfoNetDebtInput {
  grossDebtAmount: number;
  cashAndEquivalents: number;
  netDebtAmount?: number;
}

export interface CfoExecutiveMetrics {
  concentrationByBank: CfoAmountByLabel[];
  concentrationByIndexer: CfoAmountByLabel[];
  maturitiesNext12Months: CfoMonthlyAmount[];
  monthlyPmtProjection: CfoMonthlyAmount[];
  guaranteeCoverage: CfoGuaranteeCoverageInput;
  netDebt: CfoNetDebtInput;
}

export interface CfoAlert {
  id: string;
  category: CfoAlertCategory;
  severity: CfoAlertSeverity;
  title: string;
  summary: string;
  evidence: string[];
  recommendation: string;
  score: number;
}

export interface CfoNarrativeCue {
  readyForAi: true;
  language: "pt-BR";
  facts: string[];
  alertIds: string[];
  promptSeed: string;
}

export interface CfoAlertPack {
  alerts: CfoAlert[];
  narrativeCue: CfoNarrativeCue;
}

const BANK_CONCENTRATION_WARNING = 0.35;
const BANK_CONCENTRATION_CRITICAL = 0.55;
const INDEXER_CONCENTRATION_WARNING = 0.60;
const INDEXER_CONCENTRATION_CRITICAL = 0.80;
const MATURITY_12M_WARNING = 0.40;
const MATURITY_12M_CRITICAL = 0.60;
const PMT_PEAK_WARNING = 1.50;
const PMT_PEAK_CRITICAL = 2.00;
const GUARANTEE_COVERAGE_WARNING = 1.00;
const GUARANTEE_COVERAGE_CRITICAL = 0.80;
const NET_DEBT_WARNING = 0.60;
const NET_DEBT_CRITICAL = 0.85;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatCurrency = (value: number): string => currencyFormatter.format(value);

const formatPercent = (value: number): string => percentFormatter.format(value);

const formatRatio = (value: number): string => `${value.toFixed(2)}x`;

const formatMonthLabel = (month?: string): string => {
  if (!month) return "n/d";
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString("pt-BR", { month: "long", year: "2-digit" });
};

const safeNumber = (value: number | undefined | null): number => (Number.isFinite(value ?? NaN) ? Number(value) : 0);

const sumAmounts = (items: CfoAmountByLabel[] | CfoMonthlyAmount[]): number =>
  items.reduce((sum, item) => sum + safeNumber(item.amount), 0);

const topItem = (items: CfoAmountByLabel[] | CfoMonthlyAmount[]) => {
  return items.reduce<{ name: string; amount: number } | null>((top, item) => {
    const amount = safeNumber(item.amount);
    if (!top || amount > top.amount) {
      return { name: "label" in item ? item.label : item.month, amount };
    }
    return top;
  }, null);
};

const severityScore = (severity: CfoAlertSeverity): number => {
  switch (severity) {
    case "critical":
      return 100;
    case "warning":
      return 60;
    default:
      return 20;
  }
};

const buildAlert = (alert: Omit<CfoAlert, "score">): CfoAlert => ({
  ...alert,
  score: severityScore(alert.severity),
});

const buildSeverity = (value: number, warningThreshold: number, criticalThreshold: number, higherIsWorse = true): CfoAlertSeverity => {
  if (higherIsWorse) {
    if (value >= criticalThreshold) return "critical";
    if (value >= warningThreshold) return "warning";
    return "info";
  }

  if (value <= criticalThreshold) return "critical";
  if (value <= warningThreshold) return "warning";
  return "info";
};

const sortMonths = (items: CfoMonthlyAmount[]): CfoMonthlyAmount[] =>
  [...items].sort((a, b) => a.month.localeCompare(b.month));

const buildConcentrationAlert = (
  category: "concentracao_banco" | "concentracao_indexador",
  items: CfoAmountByLabel[],
  warningThreshold: number,
  criticalThreshold: number,
  title: string,
  recommendation: string,
): CfoAlert => {
  const total = sumAmounts(items);
  const top = topItem(items);

  if (!top || total <= 0) {
    return buildAlert({
      id: category,
      category,
      severity: "info",
      title,
      summary: "Sem dados consolidados suficientes para medir a concentração.",
      evidence: ["Nenhum item consolidado informado."],
      recommendation,
    });
  }

  const topShare = top.amount / total;
  const severity = buildSeverity(topShare, warningThreshold, criticalThreshold);

  const topThreeShare = [...items]
    .sort((a, b) => safeNumber(b.amount) - safeNumber(a.amount))
    .slice(0, 3)
    .reduce((sum, item) => sum + safeNumber(item.amount), 0) / total;

  return buildAlert({
    id: category,
    category,
    severity,
    title,
    summary: `${top.name} concentra ${formatPercent(topShare)} do saldo consolidado.`,
    evidence: [
      `Maior posição: ${top.name} com ${formatCurrency(top.amount)}.`,
      `Top 3 posições concentram ${formatPercent(topThreeShare)} do saldo total.`,
    ],
    recommendation,
  });
};

const buildMaturityAlert = (
  maturitiesNext12Months: CfoMonthlyAmount[],
  grossDebtAmount: number,
): CfoAlert => {
  const ordered = sortMonths(maturitiesNext12Months);
  const totalNext12Months = sumAmounts(ordered);
  const top = topItem(ordered);
  const shareOfGrossDebt = grossDebtAmount > 0 ? totalNext12Months / grossDebtAmount : 0;
  const severity = buildSeverity(shareOfGrossDebt, MATURITY_12M_WARNING, MATURITY_12M_CRITICAL);
  const topShare = totalNext12Months > 0 && top ? top.amount / totalNext12Months : 0;

  if (ordered.length === 0 || totalNext12Months <= 0) {
    return buildAlert({
      id: "vencimentos_12m",
      category: "vencimentos_12m",
      severity: "info",
      title: "Vencimentos próximos de 12 meses",
      summary: "Sem maturidades consolidadas para os próximos 12 meses.",
      evidence: ["Nenhum vencimento projetado foi informado."],
      recommendation: "Consolidar a agenda de vencimentos para ativar esta leitura.",
    });
  }

  return buildAlert({
    id: "vencimentos_12m",
    category: "vencimentos_12m",
    severity,
    title: "Vencimentos próximos de 12 meses",
    summary: `${formatCurrency(totalNext12Months)} vencem nos próximos 12 meses, equivalentes a ${formatPercent(shareOfGrossDebt)} da dívida bruta.`,
    evidence: [
      `Pico mensal em ${formatMonthLabel(top?.name)}: ${top ? formatCurrency(top.amount) : formatCurrency(0)}.`,
      `O maior mês representa ${formatPercent(topShare)} do total de 12 meses.`,
    ],
    recommendation: "Priorizar alongamento, rolagem ou amortização dos meses mais carregados.",
  });
};

const buildPmtPeakAlert = (monthlyPmtProjection: CfoMonthlyAmount[]): CfoAlert => {
  const ordered = sortMonths(monthlyPmtProjection);
  const total = sumAmounts(ordered);
  const top = topItem(ordered);
  const average = ordered.length > 0 ? total / ordered.length : 0;
  const peakVsAverage = average > 0 && top ? top.amount / average : 0;
  const severity = buildSeverity(peakVsAverage, PMT_PEAK_WARNING, PMT_PEAK_CRITICAL);
  const peakShare = total > 0 && top ? top.amount / total : 0;

  if (ordered.length === 0 || total <= 0) {
    return buildAlert({
      id: "pmt_mensal_maximo",
      category: "pmt_mensal_maximo",
      severity: "info",
      title: "Maior PMT mensal",
      summary: "Sem projeção de PMT mensal consolidada.",
      evidence: ["Nenhuma série de PMT foi informada."],
      recommendation: "Consolidar a projeção mensal para identificar picos de caixa.",
    });
  }

  return buildAlert({
    id: "pmt_mensal_maximo",
    category: "pmt_mensal_maximo",
    severity,
    title: "Maior PMT mensal",
    summary: `O pico de PMT ocorre em ${formatMonthLabel(top?.name)} com ${formatCurrency(top?.amount ?? 0)}, ou ${formatRatio(peakVsAverage)} da média mensal.`,
    evidence: [
      `PMT total projetado no horizonte: ${formatCurrency(total)}.`,
      `O pico responde por ${formatPercent(peakShare)} do fluxo total projetado.`,
    ],
    recommendation: "Reforçar caixa ou alongar contratos que expliquem o pico mensal.",
  });
};

const buildGuaranteeAlert = (input: CfoGuaranteeCoverageInput): CfoAlert => {
  const guaranteeValue = safeNumber(input.guaranteeValue);
  const coveredDebtAmount = safeNumber(input.coveredDebtAmount);
  const coverageRatio = coveredDebtAmount > 0 ? guaranteeValue / coveredDebtAmount : 0;
  const severity = buildSeverity(coverageRatio, GUARANTEE_COVERAGE_WARNING, GUARANTEE_COVERAGE_CRITICAL, false);
  const shortfall = Math.max(0, coveredDebtAmount - guaranteeValue);

  if (coveredDebtAmount <= 0) {
    return buildAlert({
      id: "cobertura_garantias",
      category: "cobertura_garantias",
      severity: "info",
      title: "Cobertura de garantias",
      summary: "Sem base consolidada de dívida garantida para calcular cobertura.",
      evidence: ["A exposição garantida não foi informada."],
      recommendation: "Informar a exposição coberta por garantias para avaliar a folga de cobertura.",
    });
  }

  return buildAlert({
    id: "cobertura_garantias",
    category: "cobertura_garantias",
    severity,
    title: "Cobertura de garantias",
    summary: `As garantias cobrem ${formatPercent(coverageRatio)} da exposição garantida.`,
    evidence: [
      `Valor das garantias: ${formatCurrency(guaranteeValue)}.`,
      `Exposição garantida: ${formatCurrency(coveredDebtAmount)}. Gap: ${formatCurrency(shortfall)}.`,
    ],
    recommendation: "Reforçar garantias ou revisar a composição da exposição coberta.",
  });
};

const buildNetDebtAlert = (input: CfoNetDebtInput): CfoAlert => {
  const grossDebtAmount = safeNumber(input.grossDebtAmount);
  const cashAndEquivalents = safeNumber(input.cashAndEquivalents);
  const netDebtAmount = safeNumber(input.netDebtAmount ?? grossDebtAmount - cashAndEquivalents);
  const netDebtRatio = grossDebtAmount > 0 ? netDebtAmount / grossDebtAmount : 0;
  const severity = buildSeverity(netDebtRatio, NET_DEBT_WARNING, NET_DEBT_CRITICAL);
  const cashCoverage = grossDebtAmount > 0 ? cashAndEquivalents / grossDebtAmount : 0;

  if (grossDebtAmount <= 0) {
    return buildAlert({
      id: "divida_liquida",
      category: "divida_liquida",
      severity: "info",
      title: "Dívida líquida",
      summary: "Sem dívida bruta consolidada para calcular a dívida líquida.",
      evidence: ["A dívida bruta não foi informada."],
      recommendation: "Consolidar dívida bruta e caixa para calcular a dívida líquida.",
    });
  }

  return buildAlert({
    id: "divida_liquida",
    category: "divida_liquida",
    severity,
    title: "Dívida líquida",
    summary: `A dívida líquida consolidada é de ${formatCurrency(netDebtAmount)}, com caixa cobrindo ${formatPercent(cashCoverage)} da dívida bruta.`,
    evidence: [
      `Dívida bruta: ${formatCurrency(grossDebtAmount)}.`,
      `Caixa e equivalentes: ${formatCurrency(cashAndEquivalents)}.`,
    ],
    recommendation: "Avaliar a necessidade de reforço de liquidez ou redução de alavancagem.",
  });
};

// Ponto de integração para a narrativa executiva com IA no CFO V2.
const buildNarrativeCue = (alerts: CfoAlert[]): CfoNarrativeCue => {
  const facts = alerts.map((alert) => `${alert.title}: ${alert.summary}`);

  return {
    readyForAi: true,
    language: "pt-BR",
    facts,
    alertIds: alerts.map((alert) => alert.id),
    promptSeed: [
      "Escreva uma narrativa executiva curta para o CFO V2, em pt-BR, com tom objetivo.",
      "Use os fatos abaixo e destaque riscos, prioridades e leitura de caixa.",
      ...facts,
    ].join(" "),
  };
};

export const generateCfoAlerts = (metrics: CfoExecutiveMetrics): CfoAlertPack => {
  const grossDebtAmount = safeNumber(metrics.netDebt.grossDebtAmount);

  const alerts = [
    buildConcentrationAlert(
      "concentracao_banco",
      metrics.concentrationByBank,
      BANK_CONCENTRATION_WARNING,
      BANK_CONCENTRATION_CRITICAL,
      "Concentração por banco",
      "Reduzir dependência dos bancos mais concentrados ou reforçar limites com maior previsibilidade.",
    ),
    buildConcentrationAlert(
      "concentracao_indexador",
      metrics.concentrationByIndexer,
      INDEXER_CONCENTRATION_WARNING,
      INDEXER_CONCENTRATION_CRITICAL,
      "Concentração por indexador",
      "Avaliar se a exposição está excessivamente presa a um único indexador.",
    ),
    buildMaturityAlert(metrics.maturitiesNext12Months, grossDebtAmount),
    buildPmtPeakAlert(metrics.monthlyPmtProjection),
    buildGuaranteeAlert(metrics.guaranteeCoverage),
    buildNetDebtAlert(metrics.netDebt),
  ].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return {
    alerts,
    narrativeCue: buildNarrativeCue(alerts),
  };
};
