import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Calculator, Download, TrendingUp, RefreshCw, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calculateIRRFromCashFlows } from '@/lib/irrCalculator';
import { useCompany } from '@/hooks/useCompany';
import { useTemporaryScenario } from '@/hooks/useTemporaryScenario';
import { useInstallmentRateRefs, formatRateRefSource } from '@/hooks/useInstallmentRateRefs';
import { getEdgeFunctionErrorMessage, getEdgeFunctionResponseError } from '@/lib/edgeFunctionErrors';
interface Debt {
  id: string;
  bank: string;
  financedAmount: number;
  releaseDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  interestRate: number;
  interestType: 'monthly' | 'annual';
  indexer?: string;
  spreadRate?: number;
  iofAmount?: number;
  tacAmount?: number;
  contractNumber?: string;
  cet_monthly_rate?: number;
  cet_annual_rate?: number;
}
interface Installment {
  installment_number: number;
  due_date: string;
  principal_balance: number;
  amortization: number;
  interest_amount: number;
  indexer_rate: number;
  installment_amount: number;
  days_in_period: number;
}
interface AmortizationTableProps {
  debt: Debt;
  autoCalculate?: boolean; // Control whether to auto-calculate on mount
}
export function AmortizationTable({
  debt,
  autoCalculate = false
}: AmortizationTableProps) {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculatedIRR, setCalculatedIRR] = useState<{
    monthlyRate: number;
    annualRate: number;
    converged: boolean;
  } | null>(null);
  const [summary, setSummary] = useState({
    totalPaid: 0,
    totalInterest: 0,
    totalPrincipal: 0,
    currentInstallment: 0
  });
  const {
    toast
  } = useToast();
  const { selectedCompany } = useCompany();
  const { toOverrides } = useTemporaryScenario();
  const rateRefs = useInstallmentRateRefs(debt.id);
  const isPostFixed = !!debt.indexer;
  
  // Use stored CET values from database
  const cetMonthly = debt.cet_monthly_rate;
  const cetAnnual = debt.cet_annual_rate;
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const calculateMonthsRemaining = () => {
    const now = new Date();
    const dueDate = new Date(debt.dueDate);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)); // Average days per month
    return Math.max(0, diffMonths);
  };
  const calculateAmortization = async () => {
    setLoading(true);
    try {
      // Derive first due date as releaseDate + 1 month (local-safe)
      const rel = new Date(debt.releaseDate);
      const fd = new Date(rel.getFullYear(), rel.getMonth() + 1, rel.getDate());
      const firstDueDateStr = `${fd.getFullYear()}-${String(fd.getMonth() + 1).padStart(2, '0')}-${String(fd.getDate()).padStart(2, '0')}`;
      if (!selectedCompany?.id) {
        toast({
          title: "Empresa não selecionada",
          description: "Selecione uma empresa para calcular a tabela.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('calculate-amortization', {
        body: {
          debtId: debt.id,
          companyId: selectedCompany.id,
          financedAmount: debt.financedAmount,
          firstDueDate: firstDueDateStr,
          lastDueDate: debt.dueDate,
          calculationTable: debt.calculationTable,
          interestRate: debt.interestRate,
          interestType: debt.interestType,
          indexer: debt.indexer,
          spreadRate: debt.spreadRate || 0,
          iofAmount: debt.iofAmount || 0,
          tacAmount: debt.tacAmount || 0,
          temporaryOverrides: toOverrides(),
          applyOverridesOnlyToFuture: true,
        }
      });
      if (error) {
        throw new Error(await getEdgeFunctionErrorMessage(
          error,
          "Não foi possível calcular a tabela. Atualize as projeções e tente novamente."
        ));
      }

      const responseError = getEdgeFunctionResponseError(
        data,
        "Não foi possível calcular a tabela. Atualize as projeções e tente novamente."
      );

      if (responseError) {
        throw new Error(responseError);
      }
      const calculatedInstallments = data.installments;
      setInstallments(calculatedInstallments);

      // Calculate IRR from actual cash flows
      const netAmountReceived = debt.financedAmount - (debt.iofAmount || 0) - (debt.tacAmount || 0);
      const irr = calculateIRRFromCashFlows(
        netAmountReceived,
        calculatedInstallments.map(inst => ({
          date: inst.due_date,
          amount: inst.installment_amount
        })),
        debt.releaseDate
      );
      setCalculatedIRR(irr);

      // Calculate summary
      const totalPaid = calculatedInstallments.reduce((sum: number, inst: Installment) => sum + inst.installment_amount, 0);
      const totalInterest = calculatedInstallments.reduce((sum: number, inst: Installment) => sum + inst.interest_amount, 0);
      const totalPrincipal = calculatedInstallments.reduce((sum: number, inst: Installment) => sum + inst.amortization, 0);

      // Get current installment (PMT) - assuming first installment for PRICE or average for SAC
      const currentInstallment = debt.calculationTable === 'PRICE' ? calculatedInstallments[0]?.installment_amount || 0 : calculatedInstallments.reduce((sum: number, inst: Installment) => sum + inst.installment_amount, 0) / calculatedInstallments.length;
      setSummary({
        totalPaid,
        totalInterest,
        totalPrincipal,
        currentInstallment
      });
      toast({
        title: "Tabela calculada com sucesso!",
        description: `${calculatedInstallments.length} parcelas geradas.`
      });
    } catch (error) {
      console.error('Error calculating amortization:', error);
      toast({
        title: "Erro ao calcular tabela",
        description: error instanceof Error ? error.message : "Não foi possível calcular a tabela de amortização.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const exportToCSV = () => {
    const headers = ['Parcela', 'Data Vencimento', 'Saldo Devedor', 'Amortização', 'Juros', 'Valor Parcela'];
    const csvContent = [headers.join(','), ...installments.map(inst => [inst.installment_number, inst.due_date, inst.principal_balance.toFixed(2), inst.amortization.toFixed(2), inst.interest_amount.toFixed(2), inst.installment_amount.toFixed(2)].join(','))].join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amortizacao_${debt.bank}_${debt.contractNumber || debt.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  useEffect(() => {
    // Only auto-calculate if autoCalculate prop is true
    if (debt && autoCalculate) {
      calculateAmortization();
    }
  }, [debt, autoCalculate]);
  return <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground text-center">Total Pago (Parcelas)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-center">
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(summary.totalPaid)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground text-center">Parcela Atual</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-center">
            <div className="text-2xl font-bold text-accent">
              {formatCurrency(summary.currentInstallment)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {debt.calculationTable === 'PRICE' && debt.indexer
                ? 'Recalculada por período (PRICE pós-fixado)'
                : debt.calculationTable === 'PRICE'
                ? 'Fixa (PRICE)'
                : 'Média (SAC)'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground text-center">Principal (Amortizado)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-center">
            <div className="text-2xl font-bold text-muted-foreground">
              {formatCurrency(summary.totalPrincipal)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground font-medium text-center flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4" />
              IRR (TIR) - Fluxo de Caixa Real
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">a.m</div>
                <div className="text-xl font-bold text-accent">
                  {calculatedIRR ? `${calculatedIRR.monthlyRate.toFixed(4)}%` : '--'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">a.a</div>
                <div className="text-xl font-bold text-accent">
                  {calculatedIRR ? `${calculatedIRR.annualRate.toFixed(4)}%` : '--'}
                </div>
              </div>
            </div>
            {calculatedIRR && !calculatedIRR.converged && (
              <div className="text-xs text-warning text-center mt-2">
                ⚠️ Não convergiu
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground text-center">Vencimento em</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-center">
            <div className="text-2xl font-bold text-warning">
              {calculateMonthsRemaining()} meses
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Tabela de Amortização - {debt.calculationTable}
              {debt.calculationTable === 'PRICE' && debt.indexer && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning cursor-default">
                      <RefreshCw className="h-3 w-3" />
                      PMT variável
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    A parcela é recalculada a cada período com base no saldo devedor e na projeção do indexador vigente ({debt.indexer}).
                  </TooltipContent>
                </Tooltip>
              )}
              {debt.contractNumber && <span className="text-sm text-muted-foreground ml-2">
                  (Contrato #{debt.contractNumber})
                </span>}
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={calculateAmortization} disabled={loading} variant="outline" size="sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                Recalcular
              </Button>
              {installments.length > 0 && <Button onClick={exportToCSV} variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Calculando tabela...</span>
            </div> : installments.length > 0 ? <div className="overflow-auto max-h-96 border rounded-md">
              <Table>
                <TableHeader className="bg-background z-10">
                  <TableRow>
                    <TableHead className="w-20 font-bold">#</TableHead>
                    <TableHead className="font-bold">Data Vcto</TableHead>
                    <TableHead className="text-right font-bold">Saldo Devedor</TableHead>
                    <TableHead className="text-right font-bold">Amortização</TableHead>
                    <TableHead className="text-right font-bold">Juros</TableHead>
                    <TableHead className="text-right font-bold">Valor Parcela</TableHead>
                    {isPostFixed && <TableHead className="w-8" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.map(installment => <TableRow key={installment.installment_number}>
                      <TableCell className="font-medium">
                        {installment.installment_number}
                      </TableCell>
                      <TableCell>
                        {formatDate(installment.due_date)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(installment.principal_balance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(installment.amortization)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        {formatCurrency(installment.interest_amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {formatCurrency(installment.installment_amount)}
                      </TableCell>
                      {isPostFixed && (
                        <TableCell className="w-8 text-center">
                          {rateRefs.get(installment.installment_number) ? (() => {
                            const ref = rateRefs.get(installment.installment_number)!;
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-default mx-auto" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-56 space-y-1">
                                  <p><span className="font-medium">Indexador:</span> {ref.index_type}</p>
                                  <p><span className="font-medium">Taxa:</span> {(ref.rate * 100).toFixed(4)}% ({ref.rate_type})</p>
                                  <p><span className="font-medium">Fonte:</span> {formatRateRefSource(ref.source)}</p>
                                  {ref.source_reference_date && (
                                    <p><span className="font-medium">Data-base:</span> {new Date(ref.source_reference_date + 'T00:00:00Z').toLocaleDateString('pt-BR')}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })() : null}
                        </TableCell>
                      )}
                    </TableRow>)}
                </TableBody>
              </Table>
            </div> : <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">Clique em "Calcular" para gerar a tabela de amortização.</p>
              <Button onClick={calculateAmortization} disabled={loading}>
                <Calculator className="h-4 w-4 mr-2" />
                Calcular Tabela
              </Button>
            </div>}
        </CardContent>
      </Card>
    </div>;
}
