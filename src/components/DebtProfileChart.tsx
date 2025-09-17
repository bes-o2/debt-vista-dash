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

  // Calculate short-term vs long-term debt profile
  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i);
    
    return years.map(year => {
      let filteredDebts = debts;
      
      // Apply filters
      if (selectedBank !== 'all') {
        filteredDebts = filteredDebts.filter(debt => debt.bank === selectedBank);
      }
      if (selectedDebt !== 'all') {
        filteredDebts = filteredDebts.filter(debt => debt.id === selectedDebt);
      }

      let shortTermAmount = 0;
      let longTermAmount = 0;

      filteredDebts.forEach(debt => {
        const releaseYear = new Date(debt.releaseDate).getFullYear();
        const dueYear = new Date(debt.dueDate).getFullYear();
        
        if (year < releaseYear || year > dueYear) return;
        
        // Simulate outstanding balance
        const totalYears = dueYear - releaseYear;
        const yearsElapsed = year - releaseYear;
        const remainingBalance = debt.financedAmount * (1 - yearsElapsed / totalYears);
        const balance = Math.max(0, remainingBalance);
        
        // Classify as short-term (<=1 year) or long-term (>1 year)
        const yearsToMaturity = dueYear - year;
        if (yearsToMaturity <= 1) {
          shortTermAmount += balance;
        } else {
          longTermAmount += balance;
        }
      });

      const totalAmount = shortTermAmount + longTermAmount;
      
      return {
        year: year.toString(),
        shortTerm: totalAmount > 0 ? (shortTermAmount / totalAmount) * 100 : 0,
        longTerm: totalAmount > 0 ? (longTermAmount / totalAmount) * 100 : 0,
        shortTermAmount,
        longTermAmount,
        totalAmount
      };
    });
  }, [debts, selectedBank, selectedDebt]);

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
              Curto Prazo: {data?.shortTerm?.toFixed(0)}% ({formatCurrency(data?.shortTermAmount || 0)})
            </p>
            <p className="text-sm">
              <span className="inline-block w-3 h-3 bg-muted rounded mr-2"></span>
              Longo Prazo: {data?.longTerm?.toFixed(0)}% ({formatCurrency(data?.longTermAmount || 0)})
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
            <span>Curto Prazo (≤1 ano)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-muted rounded"></div>
            <span>Longo Prazo (&gt;1 ano)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};