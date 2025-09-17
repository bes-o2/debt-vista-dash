import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";

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
  const [cashBalance, setCashBalance] = useState<string>('');

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);

  const formatInput = (value: string) => {
    // Remove all non-numeric characters except dots and commas
    const numericValue = value.replace(/[^\d.,]/g, '');
    
    // Convert to number (handle Brazilian format)
    const numberValue = parseFloat(numericValue.replace(',', '.'));
    
    if (isNaN(numberValue)) return '';
    
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numberValue);
  };

  const parseCurrencyInput = (value: string): number => {
    if (!value) return 0;
    // Remove formatting and convert to number
    const numericValue = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(numericValue) || 0;
  };

  // Calculate total debt
  const totalDebt = useMemo(() => {
    return debts.reduce((sum, debt) => {
      // Simulate current outstanding balance (for demo purposes)
      const currentYear = new Date().getFullYear();
      const releaseYear = new Date(debt.releaseDate).getFullYear();
      const dueYear = new Date(debt.dueDate).getFullYear();
      
      if (currentYear < releaseYear || currentYear > dueYear) return sum;
      
      const totalYears = dueYear - releaseYear;
      const yearsElapsed = currentYear - releaseYear;
      const remainingBalance = debt.financedAmount * (1 - yearsElapsed / totalYears);
      
      return sum + Math.max(0, remainingBalance);
    }, 0);
  }, [debts]);

  const cashValue = parseCurrencyInput(cashBalance);
  const netDebt = totalDebt - cashValue;
  const isPositive = netDebt > 0;

  const handleCashBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatInput(e.target.value);
    setCashBalance(formattedValue);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Cash Balance Input */}
      <Card className="bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            Saldo de Caixa Atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cash-balance" className="text-sm font-medium">
              Informe o saldo de caixa disponível
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="cash-balance"
                type="text"
                value={cashBalance}
                onChange={handleCashBalanceChange}
                placeholder="0,00"
                className="pl-10 text-lg font-medium"
              />
            </div>
          </div>
          
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor informado:</span>
              <span className="font-bold text-lg text-foreground">
                {formatCurrency(cashValue)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Net Debt Calculation */}
      <Card className="bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isPositive ? 'bg-red-100 dark:bg-red-900/20' : 'bg-green-100 dark:bg-green-900/20'}`}>
              {isPositive ? (
                <TrendingUp className="h-5 w-5 text-red-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-green-600" />
              )}
            </div>
            Dívida Líquida
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total de Dívidas:</span>
              <span className="font-medium text-foreground">
                {formatCurrency(totalDebt)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">(-) Saldo de Caixa:</span>
              <span className="font-medium text-foreground">
                {formatCurrency(cashValue)}
              </span>
            </div>
            
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Dívida Líquida:</span>
                <span className={`font-bold text-xl ${isPositive ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(Math.abs(netDebt))}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isPositive 
                  ? "Você possui mais dívidas do que caixa disponível"
                  : netDebt === 0
                  ? "Suas dívidas estão equilibradas com o caixa"
                  : "Você possui mais caixa do que dívidas"
                }
              </p>
            </div>
          </div>

          {/* Debt-to-Cash Ratio */}
          {cashValue > 0 && (
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Índice Dívida/Caixa:</span>
                <span className="font-bold text-lg text-foreground">
                  {(totalDebt / cashValue).toFixed(2)}x
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalDebt / cashValue > 1 
                  ? "Suas dívidas são maiores que o caixa disponível"
                  : "Seu caixa é suficiente para cobrir as dívidas"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};