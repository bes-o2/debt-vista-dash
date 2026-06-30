import { differenceInMonths, subMonths } from "date-fns";

import { calculateIRRFromCashFlows } from "@/lib/irrCalculator";
import { parseLocalDate } from "@/lib/debtUtils";

/**
 * Comparação de cenários de refinanciamento — lógica pura (sem I/O).
 *
 * Reaproveita a engine canônica:
 * - O CET do cenário REFINANCIAR vem da Edge Function `calculate-amortization`
 *   (mesma convenção de IRR sobre fluxos líquidos: t0 = -(valor - IOF - TAC)).
 * - O CET do cenário MANTER é calculado aqui com `calculateIRRFromCashFlows`
 *   sobre o cronograma REMANESCENTE, ancorado no SALDO DEVEDOR ATUAL.
 *
 * Suporta consolidação N→1 ("envelopar a dívida"): o cenário MANTER agrega
 * os cronogramas remanescentes de vários contratos e o REFINANCIAR é uma
 * única dívida nova cujo valor financiado padrão = saldo devedor total.
 */

export interface ScheduleInstallment {
  due_date: string; // YYYY-MM-DD
  total_amount: number; // valor da parcela (installment_amount)
  principal_amount: number; // amortização
  remaining_balance: number; // saldo de abertura (convenção D1)
}

export interface CetResult {
  annualRate: number | null;
  monthlyRate: number | null;
  converged: boolean;
}

export interface ScenarioSummary {
  termMonths: number; // nº de parcelas (remanescentes, no caso "manter")
  totalCost: number; // soma nominal das parcelas
  averagePMT: number;
  firstPMT: number;
  cetAnnual: number | null;
  cetMonthly: number | null;
  cetConverged: boolean;
  principalBasis: number; // saldo devedor (manter) ou valor financiado (refi)
}

export interface KeepScenarioSummary extends ScenarioSummary {
  outstandingBalance: number;
  contractCount: number; // nº de contratos no pacote (1 = simulação simples)
  peakMonthlyPMT: number; // maior soma de parcelas em um único mês
}

export type RefinanceVerdict =
  | "economia" // CET menor → economia real de juros
  | "alivio_fluxo" // CET maior, mas PMT menor → alívio de caixa, não economia
  | "mais_caro" // CET maior e sem alívio de parcela
  | "neutro" // CET praticamente igual
  | "indefinido"; // algum CET não convergiu → não comparável

export interface RefinanceComparison {
  keep: KeepScenarioSummary;
  refinance: ScenarioSummary;
  cetDeltaAnnual: number | null; // refi - manter (negativo = refi mais barato)
  monthlyPmtRelief: number; // PMT médio manter - refi (positivo = alívio)
  firstPmtRelief: number; // PMT inicial manter - refi
  nominalCostDelta: number; // custo nominal manter - refi (informativo)
  termDeltaMonths: number; // prazo refi - manter
  upfrontCost: number; // IOF + TAC do refi
  breakevenMonths: number | null; // upfront / alívio mensal (se alívio > 0)
  verdict: RefinanceVerdict;
  isCetComparable: boolean;
}

// Tolerância para tratar variações ínfimas de CET como "neutro" (em p.p. a.a.).
const CET_TOLERANCE_PP = 0.05;

const sum = (values: number[]): number =>
  values.reduce((acc, value) => acc + value, 0);

const toMonthAnchorString = (dueDate: string): string | null => {
  const parsed = parseLocalDate(dueDate);
  if (!parsed) return null;
  const anchor = subMonths(parsed, 1);
  const year = anchor.getFullYear();
  const month = String(anchor.getMonth() + 1).padStart(2, "0");
  const day = String(anchor.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getFutureInstallments = (
  schedule: ScheduleInstallment[],
  today: Date,
): ScheduleInstallment[] => {
  const todayClean = new Date(today);
  todayClean.setHours(0, 0, 0, 0);

  return [...schedule]
    .filter((inst) => {
      const due = parseLocalDate(inst.due_date);
      if (!due) return false;
      due.setHours(0, 0, 0, 0);
      return due >= todayClean;
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
};

const emptyKeepSummary = (): KeepScenarioSummary => ({
  termMonths: 0,
  totalCost: 0,
  averagePMT: 0,
  firstPMT: 0,
  cetAnnual: null,
  cetMonthly: null,
  cetConverged: false,
  principalBasis: 0,
  outstandingBalance: 0,
  contractCount: 0,
  peakMonthlyPMT: 0,
});

/**
 * Resume o cenário MANTER a partir dos cronogramas persistidos de UM ou MAIS
 * contratos (consolidação N→1). Recebe um cronograma por contrato.
 *
 * - Saldo devedor total = Σ saldo de abertura da próxima parcela futura (D1).
 * - `firstPMT` = parcela mensal atual somada (próxima parcela de cada contrato),
 *   ou seja, quanto sai de caixa por mês HOJE com o pacote inteiro.
 * - `termMonths` = meses até o último vencimento do pacote.
 * - CET combinado: IRR sobre o fluxo agregado das parcelas futuras, com t0 =
 *   saldo total, ancorado um período antes do vencimento mais próximo do pacote
 *   (espelha a convenção da Edge: releaseDate = firstDueDate - 1 mês).
 */
export function summarizeKeepScenario(
  schedules: ScheduleInstallment[][],
  today: Date,
): KeepScenarioSummary {
  const perDebtFuture = schedules
    .map((schedule) => getFutureInstallments(schedule, today))
    .filter((future) => future.length > 0);

  if (perDebtFuture.length === 0) {
    return emptyKeepSummary();
  }

  const outstandingBalance = sum(
    perDebtFuture.map((future) => Math.max(0, future[0].remaining_balance)),
  );
  const currentMonthlyPMT = sum(perDebtFuture.map((future) => future[0].total_amount));

  const allFuture = perDebtFuture
    .flat()
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const totalCost = sum(allFuture.map((inst) => inst.total_amount));

  // Pico mensal: maior soma de parcelas caindo no mesmo mês (YYYY-MM).
  const byMonth: Record<string, number> = {};
  for (const inst of allFuture) {
    const monthKey = inst.due_date.slice(0, 7);
    byMonth[monthKey] = (byMonth[monthKey] ?? 0) + inst.total_amount;
  }
  const peakMonthlyPMT = Math.max(0, ...Object.values(byMonth));

  // Prazo do pacote: meses do hoje até o último vencimento.
  const lastDue = parseLocalDate(allFuture[allFuture.length - 1].due_date);
  const termMonths = lastDue
    ? Math.max(1, differenceInMonths(lastDue, today) + 1)
    : allFuture.length;

  let cet: CetResult = { annualRate: null, monthlyRate: null, converged: false };

  // Âncora = vencimento futuro mais próximo do pacote − 1 mês.
  const earliestNextDue = perDebtFuture
    .map((future) => future[0].due_date)
    .sort((a, b) => a.localeCompare(b))[0];
  const anchor = toMonthAnchorString(earliestNextDue);

  if (outstandingBalance > 0 && anchor) {
    const irr = calculateIRRFromCashFlows(
      outstandingBalance,
      allFuture.map((inst) => ({ date: inst.due_date, amount: inst.total_amount })),
      anchor,
    );
    cet = {
      annualRate: irr.converged ? irr.annualRate : null,
      monthlyRate: irr.converged ? irr.monthlyRate : null,
      converged: irr.converged,
    };
  }

  return {
    termMonths,
    totalCost,
    averagePMT: totalCost / termMonths,
    firstPMT: currentMonthlyPMT,
    cetAnnual: cet.annualRate,
    cetMonthly: cet.monthlyRate,
    cetConverged: cet.converged,
    principalBasis: outstandingBalance,
    outstandingBalance,
    contractCount: perDebtFuture.length,
    peakMonthlyPMT,
  };
}

/**
 * Resume o cenário REFINANCIAR a partir do cronograma simulado (Edge, dry-run)
 * e do CET já calculado pela engine.
 */
export function summarizeRefinanceScenario(
  installments: ScheduleInstallment[],
  cet: CetResult,
  financedAmount: number,
): ScenarioSummary {
  const amounts = installments.map((inst) => inst.total_amount);
  const totalCost = sum(amounts);

  return {
    termMonths: installments.length,
    totalCost,
    averagePMT: installments.length > 0 ? totalCost / installments.length : 0,
    firstPMT: installments.length > 0 ? installments[0].total_amount : 0,
    cetAnnual: cet.converged ? cet.annualRate : null,
    cetMonthly: cet.converged ? cet.monthlyRate : null,
    cetConverged: cet.converged,
    principalBasis: financedAmount,
  };
}

/**
 * Compara os dois cenários de forma honesta:
 * - Métrica primária = CET a.a. (taxa). Só rotula "economia" quando o CET cai.
 * - Alívio de PMT é tratado SEPARADAMENTE do custo total.
 * - Diferença de custo nominal é apenas informativa (prazos podem diferir).
 */
export function compareScenarios(
  keep: KeepScenarioSummary,
  refinance: ScenarioSummary,
  upfrontCost: number,
): RefinanceComparison {
  const isCetComparable = keep.cetConverged && refinance.cetConverged;

  const cetDeltaAnnual =
    isCetComparable && keep.cetAnnual != null && refinance.cetAnnual != null
      ? refinance.cetAnnual - keep.cetAnnual
      : null;

  const monthlyPmtRelief = keep.averagePMT - refinance.averagePMT;
  const firstPmtRelief = keep.firstPMT - refinance.firstPMT;
  const nominalCostDelta = keep.totalCost - refinance.totalCost;
  const termDeltaMonths = refinance.termMonths - keep.termMonths;

  const breakevenMonths =
    upfrontCost > 0 && monthlyPmtRelief > 0
      ? upfrontCost / monthlyPmtRelief
      : null;

  let verdict: RefinanceVerdict;
  if (!isCetComparable || cetDeltaAnnual == null) {
    verdict = "indefinido";
  } else if (cetDeltaAnnual < -CET_TOLERANCE_PP) {
    verdict = "economia";
  } else if (cetDeltaAnnual > CET_TOLERANCE_PP) {
    verdict = monthlyPmtRelief > 0 ? "alivio_fluxo" : "mais_caro";
  } else {
    verdict = "neutro";
  }

  return {
    keep,
    refinance,
    cetDeltaAnnual,
    monthlyPmtRelief,
    firstPmtRelief,
    nominalCostDelta,
    termDeltaMonths,
    upfrontCost,
    breakevenMonths,
    verdict,
    isCetComparable,
  };
}
