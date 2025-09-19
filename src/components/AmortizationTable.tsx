import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Calculator, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCET } from '@/hooks/useCET';

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
  indexer_rate: number;
  installment_amount: number;
  days_in_period: number;
}

interface AmortizationTableProps {
  debt: Debt;
}

export function AmortizationTable({ debt }: AmortizationTableProps) {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalPaid: 0,
    totalInterest: 0,
    totalPrincipal: 0,
    currentInstallment: 0
  });
  const { toast } = useToast();
  const { cet: cetMonthly, loading: cetMonthlyLoading } = useCET(debt, 'monthly');
  const { cet: cetAnnual, loading: cetAnnualLoading } = useCET(debt, 'annual');

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

  const calculateAmortization = async () => {
    setLoading(true);
    try {
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

      if (error) {
        throw error;
      }

      const calculatedInstallments = data.installments;
      setInstallments(calculatedInstallments);

      // Calculate summary
      const totalPaid = calculatedInstallments.reduce((sum: number, inst: Installment) => sum + inst.installment_amount, 0);
      const totalInterest = calculatedInstallments.reduce((sum: number, inst: Installment) => sum + inst.interest_amount, 0);
      const totalPrincipal = calculatedInstallments.reduce((sum: number, inst: Installment) => sum + inst.amortization, 0);
      
      // Get current installment (PMT) - assuming first installment for PRICE or average for SAC
      const currentInstallment = debt.calculationTable === 'PRICE' 
        ? calculatedInstallments[0]?.installment_amount || 0
        : calculatedInstallments.reduce((sum: number, inst: Installment) => sum + inst.installment_amount, 0) / calculatedInstallments.length;

      console.log('Summary calculations:', {
        totalPaid,
        totalInterest, 
        totalPrincipal,
        currentInstallment,
        financedAmount: debt.financedAmount,
        installmentCount: calculatedInstallments.length
      });

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
        description: "Não foi possível calcular a tabela de amortização.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Parcela',
      'Data Vencimento',
      'Saldo Devedor',
      'Amortização',
      'Juros',
      'Valor Parcela'
    ];

    const csvContent = [
      headers.join(','),
      ...installments.map(inst => [
        inst.installment_number,
        inst.due_date,
        inst.principal_balance.toFixed(2),
        inst.amortization.toFixed(2),
        inst.interest_amount.toFixed(2),
        inst.installment_amount.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amortizacao_${debt.bank}_${debt.contractNumber || debt.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (debt) {
      calculateAmortization();
    }
  }, [debt]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              {debt.calculationTable === 'PRICE' ? 'Fixa (PRICE)' : 'Média (SAC)'}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo Efetivo Total</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">a.m</div>
                <div className="text-xl font-bold text-accent">
                  {cetMonthlyLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  ) : (
                    `${cetMonthly?.toFixed(2)}%`
                  )}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">a.a</div>
                <div className="text-xl font-bold text-accent">
                  {cetAnnualLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  ) : (
                    `${cetAnnual?.toFixed(2)}%`
                  )}
                </div>
              </div>
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
              {debt.contractNumber && (
                <span className="text-sm text-muted-foreground ml-2">
                  (Contrato #{debt.contractNumber})
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={calculateAmortization}
                disabled={loading}
                variant="outline"
                size="sm"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4" />
                )}
                Recalcular
              </Button>
              {installments.length > 0 && (
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Calculando tabela...</span>
            </div>
          ) : installments.length > 0 ? (
            <div className="overflow-auto max-h-96 border rounded-md">
              <Table>
                <TableHeader className="bg-background z-10">
                  <TableRow>
                    <TableHead className="w-20 font-bold">#</TableHead>
                    <TableHead className="font-bold">Data Vcto</TableHead>
                    <TableHead className="text-right font-bold">Saldo Devedor</TableHead>
                    <TableHead className="text-right font-bold">Amortização</TableHead>
                    <TableHead className="text-right font-bold">Juros</TableHead>
                    <TableHead className="text-right font-bold">Valor Parcela</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.map((installment) => (
                    <TableRow key={installment.installment_number}>
                      <TableCell className="font-medium">
                        {installment.installment_number}
                      </TableCell>
                      <TableCell>
                        {formatDate(installment.due_date)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(Math.max(0, installment.principal_balance - installment.amortization))}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(installment.amortization)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        {formatCurrency(installment.interest_amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(installment.installment_amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma parcela calculada ainda.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}