import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Installment {
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  remaining_balance: number;
}

interface Debt {
  id: string;
  bank: string;
  financedAmount: number;
  releaseDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  interestRate: number;
  interestType: 'monthly' | 'annual';
  indexer?: string;
  iofAmount?: number;
  tacAmount?: number;
  contractNumber?: string;
}

export const useDebtInstallments = (debts: Debt[]) => {
  const [installmentsData, setInstallmentsData] = useState<{ [debtId: string]: Installment[] }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInstallments = async () => {
    if (debts.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const debtIds = debts.map(debt => debt.id);
      
      // First, try to get existing installments from the database
      const { data: existingInstallments, error: fetchError } = await supabase
        .from('debt_installments')
        .select('*')
        .in('debt_id', debtIds)
        .order('debt_id', { ascending: true })
        .order('installment_number', { ascending: true });

      if (fetchError) throw fetchError;

      // Group installments by debt_id
      const groupedInstallments: { [debtId: string]: Installment[] } = {};
      existingInstallments?.forEach(installment => {
        if (!groupedInstallments[installment.debt_id]) {
          groupedInstallments[installment.debt_id] = [];
        }
        groupedInstallments[installment.debt_id].push({
          installment_number: installment.installment_number,
          due_date: installment.due_date,
          principal_amount: Number(installment.principal_amount),
          interest_amount: Number(installment.interest_amount),
          total_amount: Number(installment.total_amount),
          remaining_balance: Number(installment.remaining_balance)
        });
      });

      // For debts without calculated installments, calculate them
      const debtsNeedingCalculation = debts.filter(debt => !groupedInstallments[debt.id]);
      
      if (debtsNeedingCalculation.length > 0) {
        console.log(`Calculating installments for ${debtsNeedingCalculation.length} debts`);
        
        // Calculate installments for debts that don't have them yet
        for (const debt of debtsNeedingCalculation) {
          try {
            const { data, error: calcError } = await supabase.functions.invoke('calculate-amortization', {
              body: {
                debtId: debt.id,
                financedAmount: debt.financedAmount,
                releaseDate: debt.releaseDate,
                dueDate: debt.dueDate,
                calculationTable: debt.calculationTable,
                interestRate: debt.interestRate,
                interestType: debt.interestType,
                indexer: debt.indexer,
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
  }, [debts]);

  return {
    installmentsData,
    loading,
    error,
    refetch: fetchInstallments
  };
};