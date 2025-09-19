import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { useState, useMemo } from "react";
import { Building, Calendar, Loader2 } from "lucide-react";
import { getBankColor } from "@/lib/utils";
import { useDebtInstallments } from "@/hooks/useDebtInstallments";
import { normalizeDebtForCalculation } from "@/lib/debtUtils";
import { type LegacyDebt } from "@/hooks/useDebts";

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

interface OutstandingBalanceChartProps {
  debts: LegacyDebt[];
}

export const OutstandingBalanceChart = ({ debts }: OutstandingBalanceChartProps) => {
  const [dateType, setDateType] = useState<'today' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(new Date().getFullYear().toString());
  
  // Use the hook to get real installment data
  const normalizedDebts = debts.map(normalizeDebtForCalculation);
  const { installmentsData, loading: installmentsLoading } = useDebtInstallments(normalizedDebts);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);

  // Get unique banks and their colors using real bank colors
  const banks = useMemo(() => {
    const uniqueBanks = [...new Set(debts.map(debt => debt.bank))];
    return uniqueBanks.map((bank) => ({
      name: bank,
      color: getBankColor(bank)
    }));
  }, [debts]);

  // Calculate outstanding balance by bank over time using real installment data
  const chartData = useMemo(() => {
    if (debts.length === 0 || Object.keys(installmentsData).length === 0) return [];

    // Find the earliest release date and latest due date
    const earliestDate = new Date(Math.min(...debts.map(d => new Date(d.releaseDate).getTime())));
    
    // Determine end date based on selection
    const endDate = dateType === 'today' ? new Date() : new Date(`${customDate}-12-31`);
    const startDate = earliestDate;
    
    // Generate yearly data from start to end
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
    
    return years.map(year => {
      const yearData: any = { year: year.toString() };
      const targetDate = new Date(year, 11, 31); // December 31st of the year

      banks.forEach(bank => {
        const bankDebts = debts.filter(d => d.bank === bank.name);
        const bankBalance = bankDebts.reduce((sum, debt) => {
          const debtInstallments = installmentsData[debt.id];
          if (!debtInstallments || debtInstallments.length === 0) {
            return sum;
          }

          // Find the installment that would be due just after our target date
          // or the last installment if all are before the target date
          const installmentsBeforeTarget = debtInstallments.filter(inst => 
            new Date(inst.due_date) <= targetDate
          );

          if (installmentsBeforeTarget.length === 0) {
            // If no installments are due yet, return the full financed amount
            return sum + debt.financedAmount;
          }

          // Get the last installment before or on the target date
          const lastInstallment = installmentsBeforeTarget[installmentsBeforeTarget.length - 1];
          
          // Return the remaining balance after this installment
          return sum + Math.max(0, lastInstallment.remaining_balance);
        }, 0);
        
        yearData[bank.name] = bankBalance;
      });
      
      return yearData;
    });
  }, [debts, banks, dateType, customDate, installmentsData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom label function to format values inside bars
  const renderCustomLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    
    // Only show label if value is significant and bar is tall enough
    if (value < 10000 || height < 30) return null;
    
    const formattedValue = value >= 1000000 
      ? `${(value / 1000000).toFixed(1)}M`
      : value >= 1000 
      ? `${(value / 1000).toFixed(0)}K`
      : value.toFixed(0);
    
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        fill="white"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={12}
        fontWeight="bold"
        style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
      >
        {formattedValue}
      </text>
    );
  };

  return (
    <Card className="bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building className="h-5 w-5 text-primary" />
            </div>
            Saldo Devedor por Banco
          </CardTitle>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium">Data Base:</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dateType"
                    value="today"
                    checked={dateType === 'today'}
                    onChange={(e) => setDateType(e.target.value as 'today' | 'custom')}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Hoje</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dateType"
                    value="custom"
                    checked={dateType === 'custom'}
                    onChange={(e) => setDateType(e.target.value as 'today' | 'custom')}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Personalizado</span>
                </label>
              </div>
            </div>
            {dateType === 'custom' && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="2000"
                  max="2050"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  placeholder="Ano"
                  className="w-24"
                />
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {installmentsLoading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Carregando dados de parcelas...</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="year" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {banks.map((bank, index) => (
              <Bar
                key={bank.name}
                dataKey={bank.name}
                stackId="debt"
                fill={bank.color}
                name={bank.name}
              >
                <LabelList content={renderCustomLabel} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};