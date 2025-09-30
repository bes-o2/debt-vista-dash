import { calculateIRRFromCashFlows } from './irrCalculator';

export interface DebtForCET {
  id: string;
  financedAmount: number;
  iofAmount?: number;
  tacAmount?: number;
}

export interface InstallmentForCET {
  installment_amount: number;
  due_date: string;
}

/**
 * Calculate CET (Custo Efetivo Total) for a single debt
 * Returns both monthly and annual CET rates
 */
export function calculateCET(
  debt: DebtForCET,
  installments: InstallmentForCET[],
  startDate: string
): { monthlyRate: number; annualRate: number; converged: boolean } | null {
  if (!installments || installments.length === 0) {
    return null;
  }

  // Net amount received by the client at time 0 (financed amount minus upfront costs)
  const netAmountReceived = debt.financedAmount - (debt.iofAmount || 0) - (debt.tacAmount || 0);
  
  // Prepare payment data with dates and amounts
  const payments = installments.map(inst => ({
    date: inst.due_date,
    amount: inst.installment_amount
  }));

  console.log('📊 CET Calculation:', {
    debtId: debt.id,
    financedAmount: debt.financedAmount,
    iofAmount: debt.iofAmount || 0,
    tacAmount: debt.tacAmount || 0,
    netAmountReceived,
    paymentsCount: payments.length,
    totalPayments: payments.reduce((sum, p) => sum + p.amount, 0)
  });

  // Calculate IRR using the date-based calculator
  const result = calculateIRRFromCashFlows(netAmountReceived, payments, startDate);

  if (!result.converged) {
    console.warn('⚠️ CET calculation did not converge for debt:', debt.id);
  }

  return result;
}

/**
 * Calculate CET for multiple debts in batch
 * Returns a map of debt ID to CET data
 */
export function calculateBatchCET(
  debts: DebtForCET[],
  installmentsMap: Record<string, InstallmentForCET[]>,
  startDatesMap: Record<string, string>
): Record<string, { monthlyRate: number; annualRate: number } | null> {
  const results: Record<string, { monthlyRate: number; annualRate: number } | null> = {};

  debts.forEach(debt => {
    const installments = installmentsMap[debt.id];
    const startDate = startDatesMap[debt.id];

    if (!installments || !startDate) {
      results[debt.id] = null;
      return;
    }

    const cetResult = calculateCET(debt, installments, startDate);
    
    if (cetResult && cetResult.converged) {
      results[debt.id] = {
        monthlyRate: cetResult.monthlyRate,
        annualRate: cetResult.annualRate
      };
    } else {
      results[debt.id] = null;
    }
  });

  return results;
}

/**
 * Calculate weighted average CET for a group of debts
 * Weights are based on the financed amount
 */
export function calculateWeightedAverageCET(
  debts: DebtForCET[],
  cetMap: Record<string, { monthlyRate: number; annualRate: number } | null>
): { monthlyRate: number; annualRate: number } | null {
  let totalWeightedMonthly = 0;
  let totalWeightedAnnual = 0;
  let totalWeight = 0;

  debts.forEach(debt => {
    const cetData = cetMap[debt.id];
    if (cetData) {
      const weight = debt.financedAmount;
      totalWeightedMonthly += cetData.monthlyRate * weight;
      totalWeightedAnnual += cetData.annualRate * weight;
      totalWeight += weight;
    }
  });

  if (totalWeight === 0) {
    return null;
  }

  return {
    monthlyRate: totalWeightedMonthly / totalWeight,
    annualRate: totalWeightedAnnual / totalWeight
  };
}

/**
 * Calculate aggregate CET metrics by bank
 */
export function calculateCETByBank(
  debts: Array<DebtForCET & { bank: string }>,
  cetMap: Record<string, { monthlyRate: number; annualRate: number } | null>
): Record<string, { monthlyRate: number; annualRate: number; count: number } | null> {
  const banks = [...new Set(debts.map(d => d.bank))];
  const results: Record<string, { monthlyRate: number; annualRate: number; count: number } | null> = {};

  banks.forEach(bank => {
    const bankDebts = debts.filter(d => d.bank === bank);
    const avgCET = calculateWeightedAverageCET(bankDebts, cetMap);
    
    if (avgCET) {
      results[bank] = {
        ...avgCET,
        count: bankDebts.filter(d => cetMap[d.id] !== null).length
      };
    } else {
      results[bank] = null;
    }
  });

  return results;
}

/**
 * Calculate aggregate CET metrics by calculation table (SAC vs PRICE)
 */
export function calculateCETBySystem(
  debts: Array<DebtForCET & { calculationTable: 'SAC' | 'PRICE' }>,
  cetMap: Record<string, { monthlyRate: number; annualRate: number } | null>
): Record<string, { monthlyRate: number; annualRate: number; count: number } | null> {
  const results: Record<string, { monthlyRate: number; annualRate: number; count: number } | null> = {};

  ['SAC', 'PRICE'].forEach(system => {
    const systemDebts = debts.filter(d => d.calculationTable === system);
    const avgCET = calculateWeightedAverageCET(systemDebts, cetMap);
    
    if (avgCET) {
      results[system] = {
        ...avgCET,
        count: systemDebts.filter(d => cetMap[d.id] !== null).length
      };
    } else {
      results[system] = null;
    }
  });

  return results;
}

/**
 * Calculate overall portfolio CET
 */
export function calculatePortfolioCET(
  debts: DebtForCET[],
  cetMap: Record<string, { monthlyRate: number; annualRate: number } | null>
): { monthlyRate: number; annualRate: number; totalDebts: number; calculatedDebts: number } | null {
  const avgCET = calculateWeightedAverageCET(debts, cetMap);
  
  if (!avgCET) {
    return null;
  }

  return {
    ...avgCET,
    totalDebts: debts.length,
    calculatedDebts: debts.filter(d => cetMap[d.id] !== null).length
  };
}
