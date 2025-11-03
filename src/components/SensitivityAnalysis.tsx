import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useDebts } from "@/hooks/useDebts";
import { useDebtInstallments } from "@/hooks/useDebtInstallments";
import { useCompany } from "@/hooks/useCompany";
import { Badge } from "@/components/ui/badge";

export function SensitivityAnalysis() {
  const { selectedCompany } = useCompany();
  const { debts } = useDebts();
  
  // Map debts to the format expected by useDebtInstallments
  const mappedDebts = useMemo(() => {
    if (!debts) return [];
    return debts.map(debt => ({
      id: debt.id,
      bank: debt.title || '',
      financedAmount: debt.financed_amount,
      first_due_date: debt.first_due_date,  // Changed from releaseDate
      dueDate: debt.last_due_date,
      calculationTable: debt.calculation_table,
      interestRate: debt.interest_rate,
      interestType: debt.interest_type,
      indexer: debt.interest_base,
    }));
  }, [debts]);
  
  const { installmentsData } = useDebtInstallments(mappedDebts);
  const [selectedScenario, setSelectedScenario] = useState<'+2%' | '-2%'>('+2%');

  const scenarioAnalysis = useMemo(() => {
    if (!debts || debts.length === 0) return null;

    const baselineMetrics = {
      totalInterest: 0,
      avgMonthlyPayment: 0,
      totalCET: 0,
      npvCashFlows: 0,
    };

    const scenarios = {
      '+2%': { ...baselineMetrics },
      '-2%': { ...baselineMetrics },
    };

    // Calculate baseline metrics
    debts.forEach((debt) => {
      const installments = installmentsData?.[debt.id];
      if (!installments) return;

      const totalInterest = installments.reduce((sum, inst) => sum + inst.interest_amount, 0);
      const avgPayment = installments.reduce((sum, inst) => sum + inst.total_amount, 0) / installments.length;
      
      baselineMetrics.totalInterest += totalInterest;
      baselineMetrics.avgMonthlyPayment += avgPayment;
      baselineMetrics.totalCET += debt.cet_annual_rate || 0;

      // Calculate NPV (using a 10% discount rate as example)
      const npv = installments.reduce((sum, inst, index) => {
        const pv = inst.total_amount / Math.pow(1.1, (index + 1) / 12);
        return sum + pv;
      }, 0);
      baselineMetrics.npvCashFlows += npv;
    });

    // Calculate +2% scenario
    const upRate = 1.02;
    scenarios['+2%'].totalInterest = baselineMetrics.totalInterest * upRate;
    scenarios['+2%'].avgMonthlyPayment = baselineMetrics.avgMonthlyPayment * upRate;
    scenarios['+2%'].totalCET = baselineMetrics.totalCET + 2;
    scenarios['+2%'].npvCashFlows = baselineMetrics.npvCashFlows * upRate;

    // Calculate -2% scenario
    const downRate = 0.98;
    scenarios['-2%'].totalInterest = baselineMetrics.totalInterest * downRate;
    scenarios['-2%'].avgMonthlyPayment = baselineMetrics.avgMonthlyPayment * downRate;
    scenarios['-2%'].totalCET = baselineMetrics.totalCET - 2;
    scenarios['-2%'].npvCashFlows = baselineMetrics.npvCashFlows * downRate;

    return { baseline: baselineMetrics, scenarios };
  }, [debts, installmentsData]);

  if (!scenarioAnalysis) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p>Nenhuma dívida cadastrada para análise de sensibilidade</p>
      </div>
    );
  }

  const { baseline, scenarios } = scenarioAnalysis;
  const selectedData = scenarios[selectedScenario];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const calculateChange = (baseline: number, scenario: number) => {
    const change = ((scenario - baseline) / baseline) * 100;
    return change;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Análise de Sensibilidade
              </CardTitle>
              <CardDescription>
                Impacto de variações nas taxas de juros sobre o portfólio
              </CardDescription>
            </div>
            <Select value={selectedScenario} onValueChange={(value: '+2%' | '-2%') => setSelectedScenario(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="+2%">+2% nas taxas</SelectItem>
                <SelectItem value="-2%">-2% nas taxas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Total Interest */}
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Juros Totais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold">{formatCurrency(selectedData.totalInterest)}</span>
                    <Badge variant={selectedScenario === '+2%' ? 'destructive' : 'default'}>
                      {selectedScenario === '+2%' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                      {calculateChange(baseline.totalInterest, selectedData.totalInterest).toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Baseline: {formatCurrency(baseline.totalInterest)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Diferença: {formatCurrency(Math.abs(selectedData.totalInterest - baseline.totalInterest))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Average Monthly Payment */}
            <Card className="border-l-4 border-l-secondary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Parcela Média Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold">{formatCurrency(selectedData.avgMonthlyPayment)}</span>
                    <Badge variant={selectedScenario === '+2%' ? 'destructive' : 'default'}>
                      {selectedScenario === '+2%' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                      {calculateChange(baseline.avgMonthlyPayment, selectedData.avgMonthlyPayment).toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Baseline: {formatCurrency(baseline.avgMonthlyPayment)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Diferença: {formatCurrency(Math.abs(selectedData.avgMonthlyPayment - baseline.avgMonthlyPayment))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total CET */}
            <Card className="border-l-4 border-l-accent">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">CET Médio (% a.a.)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold">{formatPercent(selectedData.totalCET / (debts?.length || 1))}</span>
                    <Badge variant={selectedScenario === '+2%' ? 'destructive' : 'default'}>
                      {selectedScenario === '+2%' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                      {selectedScenario === '+2%' ? '+2.00pp' : '-2.00pp'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Baseline: {formatPercent(baseline.totalCET / (debts?.length || 1))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    pp = pontos percentuais
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* NPV of Cash Flows */}
            <Card className="border-l-4 border-l-muted">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">VPL dos Fluxos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold">{formatCurrency(selectedData.npvCashFlows)}</span>
                    <Badge variant={selectedScenario === '+2%' ? 'destructive' : 'default'}>
                      {selectedScenario === '+2%' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                      {calculateChange(baseline.npvCashFlows, selectedData.npvCashFlows).toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Baseline: {formatCurrency(baseline.npvCashFlows)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Diferença: {formatCurrency(Math.abs(selectedData.npvCashFlows - baseline.npvCashFlows))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <strong>Sobre a Análise de Sensibilidade:</strong>
                <p className="mt-1">
                  Esta análise mostra o impacto de uma variação hipotética de ±2% nas taxas de juros sobre as principais métricas do seu portfólio de dívidas.
                  Os valores são simulados e servem como referência para planejamento financeiro e gestão de risco.
                </p>
                <ul className="mt-2 space-y-1">
                  <li>• <strong>Juros Totais:</strong> Soma de todos os juros pagos ao longo dos contratos</li>
                  <li>• <strong>Parcela Média:</strong> Média das parcelas mensais de todas as dívidas</li>
                  <li>• <strong>CET Médio:</strong> Custo Efetivo Total médio do portfólio</li>
                  <li>• <strong>VPL:</strong> Valor Presente Líquido dos fluxos de caixa (taxa de desconto: 10% a.a.)</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}