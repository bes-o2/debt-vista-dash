import { type LegacyDebt } from "@/hooks/useDebts";

// Convert legacy debt format to the format expected by new components
export const normalizeDebtForCalculation = (legacyDebt: LegacyDebt) => {
  // Calculate first_due_date as releaseDate + 1 month
  const releaseDate = new Date(legacyDebt.releaseDate);
  const firstDueDate = new Date(releaseDate);
  firstDueDate.setMonth(firstDueDate.getMonth() + 1);
  
  return {
    id: legacyDebt.id,
    bank: legacyDebt.bank,
    financedAmount: legacyDebt.financedAmount,
    first_due_date: firstDueDate.toISOString().split('T')[0],  // Format as YYYY-MM-DD
    dueDate: legacyDebt.dueDate,
    calculationTable: legacyDebt.calculationTable,
    interestRate: legacyDebt.interestRate,
    interestType: legacyDebt.interestType,
    indexer: legacyDebt.indexer,
    spread_rate: legacyDebt.spread_rate || 0,
    iofAmount: legacyDebt.iofAmount,
    tacAmount: legacyDebt.tacAmount,
    contractNumber: legacyDebt.contractNumber
  };
};

export const calculateOutstandingBalance = (
  debts: LegacyDebt[], 
  installmentsData: { [debtId: string]: any[] },
  targetDate: Date
): { [bankName: string]: number } => {
  const bankBalances: { [bankName: string]: number } = {};

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

    // Find the installment that would be due just after our target date
    const installmentsBeforeTarget = debtInstallments.filter(inst => 
      new Date(inst.due_date) <= targetDate
    );

    if (installmentsBeforeTarget.length === 0) {
      // If no installments are due yet, return the full financed amount
      bankBalances[debt.bank] += debt.financedAmount;
    } else {
      // Get the last installment before or on the target date
      const lastInstallment = installmentsBeforeTarget[installmentsBeforeTarget.length - 1];
      
      // Add the remaining balance after this installment
      bankBalances[debt.bank] += Math.max(0, lastInstallment.remaining_balance);
    }
  });

  return bankBalances;
};