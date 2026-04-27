import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { useBRLInput, BRL_INPUT_PROPS } from "@/hooks/useBRLInput";

interface Debt {
  id: string;
  financedAmount: number;
  releaseDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  indexer?: string;
  interestRate: number;
  interestType: 'monthly' | 'annual';
  bank: string;
  iofAmount?: number;
  tacAmount?: number;
  contractNumber?: string;
}

interface NetDebtCardProps {
  debts: Debt[];
}

export const NetDebtCard = ({ debts }: NetDebtCardProps) => {
  // Usando o hook padrão do projeto para inputs de moeda brasileira
  const { value: cashBalance, numericValue: cashValue, handleChange, handleBlur, formatCurrency } = useBRLInput();

  // Calculate current outstanding balance for each debt
  const calculateCurrentBalance = (debt: Debt): number => {
    const releaseDate = new Date(debt.releaseDate);
    const dueDate = new Date(debt.dueDate);
    const currentDate = new Date();
    
    // If contract hasn't started or has ended, balance is 0
    if (currentDate < releaseDate || currentDate > dueDate) return 0;
    
    // Calculate months elapsed and total months
    const monthsElapsed = Math.floor(
      (currentDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    );
    const totalMonths = Math.floor(
      (dueDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    );
    
    if (monthsElapsed <= 0) return debt.financedAmount;
    if (monthsElapsed >= totalMonths) return 0;
    
    const monthlyRate = debt.interestType === 'annual' 
      ? Math.pow(1 + debt.interestRate / 100, 1/12) - 1
      : debt.interestRate / 100;
    
    const principal = debt.financedAmount;
    
    if (debt.calculationTable === 'SAC') {
      // SAC: Constant principal amortization
      const monthlyPrincipal = principal / totalMonths;
      return principal - (monthlyPrincipal * monthsElapsed);
    } else {
      // PRICE: Constant installment
      const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / 
                            (Math.pow(1 + monthlyRate, totalMonths) - 1);
      
      // Calculate remaining balance using the PRICE formula
      const remainingMonths = totalMonths - monthsElapsed;
      return (monthlyPayment * (Math.pow(1 + monthlyRate, remainingMonths) - 1)) / 
             (monthlyRate * Math.pow(1 + monthlyRate, remainingMonths));
    }
  };

  // Calculate total debt using proper amortization
  const totalDebt = useMemo(() => {
    return debts.reduce((sum, debt) => {
      return sum + calculateCurrentBalance(debt);
    }, 0);
  }, [debts]);

  const netDebt = totalDebt - cashValue;
  const isPositive = netDebt > 0;

  return null;
};