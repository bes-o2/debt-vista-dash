import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Calculator, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

interface ConsolidatedInstallment {
  installment_number: number;
  due_date: string;
  total_installment_amount: number;
  debts: Array<{
    debt_id: string;
    bank: string;
    contract: string;
    principal_balance: number;
    amortization: number;
    interest_amount: number;
    installment_amount: number;
  }>;
}

interface ConsolidatedAmortizationTableProps {
  debts: Debt[];
  startDate?: Date;
  endDate?: Date;
}

export function ConsolidatedAmortizationTable({
  debts,
  startDate,
  endDate
}: ConsolidatedAmortizationTableProps) {
  const [consolidatedInstallments, setConsolidatedInstallments] = useState<ConsolidatedInstallment[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalContracts: 0,
    totalFinancedAmount: 0,
    totalPaid: 0,
    totalCurrentInstallment: 0
  });
  const { toast } = useToast();

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

  const calculateConsolidatedAmortization = async () => {
    if (debts.length === 0) {
      toast({
        title: "Selecione pelo menos uma dívida",
        description: "É necessário selecionar dívidas para gerar a tabela consolidada.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Calculate amortization for each debt
      const allInstallments: { [key: string]: any[] } = {};
      let totalFinancedAmount = 0;

      for (const debt of debts) {
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
        totalFinancedAmount += debt.financedAmount;
      }

      // Consolidate installments by due date
      const consolidatedMap: { [key: string]: ConsolidatedInstallment } = {};

      Object.entries(allInstallments).forEach(([debtId, installments]) => {
        const debt = debts.find(d => d.id === debtId)!;
        
        installments.forEach((installment) => {
          const dueDate = installment.due_date;
          
          // Apply date filters if provided
          const installmentDate = new Date(dueDate);
          if (startDate && installmentDate < startDate) return;
          if (endDate && installmentDate > endDate) return;

          if (!consolidatedMap[dueDate]) {
            consolidatedMap[dueDate] = {
              installment_number: installment.installment_number,
              due_date: dueDate,
              total_installment_amount: 0,
              debts: []
            };
          }

          consolidatedMap[dueDate].debts.push({
            debt_id: debtId,
            bank: debt.bank,
            contract: debt.contractNumber || `CT${debt.id.slice(0, 8)}`,
            principal_balance: installment.principal_balance,
            amortization: installment.amortization,
            interest_amount: installment.interest_amount,
            installment_amount: installment.installment_amount
          });

          consolidatedMap[dueDate].total_installment_amount += installment.installment_amount;
        });
      });

      // Convert to array and sort by date
      const consolidatedArray = Object.values(consolidatedMap)
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

      setConsolidatedInstallments(consolidatedArray);

      // Calculate summary
      const totalPaid = consolidatedArray.reduce((sum, inst) => sum + inst.total_installment_amount, 0);
      const totalCurrentInstallment = consolidatedArray.length > 0 ? consolidatedArray[0].total_installment_amount : 0;

      setSummary({
        totalContracts: debts.length,
        totalFinancedAmount,
        totalPaid,
        totalCurrentInstallment
      });

      toast({
        title: "Tabela consolidada gerada com sucesso!",
        description: `${consolidatedArray.length} períodos consolidados de ${debts.length} contratos.`
      });
    } catch (error) {
      console.error('Error calculating consolidated amortization:', error);
      toast({
        title: "Erro ao calcular tabela consolidada",
        description: "Não foi possível calcular a tabela de amortização consolidada.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Data Vencimento', 'Valor Total', 'Banco', 'Contrato', 'Saldo Devedor', 'Amortização', 'Juros', 'Valor Parcela'];
    const rows: string[] = [headers.join(',')];

    consolidatedInstallments.forEach(period => {
      period.debts.forEach(debt => {
        rows.push([
          period.due_date,
          period.total_installment_amount.toFixed(2),
          debt.bank,
          debt.contract,
          debt.principal_balance.toFixed(2),
          debt.amortization.toFixed(2),
          debt.interest_amount.toFixed(2),
          debt.installment_amount.toFixed(2)
        ].join(','));
      });
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amortizacao_consolidada_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (debts.length > 0) {
      calculateConsolidatedAmortization();
    } else {
      setConsolidatedInstallments([]);
    }
  }, [debts, startDate, endDate]);

  if (debts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-4">Selecione uma ou mais dívidas para visualizar a tabela consolidada.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground text-center">Contratos</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-center">
            <div className="text-2xl font-bold text-primary">
              {summary.totalContracts}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground text-center">Total Financiado</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-center">
            <div className="text-2xl font-bold text-accent">
              {formatCurrency(summary.totalFinancedAmount)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground text-center">Total a Pagar</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-center">
            <div className="text-2xl font-bold text-muted-foreground">
              {formatCurrency(summary.totalPaid)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground text-center">Próxima Parcela</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-center">
            <div className="text-2xl font-bold text-warning">
              {formatCurrency(summary.totalCurrentInstallment)}
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
              Tabela Consolidada de Amortização
              <span className="text-sm text-muted-foreground ml-2">
                ({debts.length} contrato{debts.length !== 1 ? 's' : ''})
              </span>
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={calculateConsolidatedAmortization} disabled={loading} variant="outline" size="sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                Recalcular
              </Button>
              {consolidatedInstallments.length > 0 && (
                <Button onClick={exportToCSV} variant="outline" size="sm">
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
              <span className="ml-2">Calculando tabela consolidada...</span>
            </div>
          ) : consolidatedInstallments.length > 0 ? (
            <div className="overflow-auto max-h-96 border rounded-md">
              <Table>
                <TableHeader className="bg-background z-10">
                  <TableRow>
                    <TableHead className="w-20 font-bold">#</TableHead>
                    <TableHead className="font-bold">Data Vcto</TableHead>
                    <TableHead className="text-right font-bold">Total do Período</TableHead>
                    <TableHead className="font-bold">Banco</TableHead>
                    <TableHead className="font-bold">Contrato</TableHead>
                    <TableHead className="text-right font-bold">Valor Parcela</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidatedInstallments.map((period, index) => (
                    <>
                      {period.debts.map((debt, debtIndex) => (
                        <TableRow key={`${period.due_date}-${debt.debt_id}`}>
                          {debtIndex === 0 && (
                            <>
                              <TableCell rowSpan={period.debts.length} className="font-medium border-r">
                                {period.installment_number}
                              </TableCell>
                              <TableCell rowSpan={period.debts.length} className="border-r">
                                {formatDate(period.due_date)}
                              </TableCell>
                              <TableCell rowSpan={period.debts.length} className="text-right font-bold text-primary border-r">
                                {formatCurrency(period.total_installment_amount)}
                              </TableCell>
                            </>
                          )}
                          <TableCell>{debt.bank}</TableCell>
                          <TableCell className="font-mono text-sm">{debt.contract}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(debt.installment_amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">Clique em "Calcular" para gerar a tabela consolidada.</p>
              <Button onClick={calculateConsolidatedAmortization} disabled={loading}>
                <Calculator className="h-4 w-4 mr-2" />
                Calcular Tabela Consolidada
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}