import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, LineChart, Line, ComposedChart } from "recharts";
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
  const [viewType, setViewType] = useState<'annual' | 'total'>('annual');
  
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
    const latestDate = new Date(Math.max(...debts.map(d => new Date(d.dueDate).getTime())));
    
    // Determine end date based on view type
    const today = new Date();
    const endDate = viewType === 'annual' 
      ? new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
      : latestDate;
    const startDate = viewType === 'annual' ? today : earliestDate;
    
    // Generate monthly data from start to end for better granularity
    const months = [];
    const currentDate = new Date(startDate);
    currentDate.setDate(1); // Start from first day of month
    
    while (currentDate <= endDate) {
      months.push(new Date(currentDate));
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return months.map(date => {
      const monthData: any = { 
        month: date.toISOString().substring(0, 7), // YYYY-MM format
        displayMonth: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
      };
      
      // Calculate total PMT for this month (sum of all active contracts' payments)
      let totalPMT = 0;
      
      banks.forEach(bank => {
        const bankDebts = debts.filter(d => d.bank === bank.name);
        const bankBalance = bankDebts.reduce((sum, debt) => {
          const debtInstallments = installmentsData[debt.id];
          if (!debtInstallments || debtInstallments.length === 0) {
            return sum;
          }

          // Check if the debt has been released yet (compare month/year only)
          const releaseDate = new Date(debt.releaseDate);
          const releaseDateMonth = releaseDate.toISOString().substring(0, 7); // YYYY-MM
          const currentMonth = date.toISOString().substring(0, 7); // YYYY-MM
          
          if (currentMonth < releaseDateMonth) {
            // Contract not released yet, no balance
            return sum;
          }

          // Check if this debt is still active in this month for PMT calculation
          const firstInstallmentDate = new Date(debtInstallments[0].due_date);
          const lastInstallmentDate = new Date(debtInstallments[debtInstallments.length - 1].due_date);
          
          // If the current month is within the debt's payment period
          if (date >= firstInstallmentDate && date <= lastInstallmentDate) {
            // Find the installment for this specific month
            const monthInstallment = debtInstallments.find(inst => 
              inst.due_date.substring(0, 7) === currentMonth
            );
            
            if (monthInstallment) {
              totalPMT += monthInstallment.total_amount;
            }
          }

          // Calculate remaining balance for this month
          // Find installments that were due before or in this month
          const installmentsBeforeTarget = debtInstallments.filter(inst => 
            inst.due_date.substring(0, 7) <= currentMonth
          );

          if (installmentsBeforeTarget.length === 0) {
            // No installments due yet, but contract is released - return full financed amount
            return sum + debt.financedAmount;
          }

          // Get the last installment before or in the target month
          const lastInstallment = installmentsBeforeTarget[installmentsBeforeTarget.length - 1];
          
          // Return the remaining balance after this installment
          return sum + Math.max(0, lastInstallment.remaining_balance);
        }, 0);
        
        monthData[bank.name] = bankBalance;
      });
      
      monthData.totalPMT = totalPMT;
      
      return monthData;
    });
  }, [debts, banks, viewType, installmentsData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pmtData = payload.find((p: any) => p.dataKey === 'totalPMT');
      const balanceData = payload.filter((p: any) => p.dataKey !== 'totalPMT');
      
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          {balanceData.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey}: {formatCurrency(entry.value)}
            </p>
          ))}
          {pmtData && (
            <p className="text-sm text-destructive font-medium border-t pt-1 mt-1">
              PMT Total: {formatCurrency(pmtData.value)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom label function to format values inside bars
  const renderCustomLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    
    // Hide labels in "Total" view
    if (viewType === 'total') return null;
    
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
          <div className="flex items-center gap-2">
            <Button
              variant={viewType === 'annual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewType('annual')}
            >
              Anual
            </Button>
            <Button
              variant={viewType === 'total' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewType('total')}
            >
              Total
            </Button>
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
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="displayMonth" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={viewType === 'annual' ? 0 : Math.ceil(chartData.length / 12)}
              />
              <YAxis 
                yAxisId="balance"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
              />
              <YAxis 
                yAxisId="pmt"
                orientation="right"
                stroke="hsl(var(--destructive))"
                fontSize={12}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {banks.map((bank, index) => (
                <Bar
                  key={bank.name}
                  yAxisId="balance"
                  dataKey={bank.name}
                  stackId="debt"
                  fill={bank.color}
                  name={bank.name}
                >
                  <LabelList content={renderCustomLabel} />
                </Bar>
              ))}
              
              <Line
                yAxisId="pmt"
                type="monotone"
                dataKey="totalPMT"
                stroke="hsl(var(--destructive))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--destructive))", strokeWidth: 2, r: 4 }}
                name="PMT Total Mensal"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};