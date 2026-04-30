import { type NormalizedDebtForCalculation, parseLocalDate } from "@/lib/debtUtils";
import {
  calculateBatchCET,
  calculateWeightedAverageCET,
} from "@/lib/cetCalculator";

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export interface DashboardMetrics {
  // KPIs principais
  currentOutstandingBalance: number;
  outstandingByBank: { bank: string; balance: number; share: number }[];
  outstandingByIndexer: { indexer: string; balance: number; share: number }[];
  currentPMT: number;
  pmtNext30d: number;
  pmtNext90d: number;
  pmtNext180d: number;
  peakMonthlyPmt12m: { month: string; total: number } | null;
  maturitiesNext12Months: number;
  maturitiesNext12MonthsByMonth: { month: string; amount: number }[];
  monthlyPmtProjection: { month: string; amount: number }[];
  upcomingDueDates: { debtId: string; bank: string; dueDate: Date; amount: number }[];
  // Custo
  averageMonthlyCET: number;
  averageAnnualCET: number;
  cdiSpread: number | null;
  // Estrutura
  averageRemainingTerm: number;
  sacVsPriceCount: { sac: number; price: number };
  concentrationByBank: { bank: string; balance: number; share: number }[];
  concentrationByIndexer: { indexer: string; balance: number; share: number }[];
  // Garantias
  guaranteeCoverage: any | null;
  // Liquidez (sem dados de caixa hoje)
  netDebt: null;
  // Meta
  period: { start: Date | null; end: Date | null; mode: "vigencia" | "vencimento" };
}

export interface ComputeDashboardMetricsInput {
  debts: NormalizedDebtForCalculation[];
  installmentsByDebtId: Record<string, any[]>;
  guaranteeMetrics: any | null;
  cdiAnnualRate: number | null;
  today: Date;
  period: { start: Date | null; end: Date | null; mode: "vigencia" | "vencimento" };
}

// ─── Funções internas ────────────────────────────────────────────────────────

function getMonthlyRate(debt: NormalizedDebtForCalculation): number {
  const base =
    debt.interestType === "monthly"
      ? debt.interestRate / 100
      : Math.pow(1 + debt.interestRate / 100, 1 / 12) - 1;
  const spread = debt.spreadRate ? debt.spreadRate / 100 : 0;
  return base + spread;
}

function calculateAnalyticalOutstandingBalance(
  debt: NormalizedDebtForCalculation,
  today: Date,
): number {
  const contractDate = parseLocalDate(debt.releaseDate);
  const lastDueDate = parseLocalDate(debt.dueDate);
  if (!contractDate || !lastDueDate) return debt.financedAmount;

  const termInMonths = Math.round(
    (lastDueDate.getTime() - contractDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
  );
  const monthsElapsed = Math.max(
    0,
    Math.round(
      (today.getTime() - contractDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
    ),
  );

  if (monthsElapsed <= 0) return debt.financedAmount;
  if (monthsElapsed >= termInMonths) return 0;

  const monthlyRate = getMonthlyRate(debt);
  const principal = debt.financedAmount;

  if (debt.calculationTable === "SAC") {
    const monthlyAmortization = principal / termInMonths;
    return Math.max(0, principal - monthlyAmortization * monthsElapsed);
  }

  // PRICE
  if (monthlyRate > 0) {
    const pmt =
      (principal * (monthlyRate * Math.pow(1 + monthlyRate, termInMonths))) /
      (Math.pow(1 + monthlyRate, termInMonths) - 1);
    const currentBalance =
      principal * Math.pow(1 + monthlyRate, monthsElapsed) -
      pmt * ((Math.pow(1 + monthlyRate, monthsElapsed) - 1) / monthlyRate);
    return Math.max(0, currentBalance);
  }

  return Math.max(0, principal - (principal / termInMonths) * monthsElapsed);
}

function calculateAnalyticalCurrentPMT(
  debt: NormalizedDebtForCalculation,
  today: Date,
): number {
  const releaseDate = parseLocalDate(debt.releaseDate);
  const dueDate = parseLocalDate(debt.dueDate);
  if (!releaseDate || !dueDate) return 0;

  releaseDate.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const termInMonths = Math.round(
    (dueDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
  );

  if (termInMonths <= 0 || today < releaseDate || today > dueDate) return 0;

  const monthlyRate = getMonthlyRate(debt);
  const principal = debt.financedAmount;

  if (debt.calculationTable === "PRICE") {
    if (monthlyRate > 0) {
      return (
        (principal * (monthlyRate * Math.pow(1 + monthlyRate, termInMonths))) /
        (Math.pow(1 + monthlyRate, termInMonths) - 1)
      );
    }
    return principal / termInMonths;
  }

  // SAC
  const elapsedMonths = Math.max(
    0,
    Math.round(
      (today.getTime() - releaseDate.getTime()) / (30.44 * 24 * 3600 * 1000),
    ),
  );
  if (elapsedMonths >= termInMonths) return 0;

  const amortization = principal / termInMonths;
  const currentBalance = Math.max(0, principal - amortization * elapsedMonths);
  return amortization + currentBalance * monthlyRate;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthlyCET(debt: NormalizedDebtForCalculation): number {
  if (debt.cet_monthly_rate != null) return debt.cet_monthly_rate;
  if (debt.cet_annual_rate != null)
    return (Math.pow(1 + debt.cet_annual_rate / 100, 1 / 12) - 1) * 100;
  return getMonthlyRate(debt) * 100;
}

function buildShareArray(
  entries: { label: string; balance: number }[],
  totalBalance: number,
): { bank: string; balance: number; share: number }[] {
  return entries.map(({ label, balance }) => ({
    bank: label,
    balance,
    share: totalBalance > 0 ? balance / totalBalance : 0,
  }));
}

function buildIndexerShareArray(
  entries: { label: string; balance: number }[],
  totalBalance: number,
): { indexer: string; balance: number; share: number }[] {
  return entries.map(({ label, balance }) => ({
    indexer: label,
    balance,
    share: totalBalance > 0 ? balance / totalBalance : 0,
  }));
}

// ─── Função pública principal ────────────────────────────────────────────────

export function computeDashboardMetrics(
  input: ComputeDashboardMetricsInput,
): DashboardMetrics {
  const { debts, installmentsByDebtId, guaranteeMetrics, cdiAnnualRate, today, period } =
    input;

  const todayClean = new Date(today);
  todayClean.setHours(0, 0, 0, 0);

  const in30d = addDays(todayClean, 30);
  const in90d = addDays(todayClean, 90);
  const in180d = addDays(todayClean, 180);
  const in12m = addDays(todayClean, 365);

  // ── Saldo analítico por contrato ──────────────────────────────────────────
  const balanceByDebtId: Record<string, number> = {};
  for (const debt of debts) {
    balanceByDebtId[debt.id] = calculateAnalyticalOutstandingBalance(debt, new Date(todayClean));
  }

  const currentOutstandingBalance = Object.values(balanceByDebtId).reduce((s, v) => s + v, 0);

  // ── PMT corrente (analítico) ──────────────────────────────────────────────
  const currentPMT = debts.reduce(
    (sum, debt) => sum + calculateAnalyticalCurrentPMT(debt, new Date(todayClean)),
    0,
  );

  // ── PMTs por prazo via parcelas reais ─────────────────────────────────────
  let pmtNext30d = 0;
  let pmtNext90d = 0;
  let pmtNext180d = 0;
  let maturitiesNext12Months = 0;
  const monthlyMaturityBuckets: Record<string, number> = {};
  const monthlyPmtBuckets: Record<string, number> = {};
  const upcomingByDebt: Record<string, { dueDate: Date; amount: number }> = {};

  for (const debt of debts) {
    const installments = installmentsByDebtId[debt.id] ?? [];
    for (const inst of installments) {
      const due = parseLocalDate(inst.due_date);
      if (!due) continue;
      due.setHours(0, 0, 0, 0);

      if (due >= todayClean && due <= in30d) {
        pmtNext30d += inst.total_amount ?? 0;
        if (!upcomingByDebt[debt.id] || due < upcomingByDebt[debt.id].dueDate) {
          upcomingByDebt[debt.id] = { dueDate: due, amount: inst.total_amount ?? 0 };
        }
      }
      if (due >= todayClean && due <= in90d) {
        pmtNext90d += inst.total_amount ?? 0;
      }
      if (due >= todayClean && due <= in180d) {
        pmtNext180d += inst.total_amount ?? 0;
      }
      if (due >= todayClean && due <= in12m) {
        maturitiesNext12Months += inst.principal_amount ?? 0;
        const ym = toYearMonth(due);
        monthlyMaturityBuckets[ym] = (monthlyMaturityBuckets[ym] ?? 0) + (inst.principal_amount ?? 0);
        monthlyPmtBuckets[ym] = (monthlyPmtBuckets[ym] ?? 0) + (inst.total_amount ?? 0);
      }
    }
  }

  // ── Pico mensal de PMT nos próximos 12m ──────────────────────────────────
  let peakMonthlyPmt12m: { month: string; total: number } | null = null;
  for (const [month, total] of Object.entries(monthlyPmtBuckets)) {
    if (!peakMonthlyPmt12m || total > peakMonthlyPmt12m.total) {
      peakMonthlyPmt12m = { month, total };
    }
  }
  const maturitiesNext12MonthsByMonth = Object.entries(monthlyMaturityBuckets)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const monthlyPmtProjection = Object.entries(monthlyPmtBuckets)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // ── upcomingDueDates ──────────────────────────────────────────────────────
  const upcomingDueDates = Object.entries(upcomingByDebt).map(([debtId, data]) => {
    const debt = debts.find((d) => d.id === debtId);
    return {
      debtId,
      bank: debt?.bank ?? "",
      dueDate: data.dueDate,
      amount: data.amount,
    };
  });

  // ── CET via batch (installments reais); fallback para taxa cadastro ────────
  const cetMap = calculateBatchCET(
    debts.map((d) => ({
      id: d.id,
      financedAmount: d.financedAmount,
      iofAmount: d.iofAmount,
      tacAmount: d.tacAmount,
    })),
    Object.fromEntries(
      debts.map((d) => [
        d.id,
        (installmentsByDebtId[d.id] ?? []).map((inst) => ({
          installment_amount: inst.total_amount ?? inst.installment_amount ?? 0,
          due_date: inst.due_date,
        })),
      ]),
    ),
    Object.fromEntries(debts.map((d) => [d.id, d.releaseDate])),
  );

  // Weighted average using saldo as weight; fallback cadastro se batch não calculou
  let totalWeightedMonthly = 0;
  let totalCetWeight = 0;
  for (const debt of debts) {
    const weight = balanceByDebtId[debt.id] ?? 0;
    if (weight <= 0) continue;
    const cetResult = cetMap[debt.id];
    const monthlyRate = cetResult ? cetResult.monthlyRate : getMonthlyCET(debt);
    totalWeightedMonthly += monthlyRate * weight;
    totalCetWeight += weight;
  }

  const averageMonthlyCET = totalCetWeight > 0 ? totalWeightedMonthly / totalCetWeight : 0;
  const averageAnnualCET = (Math.pow(1 + averageMonthlyCET / 100, 12) - 1) * 100;
  const cdiSpread = cdiAnnualRate != null ? averageAnnualCET - cdiAnnualRate : null;

  // ── Prazo médio restante ──────────────────────────────────────────────────
  let totalWeightedTerms = 0;
  let totalTermWeight = 0;
  for (const debt of debts) {
    const contractDate = parseLocalDate(debt.releaseDate);
    const lastDueDate = parseLocalDate(debt.dueDate);
    if (!contractDate || !lastDueDate) continue;

    const totalTermMonths = Math.round(
      (lastDueDate.getTime() - contractDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
    );
    const elapsedMonths = Math.max(
      0,
      Math.round(
        (todayClean.getTime() - contractDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
      ),
    );
    const remainingMonths = Math.max(0, totalTermMonths - elapsedMonths);
    const weight = balanceByDebtId[debt.id] ?? 0;
    if (weight <= 0) continue;

    totalWeightedTerms += remainingMonths * weight;
    totalTermWeight += weight;
  }
  const averageRemainingTerm = totalTermWeight > 0 ? totalWeightedTerms / totalTermWeight : 0;

  // ── SAC vs PRICE ──────────────────────────────────────────────────────────
  const sacVsPriceCount = {
    sac: debts.filter((d) => d.calculationTable === "SAC").length,
    price: debts.filter((d) => d.calculationTable === "PRICE").length,
  };

  // ── Concentração por banco ────────────────────────────────────────────────
  const bankBalanceMap: Record<string, number> = {};
  for (const debt of debts) {
    bankBalanceMap[debt.bank] = (bankBalanceMap[debt.bank] ?? 0) + (balanceByDebtId[debt.id] ?? 0);
  }
  const bankEntries = Object.entries(bankBalanceMap)
    .map(([label, balance]) => ({ label, balance }))
    .sort((a, b) => b.balance - a.balance);
  const concentrationByBank = buildShareArray(bankEntries, currentOutstandingBalance);
  const outstandingByBank = concentrationByBank;

  // ── Concentração por indexador ────────────────────────────────────────────
  const indexerBalanceMap: Record<string, number> = {};
  for (const debt of debts) {
    const key = debt.indexer ?? "Pré-fixado";
    indexerBalanceMap[key] = (indexerBalanceMap[key] ?? 0) + (balanceByDebtId[debt.id] ?? 0);
  }
  const indexerEntries = Object.entries(indexerBalanceMap)
    .map(([label, balance]) => ({ label, balance }))
    .sort((a, b) => b.balance - a.balance);
  const concentrationByIndexer = buildIndexerShareArray(indexerEntries, currentOutstandingBalance);
  const outstandingByIndexer = concentrationByIndexer;

  return {
    currentOutstandingBalance,
    outstandingByBank,
    outstandingByIndexer,
    currentPMT,
    pmtNext30d,
    pmtNext90d,
    pmtNext180d,
    peakMonthlyPmt12m,
    maturitiesNext12Months,
    maturitiesNext12MonthsByMonth,
    monthlyPmtProjection,
    upcomingDueDates,
    averageMonthlyCET,
    averageAnnualCET,
    cdiSpread,
    averageRemainingTerm,
    sacVsPriceCount,
    concentrationByBank,
    concentrationByIndexer,
    guaranteeCoverage: guaranteeMetrics ?? null,
    netDebt: null,
    period,
  };
}
