import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useState, useMemo } from "react";
import { PieChart as PieChartIcon, Calendar } from "lucide-react";

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
  const [selectedBank, setSelectedBank] = useState<string>('all');
  const [selectedDebt, setSelectedDebt] = useState<string>('all');
  const [dateType, setDateType] = useState<'today' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Get unique banks
  const availableBanks = useMemo(() => {
    return [...new Set(debts.map(debt => debt.bank))];
  }, [debts]);

  // Get filtered debts for debt selection
  const availableDebts = useMemo(() => {
    if (selectedBank === 'all') return debts;
    return debts.filter(debt => debt.bank === selectedBank);
  }, [debts, selectedBank]);

  // Calculate short-term vs long-term debt profile based on PMTs
  const chartData = useMemo(() => {
    const baseDate = dateType === 'today' ? new Date() : new Date(customDate);
    const currentYear = baseDate.getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => currentYear + i);
    
    return years.map(year => {
      let filteredDebts = debts;
      
      // Apply filters
      if (selectedBank !== 'all') {
        filteredDebts = filteredDebts.filter(debt => debt.bank === selectedBank);
      }
      if (selectedDebt !== 'all') {
        filteredDebts = filteredDebts.filter(debt => debt.id === selectedDebt);
      }

      let shortTermPMTs = 0;
      let longTermPMTs = 0;

      filteredDebts.forEach(debt => {
        const releaseDate = new Date(debt.releaseDate);
        const dueDate = new Date(debt.dueDate);
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        
        // Check if debt is active during this year
        if (yearEnd < releaseDate || yearStart > dueDate) return;
        
        // Calculate monthly payment based on calculation table
        const totalMonths = Math.round((dueDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        let monthlyPayment = 0;
        
        if (debt.calculationTable === 'PRICE') {
          // PRICE - Fixed installments
          const monthlyRate = debt.interestType === 'annual' 
            ? Math.pow(1 + debt.interestRate / 100, 1/12) - 1
            : debt.interestRate / 100;
          if (monthlyRate > 0) {
            monthlyPayment = debt.financedAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
          } else {
            monthlyPayment = debt.financedAmount / totalMonths;
          }
        } else {
          // SAC - Decreasing installments (use average for simplification)
          const monthlyRate = debt.interestType === 'annual' 
            ? Math.pow(1 + debt.interestRate / 100, 1/12) - 1
            : debt.interestRate / 100;
          const amortization = debt.financedAmount / totalMonths;
          const avgInterest = debt.financedAmount * monthlyRate * 0.5; // Average interest
          monthlyPayment = amortization + avgInterest;
        }
        
        // Calculate payments for this specific year
        const paymentStartDate = new Date(Math.max(yearStart.getTime(), releaseDate.getTime()));
        const paymentEndDate = new Date(Math.min(yearEnd.getTime(), dueDate.getTime()));
        
        if (paymentStartDate <= paymentEndDate) {
          const monthsInYear = Math.round((paymentEndDate.getTime() - paymentStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)) + 1;
          const yearlyPMT = monthlyPayment * Math.min(monthsInYear, 12);
          
          // Classify based on time to maturity from year start
          const monthsToMaturity = Math.round((dueDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
          
          if (monthsToMaturity <= 12) {
            shortTermPMTs += yearlyPMT;
          } else {
            longTermPMTs += yearlyPMT;
          }
        }
      });

      const totalPMTs = shortTermPMTs + longTermPMTs;
      
      return {
        year: year.toString(),
        shortTerm: totalPMTs > 0 ? (shortTermPMTs / totalPMTs) * 100 : 0,
        longTerm: totalPMTs > 0 ? (longTermPMTs / totalPMTs) * 100 : 0,
        shortTermAmount: shortTermPMTs,
        longTermAmount: longTermPMTs,
        totalAmount: totalPMTs
      };
    });
  }, [debts, selectedBank, selectedDebt, dateType, customDate]);

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
              <span className="inline-block w-3 h-3 bg-muted rounded mr-2"></span>
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

  return (
    <Card className="bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
      <CardHeader>
        <CardTitle className="text-lg text-foreground flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <PieChartIcon className="h-5 w-5 text-primary" />
          </div>
          Perfil da Dívida
        </CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Banco</Label>
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os bancos</SelectItem>
                {availableBanks.map(bank => (
                  <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium">Dívida</Label>
            <Select value={selectedDebt} onValueChange={setSelectedDebt}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as dívidas</SelectItem>
                {availableDebts.map(debt => (
                  <SelectItem key={debt.id} value={debt.id}>
                    {debt.contractNumber || `${debt.bank} - ${formatCurrency(debt.financedAmount)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Data Base</Label>
            <Select value={dateType} onValueChange={(value: 'today' | 'custom') => setDateType(value)}>
              <SelectTrigger>
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
                  className="flex-1"
                />
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
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
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            
            <Bar 
              dataKey="shortTerm" 
              stackId="debt" 
              fill="hsl(var(--muted-foreground))"
              name="Curto Prazo"
            />
            <Bar 
              dataKey="longTerm" 
              stackId="debt" 
              fill="hsl(var(--muted))"
              name="Longo Prazo"
            />
          </BarChart>
        </ResponsiveContainer>
        
        <div className="flex items-center justify-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-muted-foreground rounded"></div>
            <span>Curto Prazo (≤12 meses)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-muted rounded"></div>
            <span>Longo Prazo ({'>'}12 meses)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};