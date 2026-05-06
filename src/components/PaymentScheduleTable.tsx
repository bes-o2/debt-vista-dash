import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Building2, Download } from 'lucide-react';
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
  debt_id: string;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  remaining_balance: number;
}

interface PaymentScheduleTableProps {
  debts: Debt[];
  selectedBanks: string[];
  selectedDebts: string[];
  startDate?: string;
  endDate?: string;
}

interface ContractPayments {
  debtId: string;
  bank: string;
  contractNumber: string;
  monthlyMetrics: { [month: string]: MonthlyDebtMetrics };
}

interface MonthlyDebtMetrics {
  balance: number;
  amortization: number;
  interest: number;
}

const EMPTY_METRICS: MonthlyDebtMetrics = {
  balance: 0,
  amortization: 0,
  interest: 0,
};

export function PaymentScheduleTable({ 
  debts, 
  selectedBanks, 
  selectedDebts, 
  startDate, 
  endDate 
}: PaymentScheduleTableProps) {
  const [contractPayments, setContractPayments] = useState<ContractPayments[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Filter debts based on selection
  const filteredDebts = useMemo(() => {
    let filtered = debts;
    
    if (selectedBanks.length > 0) {
      filtered = filtered.filter(debt => selectedBanks.includes(debt.bank));
    }
    
    if (selectedDebts.length > 0) {
      filtered = filtered.filter(debt => selectedDebts.includes(debt.id));
    }
    
    return filtered;
  }, [debts, selectedBanks, selectedDebts]);

  const formatCurrency = (value: number) => {
    if (value === 0) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatMonthHeader = (month: string) => {
    const date = new Date(month + '-01');
    return date.toLocaleDateString('pt-BR', { 
      month: 'short', 
      year: '2-digit' 
    }).replace('.', '');
  };

  const formatMetrics = (metrics?: MonthlyDebtMetrics) => {
    const value = metrics ?? EMPTY_METRICS;
    return (
      <div className="space-y-1 text-left leading-tight">
        <div className="flex justify-between gap-3">
          <span className="text-xs text-muted-foreground">Saldo</span>
          <span>{formatCurrency(value.balance)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-xs text-muted-foreground">Amort.</span>
          <span>{formatCurrency(value.amortization)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-xs text-muted-foreground">Juros</span>
          <span>{formatCurrency(value.interest)}</span>
        </div>
      </div>
    );
  };

  const addMetrics = (current: MonthlyDebtMetrics | undefined, next: MonthlyDebtMetrics): MonthlyDebtMetrics => ({
    balance: (current?.balance ?? 0) + next.balance,
    amortization: (current?.amortization ?? 0) + next.amortization,
    interest: (current?.interest ?? 0) + next.interest,
  });

  const calculatePaymentFlow = async () => {
    if (filteredDebts.length === 0) return;

    setLoading(true);
    try {
      const allContracts: ContractPayments[] = [];
      const allMonths = new Set<string>();

      const { data, error } = await supabase
        .from('debt_installments')
        .select('debt_id, installment_number, due_date, principal_amount, interest_amount, remaining_balance')
        .in('debt_id', filteredDebts.map((debt) => debt.id))
        .order('due_date', { ascending: true });

      if (error) throw error;

      const installmentsByDebt = (data ?? []).reduce<Record<string, Installment[]>>((acc, installment) => {
        if (!acc[installment.debt_id]) {
          acc[installment.debt_id] = [];
        }

        acc[installment.debt_id].push(installment);
        return acc;
      }, {});

      // Read saved installments for each selected debt. Recalculation is explicit elsewhere.
      for (const debt of filteredDebts) {
        const installments = installmentsByDebt[debt.id] ?? [];
        const contractDisplay = debt.contractNumber || `CT${debt.id.substring(0, 8).toUpperCase()}`;
        const monthlyMetrics: { [month: string]: MonthlyDebtMetrics } = {};

        // Process installments for this contract
        installments.forEach((installment) => {
          const dueDate = installment.due_date;
          const month = dueDate.substring(0, 7); // YYYY-MM
          
          // Apply date filters if provided (only filter if dates are actually set)
          if (startDate && startDate.trim() && dueDate < startDate) return;
          if (endDate && endDate.trim() && dueDate > endDate) return;

          monthlyMetrics[month] = addMetrics(monthlyMetrics[month], {
            balance: Math.max(0, installment.remaining_balance),
            amortization: installment.principal_amount,
            interest: installment.interest_amount,
          });
          allMonths.add(month);
        });

        allContracts.push({
          debtId: debt.id,
          bank: debt.bank,
          contractNumber: contractDisplay,
          monthlyMetrics
        });
      }

      // Sort months chronologically
      const sortedMonths = Array.from(allMonths).sort();
      
      // Only limit to 24 months if no date filters are applied
      const shouldLimit = !startDate?.trim() && !endDate?.trim();
      const limitedMonths = shouldLimit ? sortedMonths.slice(0, 24) : sortedMonths;
      
      setMonths(limitedMonths);
      setContractPayments(allContracts);

    } catch (error) {
      console.error('Error calculating payment flow:', error);
      toast({
        title: "Erro no cálculo",
        description: "Não foi possível calcular a análise da dívida.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate data when dependencies change
  useEffect(() => {
    if (filteredDebts.length > 0) {
      calculatePaymentFlow();
    } else {
      setContractPayments([]);
      setMonths([]);
    }
  }, [filteredDebts, startDate, endDate]);

  // Export to CSV function
  const exportToCSV = () => {
    if (contractPayments.length === 0 || months.length === 0) return;

    const csvData: string[] = [];
    
    // Header row
    const header = [
      'Banco',
      'Contrato',
      'Valor Financiado',
      ...months.flatMap(month => {
        const label = formatMonthHeader(month);
        return [`${label} Saldo`, `${label} Amortização`, `${label} Juros`];
      })
    ];
    csvData.push(header.join(','));

    // Data rows grouped by bank
    Object.entries(contractsByBank)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([bank, contracts]) => {
        // Bank subtotal row
        const bankTotals = getBankMonthlyTotals(contracts);
        const bankRow = [
          `"${bank} (SUBTOTAL)"`,
          `"${contracts.length} contratos"`,
          '""',
          ...months.flatMap(month => {
            const metrics = bankTotals[month] ?? EMPTY_METRICS;
            return [metrics.balance, metrics.amortization, metrics.interest];
          })
        ];
        csvData.push(bankRow.join(','));

        // Individual contract rows
        contracts.forEach(contract => {
          const debt = filteredDebts.find(d => d.id === contract.debtId);
          const contractRow = [
            `"${bank}"`,
            `"${contract.contractNumber}"`,
            debt?.financedAmount || 0,
            ...months.flatMap(month => {
              const metrics = contract.monthlyMetrics[month] ?? EMPTY_METRICS;
              return [metrics.balance, metrics.amortization, metrics.interest];
            })
          ];
          csvData.push(contractRow.join(','));
        });

        csvData.push(''); // Empty row between banks
      });

    // Grand total row if multiple banks
    if (Object.keys(contractsByBank).length > 1) {
      const totalRow = [
        '"TOTAL GERAL"',
        '""',
        '""',
        ...months.flatMap(month => {
          const metrics = grandTotals[month] ?? EMPTY_METRICS;
          return [metrics.balance, metrics.amortization, metrics.interest];
        })
      ];
      csvData.push(totalRow.join(','));
    }

    // Create and download CSV file
    const csvContent = csvData.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analise_divida_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Group contracts by bank for subtotals
  const contractsByBank = useMemo(() => {
    const grouped: { [bank: string]: ContractPayments[] } = {};
    
    contractPayments.forEach(contract => {
      if (!grouped[contract.bank]) {
        grouped[contract.bank] = [];
      }
      grouped[contract.bank].push(contract);
    });

    return grouped;
  }, [contractPayments]);

  const getBankMonthlyTotals = (contracts: ContractPayments[]) => {
    const totals: { [month: string]: MonthlyDebtMetrics } = {};
    
    contracts.forEach(contract => {
      Object.entries(contract.monthlyMetrics).forEach(([month, metrics]) => {
        totals[month] = addMetrics(totals[month], metrics);
      });
    });

    return totals;
  };

  const grandTotals = useMemo(() => {
    const totals: { [month: string]: MonthlyDebtMetrics } = {};
    
    contractPayments.forEach(contract => {
      Object.entries(contract.monthlyMetrics).forEach(([month, metrics]) => {
        totals[month] = addMetrics(totals[month], metrics);
      });
    });

    return totals;
  }, [contractPayments]);

  if (filteredDebts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Selecione contratos para visualizar a análise da dívida.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-muted/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Estoque, Amortização e Juros</CardTitle>
              <p className="text-muted-foreground">
                Saldo devedor, principal amortizado e juros por mês
              </p>
            </div>
          </div>
        </CardHeader>
        {contractPayments.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Contratos Selecionados</p>
                <p className="text-2xl font-bold">{filteredDebts.length}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Período Exibido</p>
                <p className="text-2xl font-bold">{months.length} meses</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Payment Flow Table */}
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground">Calculando análise da dívida...</p>
            </div>
          </CardContent>
        </Card>
      ) : contractPayments.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhum dado encontrado para o período selecionado.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Cronograma Horizontal da Dívida
                {months.length >= 24 && !startDate?.trim() && !endDate?.trim() && (
                  <Badge variant="outline" className="text-xs">
                    Limitado a 24 meses
                  </Badge>
                )}
              </CardTitle>
              <Button
                onClick={exportToCSV}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 top-0 z-30 bg-card border-r min-w-[200px] whitespace-nowrap">
                      Contrato / Banco
                    </TableHead>
                    {months.map(month => (
                      <TableHead key={month} className="sticky top-0 z-20 bg-card text-center min-w-[180px] whitespace-nowrap">
                        {formatMonthHeader(month)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(contractsByBank)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([bank, contracts]) => {
                      const bankTotals = getBankMonthlyTotals(contracts);

                      return (
                        <React.Fragment key={bank}>
                          {/* Bank header row */}
                          <TableRow className="bg-muted/30">
                            <TableCell className="sticky left-0 z-10 bg-muted border-r font-semibold whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {bank}
                                <Badge variant="secondary" className="text-xs">
                                  {contracts.length}
                                </Badge>
                              </div>
                            </TableCell>
                            {months.map(month => (
                              <TableCell key={month} className="text-sm font-semibold whitespace-nowrap">
                                {formatMetrics(bankTotals[month])}
                              </TableCell>
                            ))}
                          </TableRow>

                          {/* Contract rows for this bank */}
                          {contracts.map(contract => (
                            <TableRow key={contract.debtId}>
                              <TableCell className="sticky left-0 z-10 bg-card border-r pl-8 whitespace-nowrap">
                                <div className="text-sm">
                                  <div className="font-medium">{contract.contractNumber}</div>
                                  <div className="text-muted-foreground text-xs">
                                    {formatCurrency(
                                      filteredDebts.find(d => d.id === contract.debtId)?.financedAmount || 0
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              {months.map(month => (
                                <TableCell key={month} className="text-sm whitespace-nowrap">
                                  {formatMetrics(contract.monthlyMetrics[month])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </React.Fragment>
                      );
                    })}

                  {/* Grand total row */}
                  {Object.keys(contractsByBank).length > 1 && (
                    <TableRow className="bg-primary/10 font-bold">
                      <TableCell className="sticky left-0 z-10 bg-primary/10 border-r whitespace-nowrap">
                        TOTAL GERAL
                      </TableCell>
                      {months.map(month => (
                        <TableCell key={month} className="text-sm whitespace-nowrap">
                          {formatMetrics(grandTotals[month])}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
