import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Building2, CreditCard } from 'lucide-react';
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

interface PaymentFlowData {
  debtId: string;
  bank: string;
  contractNumber: string;
  installment_number: number;
  due_date: string;
  installment_amount: number;
}

interface BankSubtotal {
  bank: string;
  totalAmount: number;
  contractCount: number;
}

export function PaymentScheduleTable({ 
  debts, 
  selectedBanks, 
  selectedDebts, 
  startDate, 
  endDate 
}: PaymentScheduleTableProps) {
  const [paymentFlowData, setPaymentFlowData] = useState<PaymentFlowData[]>([]);
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
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const calculatePaymentFlow = async () => {
    if (filteredDebts.length === 0) return;

    setLoading(true);
    try {
      const allPayments: PaymentFlowData[] = [];

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

        // Convert installments to payment flow data
        installments.forEach((installment) => {
          const dueDate = installment.due_date;
          
          // Apply date filters if provided
          if (startDate && dueDate < startDate) return;
          if (endDate && dueDate > endDate) return;

          allPayments.push({
            debtId: debt.id,
            bank: debt.bank,
            contractNumber: contractDisplay,
            installment_number: installment.installment_number,
            due_date: dueDate,
            installment_amount: installment.installment_amount
          });
        });
      }

      // Sort by due date and then by bank
      allPayments.sort((a, b) => {
        const dateCompare = a.due_date.localeCompare(b.due_date);
        if (dateCompare !== 0) return dateCompare;
        return a.bank.localeCompare(b.bank);
      });

      setPaymentFlowData(allPayments);

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
      setPaymentFlowData([]);
    }
  }, [filteredDebts, startDate, endDate]);

  // Group data by month and calculate bank subtotals
  const groupedData = useMemo(() => {
    const grouped: { [month: string]: PaymentFlowData[] } = {};
    
    paymentFlowData.forEach(payment => {
      const month = payment.due_date.substring(0, 7); // YYYY-MM
      if (!grouped[month]) {
        grouped[month] = [];
      }
      grouped[month].push(payment);
    });

    return grouped;
  }, [paymentFlowData]);

  // Calculate bank subtotals for each month
  const getBankSubtotals = (monthData: PaymentFlowData[]): BankSubtotal[] => {
    const bankTotals: { [bank: string]: BankSubtotal } = {};
    
    monthData.forEach(payment => {
      if (!bankTotals[payment.bank]) {
        bankTotals[payment.bank] = {
          bank: payment.bank,
          totalAmount: 0,
          contractCount: 0
        };
      }
      bankTotals[payment.bank].totalAmount += payment.installment_amount;
      bankTotals[payment.bank].contractCount += 1;
    });

    return Object.values(bankTotals).sort((a, b) => a.bank.localeCompare(b.bank));
  };

  const totalAmount = paymentFlowData.reduce((sum, payment) => sum + payment.installment_amount, 0);

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
                Projeção das PMTs dos contratos selecionados por data de vencimento
              </p>
            </div>
          </div>
        </CardHeader>
        {paymentFlowData.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total de Pagamentos</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Contratos</p>
                <p className="text-2xl font-bold">{filteredDebts.length}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Parcelas</p>
                <p className="text-2xl font-bold">{paymentFlowData.length}</p>
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
      ) : paymentFlowData.length === 0 ? (
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
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Cronograma de Pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(groupedData)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, monthData]) => {
                  const bankSubtotals = getBankSubtotals(monthData);
                  const monthTotal = monthData.reduce((sum, payment) => sum + payment.installment_amount, 0);
                  const monthLabel = new Date(month + '-01').toLocaleDateString('pt-BR', { 
                    month: 'long', 
                    year: 'numeric' 
                  });

                  return (
                    <div key={month} className="space-y-4">
                      {/* Month Header */}
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                        <h3 className="text-lg font-semibold capitalize">{monthLabel}</h3>
                        <Badge variant="outline" className="text-sm">
                          {formatCurrency(monthTotal)}
                        </Badge>
                      </div>

                      {/* Contract Details */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Contrato</TableHead>
                            <TableHead>Banco</TableHead>
                            <TableHead>Parcela</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthData.map((payment, index) => (
                            <TableRow key={`${payment.debtId}-${payment.installment_number}`}>
                              <TableCell className="font-medium">
                                {payment.contractNumber}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  {payment.bank}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {payment.installment_number}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDate(payment.due_date)}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(payment.installment_amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {/* Bank Subtotals */}
                      {bankSubtotals.length > 1 && (
                        <div className="mt-4">
                          <Separator className="mb-3" />
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">
                              Subtotais por Banco
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {bankSubtotals.map(subtotal => (
                                <div 
                                  key={subtotal.bank}
                                  className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
                                >
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">{subtotal.bank}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {subtotal.contractCount}
                                    </Badge>
                                  </div>
                                  <span className="text-sm font-semibold">
                                    {formatCurrency(subtotal.totalAmount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}