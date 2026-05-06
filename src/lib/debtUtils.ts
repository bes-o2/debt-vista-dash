import { type LegacyDebt } from "@/hooks/useDebts";
import { resolveDebtBankName } from "@/lib/debtBank";
import type { CetStatus } from "@/lib/cetStatus";

type DebtSource = Partial<LegacyDebt> & {
  financed_amount?: number;
  first_due_date?: string;
  last_due_date?: string;
  calculation_table?: 'SAC' | 'PRICE';
  interest_base?: string;
  interest_rate?: number;
  interest_type?: 'monthly' | 'annual';
  spreadRate?: number;
  spread_rate?: number;
  iof_rate?: number;
  additional_fees?: number;
  title?: string;
  description?: string;
};

export interface NormalizedDebtForCalculation {
  id: string;
  bank: string;
  financedAmount: number;
  releaseDate: string;
  firstDueDate: string;
  first_due_date?: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  interestRate: number;
  interestType: 'monthly' | 'annual';
  indexer?: string;
  spreadRate?: number;
  iofAmount?: number;
  tacAmount?: number;
  contractNumber?: string;
  cet_monthly_rate?: number;
  cet_annual_rate?: number;
  cet_status?: CetStatus;
}

export const parseLocalDate = (value: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  if (value.includes("T")) {
    return parsed;
  }

  return new Date(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  );
};

type DateRangeDebt = {
  releaseDate?: string;
  dueDate?: string;
};

const normalizeRangeDate = (value: Date | string | undefined, endOfDay = false): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : parseLocalDate(value);
  if (!date || Number.isNaN(date.getTime())) return null;
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
};

export const debtIntersectsDateRange = (
  debt: DateRangeDebt,
  startDate?: Date | string,
  endDate?: Date | string,
) => {
  if (!startDate && !endDate) return true;

  const debtStart = normalizeRangeDate(debt.releaseDate);
  const debtEnd = normalizeRangeDate(debt.dueDate, true);
  if (!debtStart || !debtEnd) return false;

  const rangeStart = normalizeRangeDate(startDate);
  const rangeEnd = normalizeRangeDate(endDate, true);

  if (rangeStart && debtEnd < rangeStart) return false;
  if (rangeEnd && debtStart > rangeEnd) return false;
  return true;
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addMonthsLocal = (dateString: string, months: number) => {
  const date = parseLocalDate(dateString);
  if (!date || Number.isNaN(date.getTime())) return '';
  date.setMonth(date.getMonth() + months);
  return formatLocalDate(date);
};

// Convert legacy, database, or already-normalized debt formats to the format expected by calculation hooks
export const normalizeDebtForCalculation = (debt: DebtSource): NormalizedDebtForCalculation => {
  const financedAmount = debt.financedAmount ?? debt.financed_amount ?? 0;
  const releaseDate = debt.releaseDate
    ?? (debt.firstDueDate ? addMonthsLocal(debt.firstDueDate, -1) : undefined)
    ?? (debt.first_due_date ? addMonthsLocal(debt.first_due_date, -1) : undefined)
    ?? '';
  const firstDueDate = debt.firstDueDate
    ?? debt.first_due_date
    ?? (releaseDate ? addMonthsLocal(releaseDate, 1) : '');
  const dueDate = debt.dueDate ?? debt.last_due_date ?? '';
  const bank = resolveDebtBankName(debt);
  const calculationTable = debt.calculationTable ?? debt.calculation_table ?? 'SAC';
  const interestRate = debt.interestRate ?? debt.interest_rate ?? 0;
  const interestType = debt.interestType ?? debt.interest_type ?? 'monthly';
  const iofAmount = debt.iofAmount ?? (
    debt.iof_rate != null
      ? (financedAmount * debt.iof_rate) / 100
      : undefined
  );

  return {
    id: debt.id || `${bank}-${financedAmount}-${firstDueDate}-${dueDate}`,
    bank,
    financedAmount,
    releaseDate,
    firstDueDate,
    first_due_date: firstDueDate,
    dueDate,
    calculationTable,
    interestRate,
    interestType,
    indexer: debt.indexer ?? debt.interest_base,
    spreadRate: debt.spreadRate ?? debt.spread_rate ?? 0,
    iofAmount,
    tacAmount: debt.tacAmount ?? debt.additional_fees,
    contractNumber: debt.contractNumber ?? debt.title ?? debt.description,
    cet_monthly_rate: debt.cet_monthly_rate,
    cet_annual_rate: debt.cet_annual_rate,
    cet_status: debt.cet_status,
  };
};

export const calculateOutstandingBalance = (
  debts: LegacyDebt[], 
  installmentsData: { [debtId: string]: any[] },
  targetDate: Date
): { [bankName: string]: number } => {
  const bankBalances: { [bankName: string]: number } = {};
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  debts.forEach(debt => {
    const debtInstallments = installmentsData[debt.id];
    
    if (!bankBalances[debt.bank]) {
      bankBalances[debt.bank] = 0;
    }

    if (!debtInstallments || debtInstallments.length === 0) {
      // If no installments calculated yet, use original amount
      bankBalances[debt.bank] += debt.financedAmount;
      return;
    }

    const sortedInstallments = [...debtInstallments].sort((a, b) =>
      String(a.due_date).localeCompare(String(b.due_date))
    );
    const nextInstallment = sortedInstallments.find(inst => {
      const dueDate = parseLocalDate(inst.due_date);
      return dueDate ? dueDate >= target : false;
    });

    bankBalances[debt.bank] += nextInstallment
      ? Math.max(0, nextInstallment.remaining_balance)
      : 0;
  });

  return bankBalances;
};
