import { useState, useEffect, useMemo } from 'react';
import { useDebtInstallments } from './useDebtInstallments';
import { 
  calculateBatchCET, 
  calculateWeightedAverageCET,
  calculateCETByBank,
  calculateCETBySystem,
  calculatePortfolioCET,
  DebtForCET,
  InstallmentForCET,
} from '@/lib/cetCalculator';

interface Debt {
  id: string;
  financedAmount: number;
  releaseDate: string;
  firstDueDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  interestRate: number;
  interestType: 'monthly' | 'annual';
  indexer?: string;
  iofAmount?: number;
  tacAmount?: number;
  bank: string;
}

interface CETData {
  monthlyRate: number;
  annualRate: number;
}

interface CETManagerResult {
  // Individual debt CET
  getCET: (debtId: string) => CETData | null;
  
  // Aggregate CET by bank
  getCETByBank: () => Record<string, (CETData & { count: number }) | null>;
  
  // Aggregate CET by system (SAC/PRICE)
  getCETBySystem: () => Record<string, (CETData & { count: number }) | null>;
  
  // Portfolio-wide CET
  getPortfolioCET: () => (CETData & { totalDebts: number; calculatedDebts: number }) | null;
  
  // Loading state
  isLoading: boolean;
  
  // All calculated CETs
  allCETs: Record<string, CETData | null>;
}

/**
 * Centralized CET Manager Hook
 * Calculates CET for all debts once and provides methods to access the results
 */
export function useCETManager(debts: Debt[]): CETManagerResult {
  const [cetMap, setCETMap] = useState<Record<string, CETData | null>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  
  // Fetch installments for all debts
  const { installmentsData, loading: installmentsLoading } = useDebtInstallments(debts);

  // Calculate CETs whenever debts or installments change
  useEffect(() => {
    if (installmentsLoading || debts.length === 0) {
      return;
    }

    const hasAllInstallments = debts.every(debt => installmentsData[debt.id]);
    
    if (!hasAllInstallments) {
      return;
    }

    setIsCalculating(true);

    // Prepare data for batch calculation
    const debtsForCET: DebtForCET[] = debts.map(debt => ({
      id: debt.id,
      financedAmount: debt.financedAmount,
      iofAmount: debt.iofAmount,
      tacAmount: debt.tacAmount
    }));

    const installmentsMap: Record<string, InstallmentForCET[]> = {};
    const startDatesMap: Record<string, string> = {};

    debts.forEach(debt => {
      installmentsMap[debt.id] = installmentsData[debt.id] || [];
      startDatesMap[debt.id] = debt.releaseDate;
    });

    // Calculate all CETs in batch
    const results = calculateBatchCET(debtsForCET, installmentsMap, startDatesMap);

    setCETMap(results);
    setIsCalculating(false);
  }, [debts, installmentsData, installmentsLoading]);

  // Memoized accessor functions
  const getCET = useMemo(() => {
    return (debtId: string): CETData | null => {
      return cetMap[debtId] || null;
    };
  }, [cetMap]);

  const getCETByBank = useMemo(() => {
    return (): Record<string, (CETData & { count: number }) | null> => {
      if (debts.length === 0) return {};
      return calculateCETByBank(debts, cetMap);
    };
  }, [debts, cetMap]);

  const getCETBySystem = useMemo(() => {
    return (): Record<string, (CETData & { count: number }) | null> => {
      if (debts.length === 0) return {};
      return calculateCETBySystem(debts, cetMap);
    };
  }, [debts, cetMap]);

  const getPortfolioCET = useMemo(() => {
    return (): (CETData & { totalDebts: number; calculatedDebts: number }) | null => {
      if (debts.length === 0) return null;
      return calculatePortfolioCET(debts, cetMap);
    };
  }, [debts, cetMap]);

  return {
    getCET,
    getCETByBank,
    getCETBySystem,
    getPortfolioCET,
    isLoading: installmentsLoading || isCalculating,
    allCETs: cetMap
  };
}
