import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Installment {
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  remaining_balance: number;
}

// Local interface matching LegacyDebt format from convertToLegacyFormat
// See docs/FIELD_MAPPING.md for field correspondence
interface Debt {
  id: string;
  bank: string;
  financedAmount: number;
  releaseDate: string;  // Date of debt origination (calculated: first_due_date - 1 month)
  firstDueDate: string;  // Date of first installment (from database)
  dueDate: string;  // Last due date from database
  calculationTable: 'SAC' | 'PRICE';
  interestRate: number;
  interestType: 'monthly' | 'annual';
  indexer?: string;
  spreadRate?: number;  // Standardized to camelCase
  iofAmount?: number;
  tacAmount?: number;
  contractNumber?: string;
}

export const useDebtInstallments = (debts: Debt[]) => {
  const [installmentsData, setInstallmentsData] = useState<{ [debtId: string]: Installment[] }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize debt IDs to prevent infinite re-renders
  const debtIds = useMemo(() => debts.map(debt => debt.id).sort(), [debts]);
  const debtMap = useMemo(() => {
    const map: { [id: string]: Debt } = {};
    debts.forEach(debt => {
      map[debt.id] = debt;
    });
    return map;
  }, [debts]);

  const fetchInstallments = async () => {
    if (debtIds.length === 0) return;

    // Verify session is available directly from client (not React state) to avoid race conditions
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // FORCE RECALCULATION: Delete all existing installments to force fresh calculation with correct spread_rate
      console.log('Deleting existing installments to force recalculation...');
      const { error: deleteError } = await supabase
        .from('debt_installments')
        .delete()
        .in('debt_id', debtIds);

      if (deleteError) {
        console.error('Error deleting installments:', deleteError);
      }

      // Now all debts need calculation
      const groupedInstallments: { [debtId: string]: Installment[] } = {};
      const debtsNeedingCalculation = debtIds.map(id => debtMap[id]);
      
      if (debtsNeedingCalculation.length > 0) {
        console.log(`Calculating installments for ${debtsNeedingCalculation.length} debts`);
        
        // Calculate installments for debts that don't have them yet
        for (const debt of debtsNeedingCalculation) {
          try {
            const { data, error: calcError } = await supabase.functions.invoke('calculate-amortization', {
              body: {
                debtId: debt.id,
                financedAmount: debt.financedAmount,
                firstDueDate: debt.firstDueDate,  // First installment date
                lastDueDate: debt.dueDate,  // Last installment date
                calculationTable: debt.calculationTable,
                interestRate: debt.interestRate,
                interestType: debt.interestType,
                indexer: debt.indexer,
                spreadRate: debt.spreadRate || 0,
                iofAmount: debt.iofAmount || 0,
                tacAmount: debt.tacAmount || 0
              }
            });

            if (calcError) {
              console.error(`Error calculating installments for debt ${debt.id}:`, calcError);
              continue;
            }

            if (data?.installments) {
              // Convert the calculated installments to our format
              groupedInstallments[debt.id] = data.installments.map((inst: any) => ({
                installment_number: inst.installment_number,
                due_date: inst.due_date,
                principal_amount: inst.amortization,
                interest_amount: inst.interest_amount,
                total_amount: inst.installment_amount,
                remaining_balance: Math.max(0, inst.principal_balance - inst.amortization)
              }));
            }
          } catch (calcError) {
            console.error(`Error calculating installments for debt ${debt.id}:`, calcError);
          }
        }
      }

      setInstallmentsData(groupedInstallments);
    } catch (err) {
      console.error('Error fetching installments:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar parcelas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallments();
  }, [debtIds.join(',')]);  // Use stringified debt IDs to prevent infinite loops

  return {
    installmentsData,
    loading,
    error,
    refetch: fetchInstallments
  };
};