import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Calculator, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { useTemporaryScenario } from '@/hooks/useTemporaryScenario';
import { getEdgeFunctionErrorMessage, getEdgeFunctionResponseError } from '@/lib/edgeFunctionErrors';

interface Debt {
  id: string;
  bank: string;
  financedAmount: number;
  releaseDate: string;
  firstDueDate?: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  interestRate: number;
  interestType: 'monthly' | 'annual';
  indexer?: string;
  spreadRate?: number;
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

interface StoredInstallmentRow {
  debt_id: string;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  remaining_balance: number;
}

interface ConsolidatedAmortizationTableProps {
  debts: Debt[];
  startDate?: Date;
  endDate?: Date;
}

const toStoredShape = (row: StoredInstallmentRow): ConsolidatedInstallment => ({
  installment_number: row.installment_number,
  due_date: row.due_date,
  principal_balance: row.remaining_balance,
  amortization: row.principal_amount,
  interest_amount: row.interest_amount,
  installment_amount: row.total_amount,
});

const toEdgeShape = (installment: any): ConsolidatedInstallment => ({
  installment_number: installment.installment_number,
  due_date: installment.due_date,
  principal_balance: Math.max(0, installment.principal_balance ?? installment.remaining_balance ?? 0),
  amortization: installment.amortization,
  interest_amount: installment.interest_amount,
  installment_amount: installment.installment_amount,
});

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
  const { selectedCompany } = useCompany();
  const { toOverrides } = useTemporaryScenario();
  const debtIdsKey = useMemo(() => debts.map((debt) => debt.id).sort().join(','), [debts]);
  const startDateKey = startDate?.toISOString() ?? '';
  const endDateKey = endDate?.toISOString() ?? '';

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

  const consolidateInstallments = (
    allInstallments: { [key: string]: ConsolidatedInstallment[] },
    silent: boolean,
  ) => {
    const consolidatedMap: { [key: string]: ConsolidatedInstallment } = {};
    const totalFinancedAmount = debts.reduce((sum, debt) => sum + debt.financedAmount, 0);

    Object.values(allInstallments).forEach((installments) => {
      installments.forEach((installment) => {
        const dueDate = installment.due_date;
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

        consolidatedMap[dueDate].principal_balance += installment.principal_balance;
        consolidatedMap[dueDate].amortization += installment.amortization;
        consolidatedMap[dueDate].interest_amount += installment.interest_amount;
        consolidatedMap[dueDate].installment_amount += installment.installment_amount;
      });
    });

    const consolidatedArray = Object.values(consolidatedMap)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const totalPaid = consolidatedArray.reduce((sum, inst) => sum + inst.installment_amount, 0);
    const totalCurrentInstallment = consolidatedArray.length > 0 ? consolidatedArray[0].installment_amount : 0;

    setConsolidatedInstallments(consolidatedArray);
    setSummary({
      totalContracts: debts.length,
      totalFinancedAmount,
      totalPaid,
      totalCurrentInstallment
    });

    if (!silent) {
      toast({
        title: "Tabela consolidada carregada",
        description: `${consolidatedArray.length} períodos consolidados de ${debts.length} contratos.`
      });
    }
  };

  const loadSavedInstallments = async (silent: boolean = false) => {
    if (debts.length === 0) {
      setConsolidatedInstallments([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('debt_installments')
        .select('debt_id, installment_number, due_date, principal_amount, interest_amount, total_amount, remaining_balance')
        .in('debt_id', debts.map((debt) => debt.id))
        .order('due_date', { ascending: true });

      if (error) throw error;

      const allInstallments = (data ?? []).reduce<{ [key: string]: ConsolidatedInstallment[] }>((acc, row) => {
        if (!acc[row.debt_id]) {
          acc[row.debt_id] = [];
        }

        acc[row.debt_id].push(toStoredShape(row));
        return acc;
      }, {});

      consolidateInstallments(allInstallments, silent);
    } catch (error) {
      console.error('Error loading consolidated amortization:', error);
      toast({
        title: "Erro ao carregar tabela consolidada",
        description: "Não foi possível carregar as parcelas salvas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const recalculateConsolidatedAmortization = async () => {
    if (debts.length === 0) {
      toast({
        title: "Selecione pelo menos uma dívida",
        description: "É necessário selecionar dívidas para recalcular a tabela consolidada.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedCompany?.id) {
      toast({
        title: "Empresa não selecionada",
        description: "Selecione uma empresa para recalcular a tabela.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const allInstallments: { [key: string]: ConsolidatedInstallment[] } = {};

      for (const debt of debts) {
        const firstDueDateStr = debt.firstDueDate
          ? debt.firstDueDate
          : (() => {
              const rel = new Date(debt.releaseDate);
              const fd = new Date(rel.getFullYear(), rel.getMonth() + 1, 1);
              return `${fd.getFullYear()}-${String(fd.getMonth() + 1).padStart(2, '0')}-${String(fd.getDate()).padStart(2, '0')}`;
            })();
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
            "Não foi possível recalcular a tabela consolidada. Atualize as projeções e tente novamente."
          ));
        }

        const responseError = getEdgeFunctionResponseError(
          data,
          "Não foi possível recalcular a tabela consolidada. Atualize as projeções e tente novamente."
        );

        if (responseError) {
          throw new Error(responseError);
        }

        allInstallments[debt.id] = (data?.installments ?? []).map(toEdgeShape);
      }

      consolidateInstallments(allInstallments, false);
    } catch (error) {
      console.error('Error calculating consolidated amortization:', error);
      toast({
        title: "Erro ao recalcular tabela consolidada",
        description: error instanceof Error ? error.message : "Não foi possível recalcular a tabela de amortização consolidada.",
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
    if (debts.length > 0) {
      loadSavedInstallments(true);
    } else {
      setConsolidatedInstallments([]);
    }
  }, [debtIdsKey, startDateKey, endDateKey]);

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
              <Button onClick={() => recalculateConsolidatedAmortization()} disabled={loading} variant="outline" size="sm">
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
              <span className="ml-2">Carregando tabela consolidada...</span>
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
                  {consolidatedInstallments.map((period) => (
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
              <p className="mb-4">Nenhuma parcela salva encontrada. Use "Recalcular" para gerar a tabela explicitamente.</p>
              <Button onClick={() => recalculateConsolidatedAmortization()} disabled={loading}>
                <Calculator className="h-4 w-4 mr-2" />
                Recalcular Tabela Consolidada
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
