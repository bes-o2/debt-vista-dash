import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, DollarSign, BarChart3, Filter, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Debt {
  id: string;
  bank: string;
  financedAmount: number;
  releaseDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  indexer?: string;
  interestRate: number;
  interestType: 'monthly' | 'annual';
  iofAmount?: number;
  tacAmount?: number;
  contractNumber?: string;
}

interface Installment {
  installment_number: number;
  due_date: string;
  principal_balance: number;
  amortization: number;
  interest_amount: number;
  installment_amount: number;
}

interface CashFlowAnalysisProps {
  debts: Debt[];
}

interface ChartDataPoint {
  month: string;
  totalBalance: number;
  totalAmortization: number;
  totalInterest: number;
  totalPayment: number;
  monthNumber: number;
}

export function CashFlowAnalysis({ debts }: CashFlowAnalysisProps) {
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [selectedDebts, setSelectedDebts] = useState<string[]>([]);
  const [analysisType, setAnalysisType] = useState<'absolute' | 'accumulated' | 'bank_comparison'>('bank_comparison');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Get unique banks
  const availableBanks = useMemo(() => {
    return [...new Set(debts.map(debt => debt.bank))];
  }, [debts]);

  // Filter debts based on selected banks
  const filteredDebts = useMemo(() => {
    if (selectedBanks.length === 0) return debts;
    return debts.filter(debt => selectedBanks.includes(debt.bank));
  }, [debts, selectedBanks]);

  // Get final debt selection
  const finalDebts = useMemo(() => {
    if (selectedDebts.length === 0) return filteredDebts;
    return filteredDebts.filter(debt => selectedDebts.includes(debt.id));
  }, [filteredDebts, selectedDebts]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: value > 1000000 ? 'compact' : 'standard'
    }).format(value);
  };

  const calculateCashFlow = async () => {
    if (finalDebts.length === 0) {
      toast({
        title: "Selecione pelo menos uma dívida",
        description: "É necessário selecionar dívidas para gerar a análise.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const allInstallments: { [debtId: string]: Installment[] } = {};

      // Calculate installments for each selected debt
      for (const debt of finalDebts) {
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

        if (error) throw error;
        allInstallments[debt.id] = data.installments;
      }

      // Aggregate data by month
      const monthlyData: { [month: string]: ChartDataPoint } = {};
      
      Object.values(allInstallments).forEach((installments) => {
        installments.forEach((installment) => {
          const date = new Date(installment.due_date);
          const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
          const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
              month: monthLabel,
              totalBalance: 0,
              totalAmortization: 0,
              totalInterest: 0,
              totalPayment: 0,
              monthNumber: installment.installment_number
            };
          }

          monthlyData[monthKey].totalBalance += installment.principal_balance;
          monthlyData[monthKey].totalAmortization += installment.amortization;
          monthlyData[monthKey].totalInterest += installment.interest_amount;
          monthlyData[monthKey].totalPayment += installment.installment_amount;
        });
      });

      // Convert to array and sort by date
      const sortedData = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([_, data]) => data);

      // Apply date filter
      let filteredData = sortedData;
      if (startDate || endDate) {
        filteredData = sortedData.filter(point => {
          const [year, month] = point.month.replace(/(\w+)\/(\d+)/, (_, m, y) => {
            const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 
                              'jul', 'ago', 'set', 'out', 'nov', 'dez'];
            const monthIndex = monthNames.indexOf(m.toLowerCase()) + 1;
            return `20${y}-${monthIndex.toString().padStart(2, '0')}`;
          }).split('-');
          const pointDate = `${year}-${month}`;
          
          if (startDate && endDate) {
            return pointDate >= startDate && pointDate <= endDate;
          } else if (startDate) {
            return pointDate >= startDate;
          } else if (endDate) {
            return pointDate <= endDate;
          }
          return true;
        });
      }

      // Apply analysis type (accumulated vs absolute)
      if (analysisType === 'accumulated') {
        let accAmortization = 0;
        let accInterest = 0;
        let accPayment = 0;
        
        filteredData = filteredData.map(point => {
          accAmortization += point.totalAmortization;
          accInterest += point.totalInterest;
          accPayment += point.totalPayment;
          
          return {
            ...point,
            totalAmortization: accAmortization,
            totalInterest: accInterest,
            totalPayment: accPayment
          };
        });
      }

      setChartData(filteredData);
      
      toast({
        title: "Análise gerada com sucesso!",
        description: `${filteredData.length} períodos analisados para ${finalDebts.length} dívida(s).`
      });

    } catch (error) {
      console.error('Error calculating cash flow:', error);
      toast({
        title: "Erro na análise",
        description: "Não foi possível gerar a análise de fluxo de caixa.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBankToggle = (bank: string) => {
    setSelectedBanks(prev => 
      prev.includes(bank) 
        ? prev.filter(b => b !== bank)
        : [...prev, bank]
    );
    setSelectedDebts([]); // Reset debt selection when banks change
  };

  const handleDebtToggle = (debtId: string) => {
    setSelectedDebts(prev => 
      prev.includes(debtId) 
        ? prev.filter(id => id !== debtId)
        : [...prev, debtId]
    );
  };

  const selectAllBanks = () => {
    setSelectedBanks(availableBanks);
    setSelectedDebts([]);
  };

  const clearBankSelection = () => {
    setSelectedBanks([]);
    setSelectedDebts([]);
  };

  const selectAllDebts = () => {
    setSelectedDebts(filteredDebts.map(debt => debt.id));
  };

  const clearDebtSelection = () => {
    setSelectedDebts([]);
  };

  const getSummaryStats = () => {
    if (chartData.length === 0) return null;

    const lastMonth = chartData[chartData.length - 1];
    const totalPayments = chartData.reduce((sum, month) => sum + month.totalPayment, 0);
    const totalInterests = chartData.reduce((sum, month) => sum + month.totalInterest, 0);

    return {
      remainingBalance: lastMonth.totalBalance,
      totalPayments: analysisType === 'accumulated' ? lastMonth.totalPayment : totalPayments,
      totalInterests: analysisType === 'accumulated' ? lastMonth.totalInterest : totalInterests,
      periodsAnalyzed: chartData.length
    };
  };

  const stats = getSummaryStats();

  return (
    <div className="space-y-6">
      {/* Header without gradients */}
      <div className="rounded-3xl bg-card p-8 border border-border">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-primary/10">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              Análise de Fluxo de Caixa
            </h2>
            <p className="text-muted-foreground">
              Projeção financeira e análise de amortização das dívidas selecionadas
            </p>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bank Selection */}
        <Card className="border-2 border-muted/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5 text-primary" />
                Seleção de Bancos
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllBanks}
                  className="text-xs hover:bg-primary/10"
                >
                  Todos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearBankSelection}
                  className="text-xs hover:bg-destructive/10"
                >
                  Limpar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableBanks.map((bank) => (
              <div key={bank} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id={bank}
                  checked={selectedBanks.includes(bank)}
                  onCheckedChange={() => handleBankToggle(bank)}
                />
                <label htmlFor={bank} className="text-sm font-medium cursor-pointer flex-1">
                  {bank}
                </label>
                <Badge variant="outline" className="text-xs">
                  {debts.filter(d => d.bank === bank).length}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Debt Selection */}
        <Card className="border-2 border-muted/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                Dívidas Específicas
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllDebts}
                  className="text-xs hover:bg-primary/10"
                  disabled={filteredDebts.length === 0}
                >
                  Todas
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearDebtSelection}
                  className="text-xs hover:bg-destructive/10"
                >
                  Limpar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredDebts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Selecione pelo menos um banco primeiro
              </p>
            ) : (
              filteredDebts.map((debt) => (
                <div key={debt.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id={debt.id}
                    checked={selectedDebts.includes(debt.id)}
                    onCheckedChange={() => handleDebtToggle(debt.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor={debt.id} className="text-sm font-medium cursor-pointer block truncate">
                      {formatCurrency(debt.financedAmount)}
                      {debt.contractNumber && (
                        <span className="text-xs text-muted-foreground ml-2">
                          #{debt.contractNumber}
                        </span>
                      )}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {debt.calculationTable} • {debt.interestRate}% {debt.interestType === 'monthly' ? 'a.m.' : 'a.a.'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Analysis Configuration */}
        <Card className="border-2 border-muted/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Configurações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período de Análise</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Data Inicial</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="Data inicial"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data Final</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="Data final"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Análise</label>
              <Select value={analysisType} onValueChange={(value: any) => setAnalysisType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_comparison">Comparativo entre Bancos</SelectItem>
                  <SelectItem value="absolute">Valores Mensais</SelectItem>
                  <SelectItem value="accumulated">Valores Acumulados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <Button 
              onClick={calculateCashFlow}
              className="w-full"
              disabled={loading || finalDebts.length === 0}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Calculando...' : 'Gerar Análise'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Saldo Remanescente</span>
              </div>
              <p className="text-xl font-bold text-primary">{formatCurrency(stats.remainingBalance)}</p>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-muted-foreground">Total Pago</span>
              </div>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(stats.totalPayments)}</p>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-muted-foreground">Total Juros</span>
              </div>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.totalInterests)}</p>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-muted-foreground">Períodos</span>
              </div>
              <p className="text-xl font-bold text-blue-600">{stats.periodsAnalyzed} meses</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="border-2 border-muted/50 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Evolução do Fluxo de Caixa
              <Badge variant="outline" className="ml-auto">
                {analysisType === 'accumulated' ? 'Acumulado' : analysisType === 'bank_comparison' ? 'Comparativo' : 'Mensal'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="balance"
                    orientation="left"
                    tickFormatter={formatCurrency}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="payments"
                    orientation="right"
                    tickFormatter={formatCurrency}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  
                  <Line
                    yAxisId="balance"
                    type="monotone"
                    dataKey="totalBalance"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={false}
                    name="Saldo Devedor"
                  />
                  <Bar
                    yAxisId="payments"
                    dataKey="totalAmortization"
                    fill="hsl(var(--chart-2))"
                    name="Amortização"
                    opacity={0.8}
                  />
                  <Bar
                    yAxisId="payments"
                    dataKey="totalInterest"
                    fill="hsl(var(--chart-3))"
                    name="Juros"
                    opacity={0.8}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {chartData.length === 0 && !loading && (
        <Card className="border-2 border-dashed border-muted-foreground/25">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <BarChart3 className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Nenhuma análise gerada
              </h3>
              <p className="text-muted-foreground mb-4">
                Selecione bancos e dívidas, configure o período e clique em "Gerar Análise"
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}