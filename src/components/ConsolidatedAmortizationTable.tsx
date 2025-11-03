import React, { useState, useEffect } from 'react';
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
  principal_balance: number;
  amortization: number;
  interest_amount: number;
  installment_amount: number;
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

  const calculateConsolidatedAmortization = async (silent: boolean = false) => {
    if (debts.length === 0) {
      if (!silent) {
        toast({
          title: "Selecione pelo menos uma dívida",
          description: "É necessário selecionar dívidas para gerar a tabela consolidada.",
          variant: "destructive"
        });
      }
      return;
    }

    setLoading(true);
    try {
      // Calculate amortization for each debt
      const allInstallments: { [key: string]: any[] } = {};
      let totalFinancedAmount = 0;

      for (const debt of debts) {
        // Derive first due date as releaseDate + 1 month (local-safe)
        const rel = new Date(debt.releaseDate);
        const fd = new Date(rel.getFullYear(), rel.getMonth() + 1, rel.getDate());
        const firstDueDateStr = `${fd.getFullYear()}-${String(fd.getMonth() + 1).padStart(2, '0')}-${String(fd.getDate()).padStart(2, '0')}`;
        const { data, error } = await supabase.functions.invoke('calculate-amortization', {
          body: {
            debtId: debt.id,
            financedAmount: debt.financedAmount,
            firstDueDate: firstDueDateStr,
            lastDueDate: debt.dueDate,
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
              principal_balance: 0,
              amortization: 0,
              interest_amount: 0,
              installment_amount: 0
            };
          }

          // Sum values from all contracts for this period
          consolidatedMap[dueDate].principal_balance += installment.principal_balance;
          consolidatedMap[dueDate].amortization += installment.amortization;
          consolidatedMap[dueDate].interest_amount += installment.interest_amount;
          consolidatedMap[dueDate].installment_amount += installment.installment_amount;
        });
      });

      // Convert to array and sort by date
      const consolidatedArray = Object.values(consolidatedMap)
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

      setConsolidatedInstallments(consolidatedArray);

      // Calculate summary
      const totalPaid = consolidatedArray.reduce((sum, inst) => sum + inst.installment_amount, 0);
      const totalCurrentInstallment = consolidatedArray.length > 0 ? consolidatedArray[0].installment_amount : 0;

      setSummary({
        totalContracts: debts.length,
        totalFinancedAmount,
        totalPaid,
        totalCurrentInstallment
      });

      if (!silent) {
        toast({
          title: "Tabela consolidada gerada com sucesso!",
          description: `${consolidatedArray.length} períodos consolidados de ${debts.length} contratos.`
        });
      }
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
    const headers = ['#', 'Data Vcto', 'Saldo Devedor', 'Amortização', 'Juros', 'Valor Parcela'];
    const rows: string[] = [headers.join(',')];

    consolidatedInstallments.forEach(period => {
      rows.push([
        period.installment_number.toString(),
        formatDate(period.due_date),
        period.principal_balance.toFixed(2),
        period.amortization.toFixed(2),
        period.interest_amount.toFixed(2),
        period.installment_amount.toFixed(2)
      ].join(','));
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
    const idsKey = debts.map(d => d.id).sort().join(',');
    if (debts.length > 0) {
      calculateConsolidatedAmortization(true); // Silent recalculation
    } else {
      setConsolidatedInstallments([]);
    }
  }, [debts.map(d => d.id).sort().join(','), startDate, endDate]);

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
              <Button onClick={() => calculateConsolidatedAmortization()} disabled={loading} variant="outline" size="sm">
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
                    <TableHead className="text-right font-bold">Saldo Devedor</TableHead>
                    <TableHead className="text-right font-bold">Amortização</TableHead>
                    <TableHead className="text-right font-bold">Juros</TableHead>
                    <TableHead className="text-right font-bold">Valor Parcela</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidatedInstallments.map((period, index) => (
                    <TableRow key={period.due_date}>
                      <TableCell className="font-medium">
                        {period.installment_number}
                      </TableCell>
                      <TableCell>
                        {formatDate(period.due_date)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(period.principal_balance)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(period.amortization)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(period.interest_amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">
                        {formatCurrency(period.installment_amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">Clique em "Calcular" para gerar a tabela consolidada.</p>
              <Button onClick={() => calculateConsolidatedAmortization()} disabled={loading}>
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