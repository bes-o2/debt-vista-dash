export interface GuaranteeMetricDebt {
  id: string;
  bank?: string | null;
  financedAmount: number;
  outstandingBalance?: number | null;
}

export interface GuaranteeMetricRow {
  debt_id: string;
  value: number;
}

export interface GuaranteeCoverageByBank {
  bank: string;
  debtBalance: number;
  guaranteeValue: number;
  coverageRatio: number;
  coveragePercentage: number;
}

export interface GuaranteeCoverageAlert {
  debtId: string;
  bank: string;
  debtBalance: number;
  guaranteeValue: number;
  missingValue: number;
  coverageRatio: number;
  coveragePercentage: number;
}

export interface GuaranteeMetrics {
  totalGuaranteeCount: number;
  totalGuaranteeValue: number;
  totalDebtBalance: number;
  coverageRatio: number;
  coveragePercentage: number;
  coverageByBank: GuaranteeCoverageByBank[];
  contractsWithoutGuaranteeCount: number;
  contractsWithoutGuarantee: Array<{
    debtId: string;
    bank: string;
    debtBalance: number;
  }>;
  insufficientGuaranteeAlert: boolean;
  insufficientCoverageContracts: GuaranteeCoverageAlert[];
}

const resolveDebtBalance = (debt: GuaranteeMetricDebt) => {
  const balance = debt.outstandingBalance ?? debt.financedAmount ?? 0;
  return Number.isFinite(balance) ? Math.max(0, balance) : 0;
};

const resolveBankName = (bank?: string | null) => bank?.trim() || "Sem banco";

export const calculateGuaranteeMetrics = ({
  debts,
  guarantees,
}: {
  debts: GuaranteeMetricDebt[];
  guarantees: GuaranteeMetricRow[];
}): GuaranteeMetrics => {
  const guaranteeValueByDebtId = guarantees.reduce<Record<string, number>>((acc, guarantee) => {
    const currentValue = acc[guarantee.debt_id] ?? 0;
    const normalizedValue = Number.isFinite(guarantee.value) ? Math.max(0, guarantee.value) : 0;
    acc[guarantee.debt_id] = currentValue + normalizedValue;
    return acc;
  }, {});

  const totalGuaranteeCount = guarantees.length;
  const totalGuaranteeValue = guarantees.reduce((sum, guarantee) => {
    const normalizedValue = Number.isFinite(guarantee.value) ? Math.max(0, guarantee.value) : 0;
    return sum + normalizedValue;
  }, 0);

  const coverageByBankMap = new Map<
    string,
    { debtBalance: number; guaranteeValue: number }
  >();
  const insufficientCoverageContracts: GuaranteeCoverageAlert[] = [];
  const contractsWithoutGuarantee: GuaranteeMetrics["contractsWithoutGuarantee"] = [];

  let totalDebtBalance = 0;

  for (const debt of debts) {
    const debtBalance = resolveDebtBalance(debt);
    const guaranteeValue = guaranteeValueByDebtId[debt.id] ?? 0;
    const bank = resolveBankName(debt.bank);

    totalDebtBalance += debtBalance;

    const currentBankTotals = coverageByBankMap.get(bank) ?? { debtBalance: 0, guaranteeValue: 0 };
    currentBankTotals.debtBalance += debtBalance;
    currentBankTotals.guaranteeValue += guaranteeValue;
    coverageByBankMap.set(bank, currentBankTotals);

    if (guaranteeValue <= 0) {
      contractsWithoutGuarantee.push({
        debtId: debt.id,
        bank,
        debtBalance,
      });
    }

    if (debtBalance > 0 && guaranteeValue < debtBalance) {
      const missingValue = debtBalance - guaranteeValue;
      const coverageRatio = guaranteeValue / debtBalance;
      insufficientCoverageContracts.push({
        debtId: debt.id,
        bank,
        debtBalance,
        guaranteeValue,
        missingValue,
        coverageRatio,
        coveragePercentage: coverageRatio * 100,
      });
    }
  }

  const coverageByBank = Array.from(coverageByBankMap.entries())
    .map(([bank, values]) => {
      const coverageRatio = values.debtBalance > 0 ? values.guaranteeValue / values.debtBalance : 0;

      return {
        bank,
        debtBalance: values.debtBalance,
        guaranteeValue: values.guaranteeValue,
        coverageRatio,
        coveragePercentage: coverageRatio * 100,
      };
    })
    .sort((a, b) => a.bank.localeCompare(b.bank, "pt-BR"));

  const coverageRatio = totalDebtBalance > 0 ? totalGuaranteeValue / totalDebtBalance : 0;

  return {
    totalGuaranteeCount,
    totalGuaranteeValue,
    totalDebtBalance,
    coverageRatio,
    coveragePercentage: coverageRatio * 100,
    coverageByBank,
    contractsWithoutGuaranteeCount: contractsWithoutGuarantee.length,
    contractsWithoutGuarantee,
    insufficientGuaranteeAlert: insufficientCoverageContracts.length > 0,
    insufficientCoverageContracts,
  };
};
