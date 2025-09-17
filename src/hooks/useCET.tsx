import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Debt {
  id: string;
  financedAmount: number;
  releaseDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  interestRate: number;
  interestType: 'monthly' | 'annual';
  indexer?: string;
  iofAmount?: number;
  tacAmount?: number;
}

interface Installment {
  installment_number: number;
  due_date: string;
  installment_amount: number;
}

export function useCET(debt: Debt, returnType: 'monthly' | 'annual' = 'annual') {
  const [cet, setCet] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Função para calcular VPL
  const calculateNPV = (cashFlows: number[], rate: number): number => {
    return cashFlows.reduce((npv, cashFlow, index) => {
      return npv + cashFlow / Math.pow(1 + rate, index);
    }, 0);
  };

  // Função para encontrar a taxa CET usando Newton-Raphson
  const findCETRate = (initialAmount: number, payments: number[]): number => {
    let rate = 0.02; // Taxa inicial de 2% ao mês
    const tolerance = 0.0001;
    const maxIterations = 100;
    
    for (let i = 0; i < maxIterations; i++) {
      const cashFlows = [-initialAmount, ...payments];
      const npv = calculateNPV(cashFlows, rate);
      
      if (Math.abs(npv) < tolerance) {
        return rate;
      }
      
      // Derivada numérica para Newton-Raphson
      const deltaRate = 0.0001;
      const cashFlowsDerivative = [-initialAmount, ...payments];
      const npvDerivative = calculateNPVDerivative(cashFlowsDerivative, rate, deltaRate);
      
      if (Math.abs(npvDerivative) < tolerance) {
        break;
      }
      
      rate = rate - npv / npvDerivative;
      
      // Garantir que a taxa seja positiva
      if (rate < 0) {
        rate = 0.001;
      }
    }
    
    return rate;
  };

  // Função para calcular a derivada do VPL
  const calculateNPVDerivative = (cashFlows: number[], rate: number, delta: number): number => {
    const npv1 = calculateNPV(cashFlows, rate + delta);
    const npv2 = calculateNPV(cashFlows, rate - delta);
    return (npv1 - npv2) / (2 * delta);
  };

  const calculateCET = async () => {
    if (!debt) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-amortization', {
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

      if (error) {
        console.error('Error calculating amortization for CET:', error);
        return;
      }

      const installments: Installment[] = data.installments;
      const payments = installments.map((inst: Installment) => inst.installment_amount);
      
      // Valor presente inicial (valor financiado + custos iniciais)
      const initialAmount = debt.financedAmount + (debt.iofAmount || 0) + (debt.tacAmount || 0);
      
      // Calcular a taxa CET mensal
      const monthlyRate = findCETRate(initialAmount, payments);
      
      // Converter para anual se necessário
      if (returnType === 'annual') {
        // Converter taxa mensal para anual: (1 + taxa_mensal)^12 - 1
        const annualRate = (Math.pow(1 + monthlyRate, 12) - 1) * 100;
        setCet(annualRate);
      } else {
        // Manter como taxa mensal
        setCet(monthlyRate * 100);
      }
      
    } catch (error) {
      console.error('Error calculating CET:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateCET();
  }, [debt.id, debt.financedAmount, debt.interestRate, debt.iofAmount, debt.tacAmount]);

  return { cet, loading };
}