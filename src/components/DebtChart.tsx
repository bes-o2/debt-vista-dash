import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ComposedChart } from "recharts";
import { useState, useMemo } from "react";
import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, PieChart as PieChartIcon, BarChart3, Filter, Building, ChevronDown, Calendar, Receipt } from "lucide-react";
import { getBankColor } from "@/lib/utils";
import { useCET } from "@/hooks/useCET";
import { useDebtInstallments } from "@/hooks/useDebtInstallments";

interface Debt {
  id: string;
  financedAmount: number;
  releaseDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  indexer?: string;
  interestRate: number;
  interestType: 'monthly' | 'annual';
  bank: string;
  iofAmount?: number;
  tacAmount?: number;
  contractNumber?: string;
}

interface DebtChartProps {
  debts: Debt[];
}

// Component for debt visualization with real bank colors
export const DebtChart = ({ debts }: DebtChartProps) => {
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [selectedIndexerType, setSelectedIndexerType] = useState<string>("all");
  const [chartType, setChartType] = useState<string>("comparison");
  const [viewType, setViewType] = useState<'atual' | 'total'>('total');

  // Fetch installments data for calculating current remaining values
  const { installmentsData, loading: installmentsLoading } = useDebtInstallments(debts);

  // Get unique banks
  const availableBanks = useMemo(() => {
    return [...new Set(debts.map(debt => debt.bank))];
  }, [debts]);

  // Filter debts based on selections
  const filteredDebts = useMemo(() => {
    return debts.filter(debt => {
      const bankMatch = selectedBanks.length === 0 || selectedBanks.includes(debt.bank);
      
      const indexerTypeMatch = selectedIndexerType === "all" || 
        (selectedIndexerType === "pre" && !debt.indexer) ||
        (selectedIndexerType === "pos" && debt.indexer);
      
      return bankMatch && indexerTypeMatch;
    });
  }, [debts, selectedBanks, selectedIndexerType]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);

  // Dados por banco para o gráfico de pizza
  const bankData = useMemo(() => {
    return filteredDebts.reduce((acc, debt) => {
      const existing = acc.find(item => item.name === debt.bank);
      if (existing) {
        existing.value += debt.financedAmount;
        existing.count += 1;
      } else {
        acc.push({ 
          name: debt.bank, 
          value: debt.financedAmount,
          count: 1
        });
      }
      return acc;
    }, [] as { name: string; value: number; count: number }[]);
  }, [filteredDebts]);

  // Dados por sistema de amortização
  const systemData = useMemo(() => {
    return filteredDebts.reduce((acc, debt) => {
      const existing = acc.find(item => item.name === debt.calculationTable);
      if (existing) {
        existing.value += debt.financedAmount;
        existing.count += 1;
      } else {
        acc.push({ 
          name: debt.calculationTable, 
          value: debt.financedAmount,
          count: 1
        });
      }
      return acc;
    }, [] as { name: string; value: number; count: number }[]);
  }, [filteredDebts]);

  // Dados comparativos de bancos (valor principal vs juros financiados)
  const bankComparisonData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return availableBanks.map(bank => {
      const bankDebts = filteredDebts.filter(debt => debt.bank === bank);
      
      let principalAmount = 0;
      let financedInterest = 0;

      if (viewType === 'total') {
        // TOTAL: Valor financiado original e juros totais do contrato
        principalAmount = bankDebts.reduce((sum, debt) => sum + debt.financedAmount, 0);
        
        // Calcular juros totais do contrato inteiro
        financedInterest = bankDebts.reduce((sum, debt) => {
          const installments = installmentsData[debt.id];
          if (installments && installments.length > 0) {
            // Somar todos os juros de todas as parcelas
            const totalInterest = installments.reduce((interestSum, inst) => 
              interestSum + inst.interest_amount, 0
            );
            return sum + totalInterest;
          } else {
            // Fallback: aproximação
            const months = Math.ceil((new Date(debt.dueDate).getTime() - new Date(debt.releaseDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
            const monthlyRate = debt.interestType === 'annual' 
              ? Math.pow(1 + debt.interestRate / 100, 1/12) - 1
              : debt.interestRate / 100;
            const totalInterest = debt.financedAmount * monthlyRate * months * 0.5;
            return sum + totalInterest;
          }
        }, 0);
      } else {
        // ATUAL: Saldo devedor atual e juros futuros remanescentes
        bankDebts.forEach(debt => {
          const installments = installmentsData[debt.id];
          if (installments && installments.length > 0) {
            // Filtrar parcelas futuras (a partir de hoje)
            const futureInstallments = installments.filter(inst => {
              const dueDate = new Date(inst.due_date);
              dueDate.setHours(0, 0, 0, 0);
              return dueDate >= today;
            });

            if (futureInstallments.length > 0) {
              // Saldo devedor = remaining_balance da primeira parcela futura
              principalAmount += futureInstallments[0].remaining_balance;
              
              // Juros futuros = soma dos juros de todas as parcelas futuras
              const futureInterest = futureInstallments.reduce((sum, inst) => 
                sum + inst.interest_amount, 0
              );
              financedInterest += futureInterest;
            }
          } else {
            // Fallback se não tiver installments calculados ainda
            principalAmount += debt.financedAmount;
            const months = Math.ceil((new Date(debt.dueDate).getTime() - new Date(debt.releaseDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
            const monthlyRate = debt.interestType === 'annual' 
              ? Math.pow(1 + debt.interestRate / 100, 1/12) - 1
              : debt.interestRate / 100;
            financedInterest += debt.financedAmount * monthlyRate * months * 0.5;
          }
        });
      }

      return {
        name: bank,
        principalAmount: principalAmount,
        financedInterest: financedInterest,
        count: bankDebts.length,
        bankDebts: bankDebts // Adicionar as dívidas para cálculo do CET
      };
    }).filter(item => item.count > 0);
  }, [availableBanks, filteredDebts, viewType, installmentsData]);

  // Hook para calcular CETs de cada dívida
  const cetResults = useMemo(() => {
    const results: { [key: string]: number } = {};
    filteredDebts.forEach(debt => {
      // Para cada dívida, vamos usar o hook useCET individualmente
      // Como não podemos usar hooks condicionalmente, vamos calcular o CET de forma síncrona
      results[debt.id] = 0; // Placeholder - será preenchido pelo componente CETCalculator
    });
    return results;
  }, [filteredDebts]);

  // Componente para calcular CET de uma dívida específica
  const CETCalculator = ({ debt, onCETCalculated }: { debt: Debt, onCETCalculated: (id: string, cet: number) => void }) => {
    const { cet } = useCET(debt, 'annual');
    
    React.useEffect(() => {
      if (cet !== null) {
        onCETCalculated(debt.id, cet);
      }
    }, [cet, debt.id, onCETCalculated]);

    return null;
  };

  // Estado para armazenar os CETs calculados
  const [calculatedCETs, setCalculatedCETs] = useState<{ [key: string]: number }>({});

  const handleCETCalculated = (debtId: string, cet: number) => {
    setCalculatedCETs(prev => ({ ...prev, [debtId]: cet }));
  };

  // Calcular CET médio ponderado por banco
  const bankComparisonDataWithCET = useMemo(() => {
    return bankComparisonData.map(item => {
      let totalWeightedCET = 0;
      let totalPrincipal = 0;

      item.bankDebts.forEach(debt => {
        const cet = calculatedCETs[debt.id];
        if (cet !== undefined && cet > 0) {
          totalWeightedCET += cet * debt.financedAmount;
          totalPrincipal += debt.financedAmount;
        }
      });

      const avgCET = totalPrincipal > 0 ? totalWeightedCET / totalPrincipal : 0;

      return {
        name: item.name,
        principalAmount: item.principalAmount,
        financedInterest: item.financedInterest,
        avgCET: avgCET,
        count: item.count
      };
    });
  }, [bankComparisonData, calculatedCETs]);

  // Dados de indexadores
  const indexerData = useMemo(() => {
    return filteredDebts
      .filter(debt => debt.indexer)
      .reduce((acc, debt) => {
        const existing = acc.find(item => item.name === debt.indexer);
        if (existing) {
          existing.value += debt.financedAmount;
          existing.count += 1;
        } else {
          acc.push({ 
            name: debt.indexer!, 
            value: debt.financedAmount,
            count: 1
          });
        }
        return acc;
      }, [] as { name: string; value: number; count: number }[]);
  }, [filteredDebts]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'principalAmount' && 'Valor Principal: '}
              {entry.dataKey === 'financedInterest' && 'Juros Financiados: '}
              {entry.dataKey === 'avgCET' && 'CET Médio: '}
              {entry.dataKey === 'value' && 'Valor: '}
              {entry.dataKey === 'avgCET' 
                ? `${entry.value.toFixed(2)}%`
                : formatCurrency(entry.value)
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{data.payload.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.payload.count} contrato{data.payload.count !== 1 ? 's' : ''}
          </p>
          <p className="text-sm font-medium" style={{ color: data.color }}>
            {formatCurrency(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const handleBankToggle = (bank: string) => {
    setSelectedBanks(prev => 
      prev.includes(bank) 
        ? prev.filter(b => b !== bank)
        : [...prev, bank]
    );
  };

  const clearFilters = () => {
    setSelectedBanks([]);
    setSelectedIndexerType("all");
  };

  if (debts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl bg-card p-8 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-primary/10">
              <PieChartIcon className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground">
                Gráficos e Análises
              </h2>
              <p className="text-muted-foreground">
                Visualize a distribuição e comparação de suas dívidas
              </p>
            </div>
          </div>
        </div>

        <Card className="border-2 border-dashed border-muted-foreground/25">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <PieChartIcon className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Nenhum contrato cadastrado
              </h3>
              <p className="text-muted-foreground">
                Cadastre suas dívidas para visualizar gráficos e análises
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Material 3 styling e filtros */}
      <div className="rounded-3xl bg-card p-8 border border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-primary/10">
            <PieChartIcon className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              Gráficos e Análises
            </h2>
            <p className="text-muted-foreground">
              Visualize a distribuição e comparação de suas dívidas
            </p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Filtrar por Bancos</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between bg-popover hover:bg-accent hover:text-accent-foreground"
                >
                  {selectedBanks.length === 0 
                    ? "Selecione os bancos" 
                    : `${selectedBanks.length} banco${selectedBanks.length !== 1 ? 's' : ''} selecionado${selectedBanks.length !== 1 ? 's' : ''}`
                  }
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-popover border border-border shadow-lg z-50">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground">Selecionar Bancos</h4>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedBanks([])}
                      className="h-6 px-2 text-xs"
                    >
                      Limpar
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableBanks.map((bank) => (
                      <div key={bank} className="flex items-center space-x-2 p-2 rounded hover:bg-accent">
                        <Checkbox
                          id={bank}
                          checked={selectedBanks.includes(bank)}
                          onCheckedChange={() => handleBankToggle(bank)}
                        />
                        <label 
                          htmlFor={bank} 
                          className="text-sm font-medium cursor-pointer flex-1"
                        >
                          {bank}
                        </label>
                        <Badge variant="outline" className="text-xs">
                          {debts.filter(d => d.bank === bank).length}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Pré/Pós Fixado</label>
            <Select value={selectedIndexerType} onValueChange={setSelectedIndexerType}>
              <SelectTrigger className="bg-popover">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="pre">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    Pré-fixado
                  </div>
                </SelectItem>
                <SelectItem value="pos">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    Pós-fixado
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tipo de Visualização</label>
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger className="bg-popover">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="bank">Distribuição por Banco</SelectItem>
                <SelectItem value="system">Sistema de Amortização</SelectItem>
                <SelectItem value="comparison">Comparativo de Bancos</SelectItem>
                <SelectItem value="indexer">Por Indexador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button 
              variant="outline" 
              onClick={clearFilters}
              className="w-full"
            >
              <Filter className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {(selectedBanks.length > 0 || selectedIndexerType !== "all") && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-sm text-muted-foreground">Filtros ativos:</span>
            {selectedBanks.map((bank) => (
              <Badge key={bank} variant="secondary" className="flex items-center gap-1">
                {bank}
                <button 
                  onClick={() => handleBankToggle(bank)}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </Badge>
            ))}
            {selectedIndexerType !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${selectedIndexerType === 'pre' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                {selectedIndexerType === 'pre' ? 'Pré-fixado' : 'Pós-fixado'}
                <button 
                  onClick={() => setSelectedIndexerType("all")}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {chartType === "bank" && (
          <>
            {/* Gráfico de Pizza - Distribuição por Banco */}
            <Card className="bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  Distribuição por Banco
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={bankData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={110}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {bankData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBankColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Resumo por Banco */}
            <Card className="bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  Resumo por Banco
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {bankData.map((bank, index) => (
                  <div key={bank.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: getBankColor(bank.name) }}
                      />
                      <span className="font-medium text-foreground">{bank.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatCurrency(bank.value)}</p>
                      <p className="text-xs text-muted-foreground">{bank.count} contrato{bank.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        {chartType === "system" && (
          <>
            {/* Gráfico de Pizza - Sistema de Amortização */}
            <Card className="bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
                    <PieChartIcon className="h-5 w-5 text-emerald-600" />
                  </div>
                  Sistema de Amortização
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={systemData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={110}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {systemData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(358 85% 55%)' : 'hsl(205 90% 45%)'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Resumo por Sistema */}
            <Card className="bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
                    <BarChart3 className="h-5 w-5 text-emerald-600" />
                  </div>
                  Detalhes do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {systemData.map((system, index) => (
                  <div key={system.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: index === 0 ? 'hsl(358 85% 55%)' : 'hsl(205 90% 45%)' }}
                      />
                      <span className="font-medium text-foreground">{system.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatCurrency(system.value)}</p>
                      <p className="text-xs text-muted-foreground">{system.count} contrato{system.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        {chartType === "comparison" && (
          <>
            {/* CET Calculators - componentes invisíveis para calcular os CETs */}
            {filteredDebts.map(debt => (
              <CETCalculator key={debt.id} debt={debt} onCETCalculated={handleCETCalculated} />
            ))}
            
            <Card className="md:col-span-2 bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                    </div>
                    Comparativo de Bancos
                  </CardTitle>
                  
                  <TooltipProvider>
                    <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={viewType === 'atual' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewType('atual')}
                            className="gap-2"
                          >
                            <Calendar className="h-4 w-4" />
                            Atual
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold mb-1">Visão Atual</p>
                          <p className="text-sm">
                            <strong>Valor Principal:</strong> Saldo devedor remanescente considerando a data de hoje
                          </p>
                          <p className="text-sm mt-1">
                            <strong>Juros Financiados:</strong> Total de juros a pagar nas parcelas futuras
                          </p>
                        </TooltipContent>
                      </UITooltip>
                      
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={viewType === 'total' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewType('total')}
                            className="gap-2"
                          >
                            <Receipt className="h-4 w-4" />
                            Total
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold mb-1">Visão Total do Contrato</p>
                          <p className="text-sm">
                            <strong>Valor Principal:</strong> Valor total financiado no início do contrato
                          </p>
                          <p className="text-sm mt-1">
                            <strong>Juros Financiados:</strong> Total de juros pagos durante toda a vigência do contrato
                          </p>
                        </TooltipContent>
                      </UITooltip>
                    </div>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={bankComparisonDataWithCET}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      fontSize={12}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis 
                      yAxisId="left"
                      tickFormatter={(value) => formatCurrency(value)}
                      fontSize={12}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(value) => `${value.toFixed(2)}%`}
                      fontSize={12}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar 
                      yAxisId="left"
                      dataKey="principalAmount" 
                      stackId="a"
                      fill="hsl(var(--chart-1))" 
                      name="Valor Principal"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar 
                      yAxisId="left"
                      dataKey="financedInterest" 
                      stackId="a"
                      fill="hsl(var(--chart-3))" 
                      name="Juros Financiados"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="avgCET" 
                      stroke="hsl(var(--chart-5))" 
                      strokeWidth={3}
                      name="CET Médio (%)"
                      dot={{ fill: "white", strokeWidth: 2, r: 5, stroke: "hsl(var(--chart-5))" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        {chartType === "indexer" && indexerData.length > 0 && (
          <Card className="md:col-span-2 bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                  <BarChart3 className="h-5 w-5 text-amber-600" />
                </div>
                Distribuição por Indexador
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={indexerData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                  layout="horizontal"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number"
                    tickFormatter={(value) => formatCurrency(value)}
                    fontSize={12}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    fontSize={12}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip content={<CustomPieTooltip />} />
                  <Bar 
                    dataKey="value" 
                    fill="hsl(var(--chart-2))" 
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {chartType === "indexer" && indexerData.length === 0 && (
          <Card className="md:col-span-2 bg-card border-2 border-dashed border-muted-foreground/25">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                  Nenhum indexador encontrado
                </h3>
                <p className="text-muted-foreground">
                  Os contratos filtrados não possuem indexadores cadastrados
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};