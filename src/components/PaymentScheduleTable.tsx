import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  installment_number: number;
  due_date: string;
  principal_balance: number;
  amortization: number;
  interest_amount: number;
  installment_amount: number;
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
  monthlyPayments: { [month: string]: number };
}

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

  const calculatePaymentFlow = async () => {
    if (filteredDebts.length === 0) return;

    setLoading(true);
    try {
      const allContracts: ContractPayments[] = [];
      const allMonths = new Set<string>();

      // Calculate installments for each selected debt
      for (const debt of filteredDebts) {
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

        const installments: Installment[] = data.installments;
        const contractDisplay = debt.contractNumber || `CT${debt.id.substring(0, 8).toUpperCase()}`;
        const monthlyPayments: { [month: string]: number } = {};

        // Process installments for this contract
        installments.forEach((installment) => {
          const dueDate = installment.due_date;
          const month = dueDate.substring(0, 7); // YYYY-MM
          
          // Apply date filters if provided (only filter if dates are actually set)
          if (startDate && startDate.trim() && dueDate < startDate) return;
          if (endDate && endDate.trim() && dueDate > endDate) return;

          monthlyPayments[month] = installment.installment_amount;
          allMonths.add(month);
        });

        allContracts.push({
          debtId: debt.id,
          bank: debt.bank,
          contractNumber: contractDisplay,
          monthlyPayments
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
        description: "Não foi possível calcular o fluxo de vencimentos.",
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
    const header = ['Banco', 'Contrato', 'Valor Financiado', ...months.map(formatMonthHeader)];
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
          ...months.map(month => bankTotals[month] || 0)
        ];
        csvData.push(bankRow.join(','));

        // Individual contract rows
        contracts.forEach(contract => {
          const debt = filteredDebts.find(d => d.id === contract.debtId);
          const contractRow = [
            `"${bank}"`,
            `"${contract.contractNumber}"`,
            debt?.financedAmount || 0,
            ...months.map(month => contract.monthlyPayments[month] || 0)
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
        ...months.map(month => grandTotals[month] || 0)
      ];
      csvData.push(totalRow.join(','));
    }

    // Create and download CSV file
    const csvContent = csvData.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fluxo_vencimentos_${new Date().toISOString().split('T')[0]}.csv`);
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

  // Calculate monthly totals for each bank
  const getBankMonthlyTotals = (contracts: ContractPayments[]) => {
    const totals: { [month: string]: number } = {};
    
    contracts.forEach(contract => {
      Object.entries(contract.monthlyPayments).forEach(([month, amount]) => {
        totals[month] = (totals[month] || 0) + amount;
      });
    });

    return totals;
  };

  // Calculate grand totals for each month
  const grandTotals = useMemo(() => {
    const totals: { [month: string]: number } = {};
    
    contractPayments.forEach(contract => {
      Object.entries(contract.monthlyPayments).forEach(([month, amount]) => {
        totals[month] = (totals[month] || 0) + amount;
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
              Selecione contratos para visualizar o fluxo de vencimentos.
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
              <CardTitle className="text-2xl">Fluxo de Vencimentos</CardTitle>
              <p className="text-muted-foreground">
                Projeção das PMTs dos contratos selecionados por mês
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
              <p className="text-muted-foreground">Calculando fluxo de vencimentos...</p>
            </div>
          </CardContent>
        </Card>
      ) : contractPayments.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhum pagamento encontrado para o período selecionado.
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
                Cronograma Horizontal de Pagamentos
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
          <CardContent>
            <ScrollArea className="w-full">
              <div className="min-w-fit">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background border-r min-w-[200px]">
                        Contrato / Banco
                      </TableHead>
                      {months.map(month => (
                        <TableHead key={month} className="text-center min-w-[100px]">
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
                              <TableCell className="sticky left-0 bg-muted/30 border-r font-semibold">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4" />
                                  {bank}
                                  <Badge variant="secondary" className="text-xs">
                                    {contracts.length}
                                  </Badge>
                                </div>
                              </TableCell>
                              {months.map(month => (
                                <TableCell key={month} className="text-center font-semibold">
                                  {formatCurrency(bankTotals[month] || 0)}
                                </TableCell>
                              ))}
                            </TableRow>
                            
                            {/* Contract rows for this bank */}
                            {contracts.map(contract => (
                              <TableRow key={contract.debtId}>
                                <TableCell className="sticky left-0 bg-background border-r pl-8">
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
                                  <TableCell key={month} className="text-center text-sm">
                                    {formatCurrency(contract.monthlyPayments[month] || 0)}
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
                        <TableCell className="sticky left-0 bg-primary/10 border-r">
                          TOTAL GERAL
                        </TableCell>
                        {months.map(month => (
                          <TableCell key={month} className="text-center">
                            {formatCurrency(grandTotals[month] || 0)}
                          </TableCell>
                        ))}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}