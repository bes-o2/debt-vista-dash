import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { useState, useMemo } from "react";
import { PieChart as PieChartIcon, Calendar } from "lucide-react";
import { getBankColor } from "@/lib/utils";
import { useDebtInstallments } from "@/hooks/useDebtInstallments";

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

interface DebtProfileChartProps {
  debts: Debt[];
}

export const DebtProfileChart = ({ debts }: DebtProfileChartProps) => {
  // State management for date filtering only
  const [dateType, setDateType] = useState<'today' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Get installments data
  const { installmentsData, loading } = useDebtInstallments(debts);

  // Calculate short-term vs long-term debt profile by bank based on actual amortization
  const chartData = useMemo(() => {
    const baseDate = dateType === 'today' ? new Date() : new Date(customDate);
    const twelveMonthsFromBase = new Date(baseDate);
    twelveMonthsFromBase.setMonth(twelveMonthsFromBase.getMonth() + 12);
    
    // Group debts by bank
    const bankGroups = debts.reduce((acc, debt) => {
      const groupKey = debt.bank || 'Sem Nome';
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(debt);
      return acc;
    }, {} as Record<string, Debt[]>);
    
    // Calculate amortization for each bank
    return Object.entries(bankGroups).map(([bankName, bankDebts]) => {
      let shortTermAmortization = 0;
      let longTermAmortization = 0;

      bankDebts.forEach(debt => {
        const debtInstallments = installmentsData[debt.id] || [];
        
        debtInstallments.forEach(installment => {
          const dueDate = new Date(installment.due_date);
          
          // Only consider future installments from base date
          if (dueDate >= baseDate) {
            const principalAmount = Number(installment.principal_amount);
            
            if (dueDate < twelveMonthsFromBase) {
              // Short-term: amortization in next 12 months
              shortTermAmortization += principalAmount;
            } else {
              // Long-term: amortization beyond 12 months
              longTermAmortization += principalAmount;
            }
          }
        });
      });

      const totalAmortization = shortTermAmortization + longTermAmortization;
      
      return {
        bank: bankName,
        shortTerm: totalAmortization > 0 ? (shortTermAmortization / totalAmortization) * 100 : 0,
        longTerm: totalAmortization > 0 ? (longTermAmortization / totalAmortization) * 100 : 0,
        shortTermAmount: shortTermAmortization,
        longTermAmount: longTermAmortization,
        totalAmount: totalAmortization
      };
    });
  }, [debts, dateType, customDate, installmentsData]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="inline-block w-3 h-3 bg-muted-foreground rounded mr-2"></span>
              Curto Prazo (≤12 meses): {data?.shortTerm?.toFixed(0)}% ({formatCurrency(data?.shortTermAmount || 0)})
            </p>
            <p className="text-sm">
              <span className="inline-block w-3 h-3 rounded mr-2" style={{ backgroundColor: "hsl(280 100% 60%)" }}></span>
              Longo Prazo ({'>'}12 meses): {data?.longTerm?.toFixed(0)}% ({formatCurrency(data?.longTermAmount || 0)})
            </p>
            <p className="text-sm font-medium text-muted-foreground mt-2">
              Total: {formatCurrency(data?.totalAmount || 0)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderLabel = (props: any, dataKey: 'shortTerm' | 'longTerm') => {
    const { x, y, width, height, value, payload } = props;
    
    // Safety checks - only render if there's enough space
    if (!payload || height < 35) return null;
    
    const amount = dataKey === 'shortTerm' ? payload.shortTermAmount : payload.longTermAmount;
    
    // Don't render if amount is not available or is zero
    if (!amount || amount === 0) return null;
    
    const formattedAmount = new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
    
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        fill="white"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={14}
        fontWeight="bold"
        style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.9)' }}
      >
        <tspan x={x + width / 2} dy="-0.6em">{value.toFixed(0)}%</tspan>
        <tspan x={x + width / 2} dy="1.4em" fontSize={12}>{formattedAmount}</tspan>
      </text>
    );
  };

  return (
    <Card className="bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <PieChartIcon className="h-5 w-5 text-primary" />
            </div>
            Perfil da Dívida
          </CardTitle>
          
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Data Base</Label>
              <Select value={dateType} onValueChange={(value: 'today' | 'custom') => setDateType(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">● Hoje</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateType === 'custom' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Data</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="bank" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            
            <Bar 
              dataKey="shortTerm" 
              stackId="debt" 
              fill="hsl(var(--muted-foreground))"
              name="Curto Prazo"
            >
              <LabelList content={(props) => renderLabel(props, 'shortTerm')} />
            </Bar>
            <Bar 
              dataKey="longTerm" 
              stackId="debt" 
              fill="hsl(280 100% 60%)"
              name="Longo Prazo"
            >
              <LabelList content={(props) => renderLabel(props, 'longTerm')} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        <div className="flex items-center justify-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-muted-foreground rounded"></div>
            <span>Curto Prazo (≤12 meses)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(280 100% 60%)" }}></div>
            <span>Longo Prazo ({'>'}12 meses)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};