import { type NormalizedDebtForCalculation, parseLocalDate } from "@/lib/debtUtils";
import {
  getAnalyticalCurrentPMT,
  getAnalyticalOutstanding,
} from "@/lib/balanceCalculator";
import { getEffectiveMonthlyRate } from "@/lib/rateUtils";
import { resolveCetStatus, type CetStatus } from "@/lib/cetStatus";

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
  averageCetStatus: CetStatus;
  isCetEstimated: boolean;
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

type DashboardInstallment = {
  due_date: string;
  principal_amount?: number;
  total_amount?: number;
  remaining_balance?: number;
  installment_amount?: number;
};

export interface ComputeDashboardMetricsInput {
  debts: NormalizedDebtForCalculation[];
  installmentsByDebtId: Record<string, DashboardInstallment[]>;
  guaranteeMetrics: any | null;
  cdiAnnualRate: number | null;
  today: Date;
  period: { start: Date | null; end: Date | null; mode: "vigencia" | "vencimento" };
}

// ─── Funções internas ────────────────────────────────────────────────────────

function getMonthlyRate(debt: NormalizedDebtForCalculation): number {
  return getEffectiveMonthlyRate(debt.interestRate, debt.spreadRate ?? 0, debt.interestType);
}

function diffInMonths(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  return years * 12 + months;
}

function sortInstallments(installments: DashboardInstallment[]): DashboardInstallment[] {
  return [...installments].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
}

function getNextInstallment(installments: DashboardInstallment[], today: Date): DashboardInstallment | null {
  return sortInstallments(installments).find((inst) => {
    const due = parseLocalDate(inst.due_date);
    if (!due) return false;
    due.setHours(0, 0, 0, 0);
    return due >= today;
  }) ?? null;
}

function calculateOutstandingBalanceFromInstallments(
  debt: NormalizedDebtForCalculation,
  installments: DashboardInstallment[],
  today: Date,
): number {
  const releaseDate = parseLocalDate(debt.releaseDate);
  if (releaseDate) {
    releaseDate.setHours(0, 0, 0, 0);
    if (today < releaseDate) return 0;
  }

  const nextInstallment = getNextInstallment(installments, today);
  if (!nextInstallment) return 0;

  const remainingBalance = Number(nextInstallment.remaining_balance);
  return Number.isFinite(remainingBalance) ? Math.max(0, remainingBalance) : 0;
}

function calculateCurrentPMTFromInstallments(installments: DashboardInstallment[], today: Date): number {
  const nextInstallment = getNextInstallment(installments, today);
  if (!nextInstallment) return 0;

  const totalAmount = Number(nextInstallment.total_amount);
  return Number.isFinite(totalAmount) ? Math.max(0, totalAmount) : 0;
}

function calculateAnalyticalOutstandingBalance(
  debt: NormalizedDebtForCalculation,
  today: Date,
): number {
  return getAnalyticalOutstanding(debt, today);
}

function calculateAnalyticalCurrentPMT(
  debt: NormalizedDebtForCalculation,
  today: Date,
): number {
  return getAnalyticalCurrentPMT(debt, today);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getPersistedOrEstimatedMonthlyCET(
  debt: NormalizedDebtForCalculation,
): { monthlyRate: number; estimated: boolean } {
  if (resolveCetStatus(debt) === "calculado" && debt.cet_monthly_rate != null) {
    return { monthlyRate: debt.cet_monthly_rate, estimated: false };
  }

  return { monthlyRate: getMonthlyRate(debt) * 100, estimated: true };
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

  // ── Saldo atual por contrato ──────────────────────────────────────────────
  const balanceByDebtId: Record<string, number> = {};
  for (const debt of debts) {
    const installments = installmentsByDebtId[debt.id] ?? [];
    balanceByDebtId[debt.id] = installments.length > 0
      ? calculateOutstandingBalanceFromInstallments(debt, installments, new Date(todayClean))
      : calculateAnalyticalOutstandingBalance(debt, new Date(todayClean));
  }

  const currentOutstandingBalance = Object.values(balanceByDebtId).reduce((s, v) => s + v, 0);

  // ── PMT corrente ──────────────────────────────────────────────────────────
  const currentPMT = debts.reduce(
    (sum, debt) => {
      const installments = installmentsByDebtId[debt.id] ?? [];
      const pmt = installments.length > 0
        ? calculateCurrentPMTFromInstallments(installments, new Date(todayClean))
        : calculateAnalyticalCurrentPMT(debt, new Date(todayClean));
      return sum + pmt;
    },
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

  const debtsWithCetWeight = debts.filter((debt) => (balanceByDebtId[debt.id] ?? 0) > 0);
  const averageCetStatus = debtsWithCetWeight.some(
    (debt) => resolveCetStatus(debt) === "nao_convergiu",
  )
    ? "nao_convergiu"
    : debtsWithCetWeight.some((debt) => resolveCetStatus(debt) === "pendente")
      ? "pendente"
      : "calculado";

  // Weighted average using saldo as weight; persisted CET is the source of truth.
  let totalWeightedMonthly = 0;
  let totalCetWeight = 0;
  let isCetEstimated = false;
  for (const debt of debts) {
    const weight = balanceByDebtId[debt.id] ?? 0;
    if (weight <= 0) continue;
    if (averageCetStatus === "nao_convergiu") continue;
    const { monthlyRate, estimated } = getPersistedOrEstimatedMonthlyCET(debt);
    isCetEstimated = isCetEstimated || estimated;
    totalWeightedMonthly += monthlyRate * weight;
    totalCetWeight += weight;
  }

  const averageMonthlyCET =
    averageCetStatus !== "nao_convergiu" && totalCetWeight > 0
      ? totalWeightedMonthly / totalCetWeight
      : 0;
  const averageAnnualCET =
    averageCetStatus !== "nao_convergiu"
      ? (Math.pow(1 + averageMonthlyCET / 100, 12) - 1) * 100
      : 0;
  const cdiSpread =
    averageCetStatus !== "nao_convergiu" && cdiAnnualRate != null
      ? averageAnnualCET - cdiAnnualRate
      : null;

  // ── Prazo médio restante ──────────────────────────────────────────────────
  let totalWeightedTerms = 0;
  let totalTermWeight = 0;
  for (const debt of debts) {
    const contractDate = parseLocalDate(debt.releaseDate);
    const lastDueDate = parseLocalDate(debt.dueDate);
    if (!contractDate || !lastDueDate) continue;

    const totalTermMonths = Math.round(
      diffInMonths(contractDate, lastDueDate),
    );
    const elapsedMonths = Math.max(0, diffInMonths(contractDate, todayClean));
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
    averageCetStatus,
    isCetEstimated,
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
