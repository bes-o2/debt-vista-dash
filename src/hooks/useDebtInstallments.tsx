import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type NormalizedDebtForCalculation } from '@/lib/debtUtils';
import { useCompany } from '@/hooks/useCompany';
import { useTemporaryScenario } from '@/hooks/useTemporaryScenario';

interface Installment {
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  remaining_balance: number;
}

interface CalculatedInstallment {
  installment_number: number;
  due_date: string;
  amortization: number;
  interest_amount: number;
  installment_amount: number;
  principal_balance: number;
}

type Debt = NormalizedDebtForCalculation;

const mapInstallmentRow = (row: {
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  remaining_balance: number;
}): Installment => ({
  installment_number: row.installment_number,
  due_date: row.due_date,
  principal_amount: row.principal_amount,
  interest_amount: row.interest_amount,
  total_amount: row.total_amount,
  remaining_balance: row.remaining_balance,
});

const mapCalculatedInstallment = (row: CalculatedInstallment): Installment => ({
  installment_number: row.installment_number,
  due_date: row.due_date,
  principal_amount: row.amortization,
  interest_amount: row.interest_amount,
  total_amount: row.installment_amount,
  remaining_balance: row.principal_balance,
});

export const useDebtInstallments = (debts: Debt[]) => {
  const [installmentsData, setInstallmentsData] = useState<{ [debtId: string]: Installment[] }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedCompany } = useCompany();
  const { scenarioSignature, toOverrides } = useTemporaryScenario();
  const temporaryOverrides = useMemo(() => toOverrides(), [toOverrides]);
  const hasTemporaryScenario = temporaryOverrides.length > 0;

  // Memoize debt IDs to prevent infinite re-renders
  const debtIds = useMemo(() => debts.map(debt => debt.id).sort(), [debts]);
  const debtsSignature = useMemo(() => debts
    .map((debt) => [
      debt.id,
      debt.financedAmount,
      debt.releaseDate,
      debt.firstDueDate,
      debt.dueDate,
      debt.calculationTable,
      debt.interestRate,
      debt.interestType,
      debt.indexer || '',
      debt.spreadRate || 0,
      debt.iofAmount || 0,
      debt.tacAmount || 0,
    ].join(':'))
    .sort()
    .join('|'), [debts]);
  const debtMap = useMemo(() => {
    const map: { [id: string]: Debt } = {};
    debts.forEach(debt => {
      map[debt.id] = debt;
    });
    return map;
  }, [debts]);

  const calculateMissingInstallments = async (
    missingDebtIds: string[],
  ): Promise<{ [debtId: string]: Installment[] }> => {
    const calculatedInstallments: { [debtId: string]: Installment[] } = {};

    await Promise.all(missingDebtIds.map(async (debtId) => {
      const debt = debtMap[debtId];
      if (!debt || !debt.firstDueDate || !debt.dueDate) {
        console.warn('[useDebtInstallments] debt rejeitado por falta de firstDueDate/dueDate:', debt?.id, { firstDueDate: debt?.firstDueDate, dueDate: debt?.dueDate });
        return;
      }

      try {
        if (!selectedCompany?.id) {
          console.warn('[useDebtInstallments] empresa não selecionada');
          return;
        }

        const { data, error: calculationError } = await supabase.functions.invoke('calculate-amortization', {
          body: {
            debtId: debt.id,
            companyId: selectedCompany.id,
            financedAmount: debt.financedAmount,
            firstDueDate: debt.firstDueDate,
            lastDueDate: debt.dueDate,
            calculationTable: debt.calculationTable,
            interestRate: debt.interestRate,
            interestType: debt.interestType,
            indexer: debt.indexer,
            spreadRate: debt.spreadRate || 0,
            iofAmount: debt.iofAmount || 0,
            tacAmount: debt.tacAmount || 0,
            temporaryOverrides,
            applyOverridesOnlyToFuture: true,
            persist: !hasTemporaryScenario,
          }
        });

        if (calculationError) throw calculationError;

        calculatedInstallments[debtId] = (data?.installments ?? []).map(mapCalculatedInstallment);
      } catch (calculationError) {
        console.error(`Error recalculating installments for debt ${debtId}:`, calculationError);
      }
    }));

    return calculatedInstallments;
  };

  const fetchInstallments = async () => {
    if (debtIds.length === 0) {
      setInstallmentsData({});
      return;
    }

    // Verify session is available directly from client (not React state) to avoid race conditions
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('debt_installments')
        .select('debt_id, installment_number, due_date, principal_amount, interest_amount, total_amount, remaining_balance')
        .in('debt_id', debtIds)
        .order('due_date', { ascending: true });

      if (fetchError) throw fetchError;

      if (hasTemporaryScenario) {
        const recalculatedInstallments = await calculateMissingInstallments(debtIds);
        const hasAnyInstallments = Object.keys(recalculatedInstallments).length > 0;

        if (!hasAnyInstallments) {
          setError('Nao foi possivel simular as parcelas das dividas.');
        }

        setInstallmentsData(recalculatedInstallments);
        return;
      }

      const groupedInstallments = (data ?? []).reduce<{ [debtId: string]: Installment[] }>((acc, row) => {
        if (!acc[row.debt_id]) {
          acc[row.debt_id] = [];
        }

        acc[row.debt_id].push(mapInstallmentRow(row));
        return acc;
      }, {});

      const missingDebtIds = debtIds.filter((debtId) => !groupedInstallments[debtId]?.length);
      const recalculatedInstallments = missingDebtIds.length > 0
        ? await calculateMissingInstallments(missingDebtIds)
        : {};
      const hasAnyInstallments =
        Object.keys(groupedInstallments).length > 0 || Object.keys(recalculatedInstallments).length > 0;

      if (!hasAnyInstallments && missingDebtIds.length > 0) {
        setError('Nao foi possivel carregar ou recalcular as parcelas das dividas.');
      }

      setInstallmentsData({
        ...groupedInstallments,
        ...recalculatedInstallments,
      });
    } catch (err) {
      console.error('Error fetching installments:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar parcelas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallments();
  }, [debtsSignature, selectedCompany?.id, scenarioSignature]);  // Refetch when debt parameters, company, or scenario changes

  return {
    installmentsData,
    loading,
    error,
    refetch: fetchInstallments
  };
};
