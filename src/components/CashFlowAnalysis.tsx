import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { DateInput } from '@/components/ui/date-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, DollarSign, BarChart3, Filter, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PaymentScheduleTable } from '@/components/PaymentScheduleTable';
import { useDebtInstallments } from '@/hooks/useDebtInstallments';
import { normalizeDebtForCalculation, debtIntersectsDateRange } from '@/lib/debtUtils';

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
  preSelectedDebt?: Debt | null;
  onClearPreSelection?: () => void;
  periodMode?: "vigencia" | "vencimento";
  globalStartDate?: Date;
  globalEndDate?: Date;
}

interface ChartDataPoint {
  month: string;
  isoMonth: string;
  totalBalance: number;
  totalAmortization: number;
  totalInterest: number;
  monthNumber: number;
}

export function CashFlowAnalysis({ debts, preSelectedDebt, onClearPreSelection, periodMode, globalStartDate, globalEndDate }: CashFlowAnalysisProps) {
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [selectedDebts, setSelectedDebts] = useState<string[]>([]);
  const [analysisType, setAnalysisType] = useState<'absolute' | 'accumulated'>('absolute');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [rawChartData, setRawChartData] = useState<ChartDataPoint[]>([]);

  const chartData = useMemo(() => {
    if (rawChartData.length === 0) return [];
    if (analysisType === 'accumulated') {
      let accAmortization = 0, accInterest = 0;
      return rawChartData.map(point => {
        accAmortization += point.totalAmortization;
        accInterest += point.totalInterest;
        return { ...point, totalAmortization: accAmortization, totalInterest: accInterest };
      });
    }
    return rawChartData;
  }, [rawChartData, analysisType]);
  const { toast } = useToast();

  // Use the shared hook to get real installment data
  const normalizedDebts = useMemo(
    () => debts.map(normalizeDebtForCalculation),
    [debts]
  );
  const { installmentsData, loading: installmentsLoading } = useDebtInstallments(normalizedDebts);

  // Effect to handle pre-selected debt
  useEffect(() => {
    if (preSelectedDebt) {
      // Set the bank of the pre-selected debt
      setSelectedBanks([preSelectedDebt.bank]);
      // Set the specific debt
      setSelectedDebts([preSelectedDebt.id]);
      // Clear the pre-selection
      if (onClearPreSelection) {
        onClearPreSelection();
      }
    }
  }, [preSelectedDebt, onClearPreSelection]);


  // Get unique banks
  const availableBanks = useMemo(() => {
    return [...new Set(debts.map(debt => debt.bank))];
  }, [debts]);

  // Filter debts based on selected banks (+ vigencia mode applies global date range)
  const filteredDebts = useMemo(() => {
    let result = selectedBanks.length === 0 ? debts : debts.filter(debt => selectedBanks.includes(debt.bank));
    if (periodMode === "vigencia" && (globalStartDate || globalEndDate)) {
      result = result.filter(debt => debtIntersectsDateRange(debt, globalStartDate, globalEndDate));
    }
    return result;
  }, [debts, selectedBanks, periodMode, globalStartDate, globalEndDate]);

  // Get final debt selection
  const finalDebts = useMemo(() => {
    if (selectedDebts.length === 0) return filteredDebts;
    return filteredDebts.filter(debt => selectedDebts.includes(debt.id));
  }, [filteredDebts, selectedDebts]);

  // Auto-calculate when debts are selected and data is ready
  useEffect(() => {
    if (finalDebts.length > 0 && !installmentsLoading) {
      const hasAllData = finalDebts.every(debt => 
        installmentsData[debt.id] && installmentsData[debt.id].length > 0
      );
      if (hasAllData) {
        calculateCashFlow();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalDebts.length, installmentsLoading]);

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

    // Check if we have installment data for the selected debts
    const missingData = finalDebts.filter(debt => !installmentsData[debt.id] || installmentsData[debt.id].length === 0);
    if (missingData.length > 0) {
      toast({
        title: "Dados não disponíveis",
        description: `Aguarde o cálculo das parcelas para ${missingData.length} dívida(s) ou recalcule no menu Tabela.`,
        variant: "destructive"
      });
      return;
    }

    try {
      // Aggregate data by month using the same data source as the table
      const monthlyData: { [month: string]: ChartDataPoint } = {};
      
      finalDebts.forEach((debt) => {
        const debtInstallments = installmentsData[debt.id];
        if (!debtInstallments) return;

        debtInstallments.forEach((installment) => {
          const date = new Date(installment.due_date);
          const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
          const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
              month: monthLabel,
              isoMonth: monthKey,
              totalBalance: 0,
              totalAmortization: 0,
              totalInterest: 0,
              monthNumber: installment.installment_number
            };
          }

          monthlyData[monthKey].totalBalance += Math.max(0, installment.remaining_balance);
          monthlyData[monthKey].totalAmortization += installment.principal_amount;
          monthlyData[monthKey].totalInterest += installment.interest_amount;
        });
      });

      // Convert to array and sort by date
      const sortedData = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([_, data]) => data);

      // Apply date filter only if dates are actually provided
      let filteredData = sortedData;
      if (startDate || endDate) {
        const startDateStr = startDate ? startDate.toISOString().slice(0, 7) : null;
        const endDateStr = endDate ? endDate.toISOString().slice(0, 7) : null;

        filteredData = sortedData.filter(point => {
          if (startDateStr && endDateStr) {
            return point.isoMonth >= startDateStr && point.isoMonth <= endDateStr;
          } else if (startDateStr) {
            return point.isoMonth >= startDateStr;
          } else if (endDateStr) {
            return point.isoMonth <= endDateStr;
          }
          return true;
        });
      }

      setRawChartData(filteredData);
      
      toast({
        title: "Análise gerada com sucesso!",
        description: `${filteredData.length} períodos analisados para ${finalDebts.length} dívida(s).`
      });

    } catch (error) {
      console.error('Error calculating debt analysis:', error);
      toast({
        title: "Erro na análise",
        description: "Não foi possível gerar a análise da dívida.",
        variant: "destructive"
      });
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
    const totalAmortization = chartData.reduce((sum, month) => sum + month.totalAmortization, 0);
    const totalInterests = chartData.reduce((sum, month) => sum + month.totalInterest, 0);
    const amortizationAmount = analysisType === 'accumulated' ? lastMonth.totalAmortization : totalAmortization;
    const interestAmount = analysisType === 'accumulated' ? lastMonth.totalInterest : totalInterests;

    return {
      amortizationAmount,
      installmentAmount: amortizationAmount + interestAmount,
      interestAmount,
      periodsAnalyzed: chartData.length
    };
  };

  const stats = getSummaryStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-card p-4 border border-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-primary/10">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Análise da Dívida
            </h2>
            <p className="text-sm text-muted-foreground">
              Estoque, amortização e juros das dívidas selecionadas
            </p>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bank Selection */}
        <Card className="border border-muted/50 shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Filter className="h-3.5 w-3.5 text-primary" />
                Seleção de Bancos
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={selectAllBanks} className="text-xs h-6 px-2 hover:bg-primary/10">
                  Todos
                </Button>
                <Button variant="ghost" size="sm" onClick={clearBankSelection} className="text-xs h-6 px-2 hover:bg-destructive/10">
                  Limpar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5 px-4 pb-3">
            {availableBanks.map((bank) => (
              <div key={bank} className="flex items-center space-x-2 py-1 px-1.5 rounded hover:bg-muted/50 transition-colors">
                <Checkbox
                  id={bank}
                  checked={selectedBanks.includes(bank)}
                  onCheckedChange={() => handleBankToggle(bank)}
                />
                <label htmlFor={bank} className="text-sm cursor-pointer flex-1">
                  {bank}
                </label>
                <span className="text-xs text-muted-foreground">
                  {debts.filter(d => d.bank === bank).length}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Debt Selection */}
        <Card className="border border-muted/50 shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
                Dívidas Específicas
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={selectAllDebts} className="text-xs h-6 px-2 hover:bg-primary/10" disabled={filteredDebts.length === 0}>
                  Todas
                </Button>
                <Button variant="ghost" size="sm" onClick={clearDebtSelection} className="text-xs h-6 px-2 hover:bg-destructive/10">
                  Limpar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="h-[150px] pr-2">
              <div className="space-y-1.5">
                {filteredDebts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Selecione pelo menos um banco primeiro
                  </p>
                ) : (
                  filteredDebts.map((debt) => (
                    <div key={debt.id} className="flex items-center space-x-2 py-1 px-1.5 rounded hover:bg-muted/50 transition-colors">
                      <Checkbox
                        id={debt.id}
                        checked={selectedDebts.includes(debt.id)}
                        onCheckedChange={() => handleDebtToggle(debt.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <label htmlFor={debt.id} className="text-sm font-medium cursor-pointer block truncate">
                          {formatCurrency(debt.financedAmount)}
                          {debt.contractNumber && (
                            <span className="text-xs text-muted-foreground ml-1">
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
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Analysis Configuration */}
        <Card className="border border-muted/50 shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Configurações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Período de Análise</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Data Inicial</label>
                  <DateInput
                    value={startDate}
                    onChange={(date) => setStartDate(date)}
                    placeholder="dd/mm/aaaa"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data Final</label>
                  <DateInput
                    value={endDate}
                    onChange={(date) => setEndDate(date)}
                    minDate={startDate}
                    placeholder="dd/mm/aaaa"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <Button
              onClick={calculateCashFlow}
              className="w-full"
              disabled={installmentsLoading || finalDebts.length === 0}
            >
              {installmentsLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4 mr-2" />
              )}
              {installmentsLoading ? 'Carregando...' : 'Gerar Análise'}
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
              <p className="text-xl font-bold text-primary">{formatCurrency(stats.amortizationAmount)}</p>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-muted-foreground">Parcelas Remanescentes</span>
              </div>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(stats.installmentAmount)}</p>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-muted-foreground">Juros Remanescentes</span>
              </div>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.interestAmount)}</p>
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
              Evolução da Dívida
              <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5 ml-auto">
                <Button
                  variant={analysisType === 'absolute' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 text-xs px-3 rounded-sm"
                  onClick={() => setAnalysisType('absolute')}
                >
                  Mensal
                </Button>
                <Button
                  variant={analysisType === 'accumulated' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 text-xs px-3 rounded-sm"
                  onClick={() => setAnalysisType('accumulated')}
                >
                  Acumulado
                </Button>
              </div>
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

      {/* Payment Schedule Table */}
      <PaymentScheduleTable
        debts={debts}
        selectedBanks={selectedBanks}
        selectedDebts={selectedDebts}
        startDate={startDate ? startDate.toISOString().slice(0, 10) : ''}
        endDate={endDate ? endDate.toISOString().slice(0, 10) : ''}
      />

      {chartData.length === 0 && !installmentsLoading && (
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
