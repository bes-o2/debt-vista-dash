import { differenceInMonths } from "date-fns";

import { parseLocalDate, type NormalizedDebtForCalculation } from "@/lib/debtUtils";
import { getEffectiveMonthlyRate } from "@/lib/rateUtils";

type AnalyticalDebt = NormalizedDebtForCalculation & {
  spread_rate?: number;
};

const getSpreadRate = (debt: AnalyticalDebt) =>
  debt.spreadRate ?? debt.spread_rate ?? 0;

const getTermInMonths = (debt: AnalyticalDebt) => {
  const releaseDate = parseLocalDate(debt.releaseDate);
  const dueDate = parseLocalDate(debt.dueDate);
  if (!releaseDate || !dueDate) return 0;

  return differenceInMonths(dueDate, releaseDate);
};

const getElapsedMonths = (debt: AnalyticalDebt, targetDate: Date) => {
  const releaseDate = parseLocalDate(debt.releaseDate);
  if (!releaseDate) return 0;

  return Math.max(0, differenceInMonths(targetDate, releaseDate));
};

export const getAnalyticalOutstanding = (
  debt: AnalyticalDebt,
  targetDate: Date,
): number => {
  const termInMonths = getTermInMonths(debt);
  const monthsElapsed = getElapsedMonths(debt, targetDate);

  if (termInMonths <= 0) return Math.max(0, debt.financedAmount);
  if (monthsElapsed <= 0) return Math.max(0, debt.financedAmount);
  if (monthsElapsed >= termInMonths) return 0;

  const monthlyRate = getEffectiveMonthlyRate(
    debt.interestRate,
    getSpreadRate(debt),
    debt.interestType,
  );
  const principal = debt.financedAmount;

  if (debt.calculationTable === "SAC") {
    return Math.max(0, principal - (principal / termInMonths) * monthsElapsed);
  }

  if (monthlyRate > 0) {
    const compoundFactor = Math.pow(1 + monthlyRate, termInMonths);
    const pmt = (principal * monthlyRate * compoundFactor) / (compoundFactor - 1);
    const elapsedFactor = Math.pow(1 + monthlyRate, monthsElapsed);
    const balance =
      principal * elapsedFactor -
      pmt * ((elapsedFactor - 1) / monthlyRate);

    return Math.max(0, balance);
  }

  return Math.max(0, principal - (principal / termInMonths) * monthsElapsed);
};

export const getAnalyticalCurrentPMT = (
  debt: AnalyticalDebt,
  referenceDate: Date,
): number => {
  const releaseDate = parseLocalDate(debt.releaseDate);
  const dueDate = parseLocalDate(debt.dueDate);
  if (!releaseDate || !dueDate) return 0;

  const targetDate = new Date(referenceDate);
  targetDate.setHours(0, 0, 0, 0);
  releaseDate.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const termInMonths = getTermInMonths(debt);
  if (termInMonths <= 0 || targetDate < releaseDate || targetDate > dueDate) {
    return 0;
  }

  const monthlyRate = getEffectiveMonthlyRate(
    debt.interestRate,
    getSpreadRate(debt),
    debt.interestType,
  );
  const principal = debt.financedAmount;

  if (debt.calculationTable === "PRICE") {
    if (monthlyRate > 0) {
      const compoundFactor = Math.pow(1 + monthlyRate, termInMonths);
      return (principal * monthlyRate * compoundFactor) / (compoundFactor - 1);
    }

    return principal / termInMonths;
  }

  const elapsedMonths = getElapsedMonths(debt, targetDate);
  if (elapsedMonths >= termInMonths) return 0;

  const amortization = principal / termInMonths;
  const currentBalance = getAnalyticalOutstanding(debt, targetDate);

  return amortization + currentBalance * monthlyRate;
};
