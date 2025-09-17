import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useState, useMemo } from "react";
import { Building, Calendar } from "lucide-react";

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
  debts: Debt[];
}

const COLORS = [
  'hsl(var(--chart-1))', 
  'hsl(var(--chart-2))', 
  'hsl(var(--chart-3))',  
  'hsl(var(--chart-4))',   
  'hsl(var(--chart-5))', 
  'hsl(214 84% 56%)', 
  'hsl(35 91% 62%)',  
];

export const OutstandingBalanceChart = ({ debts }: OutstandingBalanceChartProps) => {
  const [dateType, setDateType] = useState<'today' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);

  // Get unique banks and their colors
  const banks = useMemo(() => {
    const uniqueBanks = [...new Set(debts.map(debt => debt.bank))];
    return uniqueBanks.map((bank, index) => ({
      name: bank,
      color: COLORS[index % COLORS.length]
    }));
  }, [debts]);

  // Calculate outstanding balance by bank over time
  const chartData = useMemo(() => {
    if (debts.length === 0) return [];

    // Find the earliest release date and latest due date
    const earliestDate = new Date(Math.min(...debts.map(d => new Date(d.releaseDate).getTime())));
    const latestDate = new Date(Math.max(...debts.map(d => new Date(d.dueDate).getTime())));
    
    // Determine end date based on selection
    const endDate = dateType === 'today' ? new Date() : new Date(customDate);
    const startDate = dateType === 'today' ? earliestDate : earliestDate;
    
    // Generate yearly data from start to end
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
    
    return years.map(year => {
      const yearData: any = { year: year.toString() };

      banks.forEach(bank => {
        const bankDebts = debts.filter(d => d.bank === bank.name);
        const bankBalance = bankDebts.reduce((sum, debt) => {
          const releaseYear = new Date(debt.releaseDate).getFullYear();
          const dueYear = new Date(debt.dueDate).getFullYear();
          
          // Skip if debt hasn't started or has ended
          if (year < releaseYear || year > dueYear) return sum;
          
          const totalYears = dueYear - releaseYear;
          const yearsElapsed = year - releaseYear;
          
          // Linear amortization
          const remainingBalance = totalYears > 0 
            ? debt.financedAmount * (1 - yearsElapsed / totalYears)
            : debt.financedAmount;
          
          return sum + Math.max(0, remainingBalance);
        }, 0);
        
        yearData[bank.name] = bankBalance;
      });
      
      return yearData;
    });
  }, [debts, banks, dateType, customDate]);

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
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-40"
                />
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};