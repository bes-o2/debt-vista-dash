import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Building, AlertTriangle, BarChart3, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEconomicIndices } from "@/hooks/useEconomicIndices";
import { useCET } from "@/hooks/useCET";
import { TooltipKeys } from "@/lib/tooltips";
import { useTooltip } from "@/hooks/useTooltip";

interface Debt {
  id: string;
  financedAmount: number;
  releaseDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  indexer?: string;
  interestRate: number;
  interestType: 'monthly' | 'annual';
  iofAmount?: number;
  tacAmount?: number;
  bank: string;
  contractNumber?: string;
}

interface DashboardStatsProps {
  debts: Debt[];
  selectedBank?: string;
  selectedCalculationType?: string;
  selectedDebts?: string[];
}

export const DashboardStats = ({ 
  debts, 
  selectedBank = "all", 
  selectedCalculationType = "all", 
  selectedDebts = [] 
}: DashboardStatsProps) => {
  const { latestRates } = useEconomicIndices();
  // Filter debts based on selections
  const filteredDebts = useMemo(() => {
    return debts.filter(debt => {
      const bankMatch = selectedBank === "all" || debt.bank === selectedBank;
      const typeMatch = selectedCalculationType === "all" || debt.calculationTable === selectedCalculationType;
      const debtMatch = selectedDebts.length === 0 || selectedDebts.includes(debt.id);
      return bankMatch && typeMatch && debtMatch;
    });
  }, [debts, selectedBank, selectedCalculationType, selectedDebts]);

  const totalFinanced = filteredDebts.reduce((sum, debt) => sum + debt.financedAmount, 0);
  
  // Calculate current total PMT
  const totalCurrentPMT = filteredDebts.reduce((sum, debt) => {
    const releaseDate = new Date(debt.releaseDate);
    const dueDate = new Date(debt.dueDate);
    const termInMonths = Math.ceil((dueDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    if (termInMonths <= 0) return sum;
    
    // Convert interest rate to monthly decimal
    let monthlyRate = debt.interestType === 'annual' 
      ? Math.pow(1 + debt.interestRate / 100, 1/12) - 1
      : debt.interestRate / 100;
    
    const principal = debt.financedAmount;
    let pmt = 0;
    
    if (debt.calculationTable === 'PRICE') {
      // PRICE: Fixed installments
      if (monthlyRate > 0) {
        pmt = principal * (monthlyRate * Math.pow(1 + monthlyRate, termInMonths)) / 
              (Math.pow(1 + monthlyRate, termInMonths) - 1);
      } else {
        pmt = principal / termInMonths;
      }
    } else {
      // SAC: Current installment (assuming we want current month's installment)
      const amortization = principal / termInMonths;
      const currentInterest = principal * monthlyRate; // First installment interest
      pmt = amortization + currentInterest;
    }
    
    return sum + pmt;
  }, 0);

  // Convert annual rates to monthly for comparison
  const normalizedRates = filteredDebts.map(debt => 
    debt.interestType === 'annual' 
      ? Math.pow(1 + debt.interestRate / 100, 1/12) - 1
      : debt.interestRate / 100
  );

  const averageInterestRate = normalizedRates.length > 0 
    ? (normalizedRates.reduce((sum, rate) => sum + rate, 0) / normalizedRates.length) * 100
    : 0;

  const getDebtsWithUpcomingDueDate = () => {
    const today = new Date();
    const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return filteredDebts.filter(debt => {
      const dueDate = new Date(debt.dueDate);
      return dueDate >= today && dueDate <= nextMonth;
    }).length;
  };

  const getOverdueDebts = () => {
    const today = new Date();
    return filteredDebts.filter(debt => new Date(debt.dueDate) < today).length;
  };

  const getSacVsPriceDistribution = () => {
    const sac = filteredDebts.filter(debt => debt.calculationTable === 'SAC').length;
    const price = filteredDebts.filter(debt => debt.calculationTable === 'PRICE').length;
    return { sac, price };
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);

  const upcomingDueDebts = getDebtsWithUpcomingDueDate();
  const overdueDebts = getOverdueDebts();
  const { sac, price } = getSacVsPriceDistribution();

  // Calculate average CET and spreads
  const averageCET = useMemo(() => {
    if (filteredDebts.length === 0) return 0;
    
    let totalCET = 0;
    let validDebts = 0;

    filteredDebts.forEach(debt => {
      // Convert interest rate to annual percentage for CET calculation
      let annualRate = debt.interestRate;
      if (debt.interestType === 'monthly') {
        // Convert monthly to annual: (1 + monthly)^12 - 1
        annualRate = (Math.pow(1 + debt.interestRate / 100, 12) - 1) * 100;
      }
      
      // Add impact of fees to get CET approximation
      const totalAmount = debt.financedAmount + (debt.iofAmount || 0) + (debt.tacAmount || 0);
      const feeImpact = totalAmount > debt.financedAmount 
        ? ((totalAmount / debt.financedAmount - 1) * 100) 
        : 0;
      
      const approximateCET = annualRate + feeImpact;
      
      totalCET += approximateCET;
      validDebts++;
    });

    return validDebts > 0 ? totalCET / validDebts : 0;
  }, [filteredDebts]);

  const currentCDI = latestRates?.CDI?.value || 0;
  const currentSELIC = latestRates?.SELIC?.value || 0;
  
  const cdiSpread = averageCET - currentCDI;
  const selicSpread = averageCET - currentSELIC;

  const stats = [
    {
      title: "Total Financiado",
      value: formatCurrency(totalFinanced),
      icon: DollarSign,
      trend: null,
      bgColor: "bg-card",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
      tooltipKey: TooltipKeys.TOTAL_FINANCED
    },
    {
      title: "Parcela Corrente",
      value: formatCurrency(totalCurrentPMT),
      icon: Building,
      trend: null,
      bgColor: "bg-card",
      iconColor: "text-orange-600",
      borderColor: "border-orange-200",
      tooltipKey: TooltipKeys.CURRENT_PAYMENT
    },
    {
      title: "Taxa Média (a.m.)",
      value: `${averageInterestRate.toFixed(1)}%`,
      icon: TrendingUp,
      trend: averageInterestRate > 1.5 ? "high" : "normal",
      bgColor: "bg-card",
      iconColor: averageInterestRate > 1.5 ? "text-destructive" : "text-emerald-600",
      borderColor: averageInterestRate > 1.5 ? "border-destructive/20" : "border-emerald-200",
      tooltipKey: TooltipKeys.AVERAGE_RATE
    },
    {
      title: "Vencimentos (30 dias)",
      value: `${upcomingDueDebts} contrato${upcomingDueDebts !== 1 ? 's' : ''}`,
      icon: Calendar,
      trend: upcomingDueDebts > 0 ? "warning" : "normal",
      bgColor: "bg-card",
      iconColor: upcomingDueDebts > 0 ? "text-amber-600" : "text-emerald-600",
      borderColor: upcomingDueDebts > 0 ? "border-amber-200" : "border-emerald-200",
      tooltipKey: TooltipKeys.UPCOMING_DUE
    },
    {
      title: "Spread Médio",
      value: filteredDebts.length > 0 && currentCDI > 0 ? 
        `CDI + ${cdiSpread.toFixed(1)}%` : 
        "Sem dados",
      icon: TrendingUp,
      trend: cdiSpread > 5 ? "high" : "normal",
      bgColor: "bg-card",
      iconColor: cdiSpread > 5 ? "text-destructive" : "text-blue-600",
      borderColor: cdiSpread > 5 ? "border-destructive/20" : "border-blue-200",
      tooltipKey: TooltipKeys.AVERAGE_SPREAD
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Material 3 styling */}
      <div className="rounded-3xl bg-card p-8 border border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-primary/10">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              Dashboard Financeiro
            </h2>
            <p className="text-muted-foreground">
              Visão geral e análise de suas dívidas e financiamentos
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <TooltipProvider>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat, index) => (
            <Card key={index} className={`${stat.bgColor} ${stat.borderColor} border-2 hover:shadow-lg transition-all duration-300 group`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-bold text-foreground">
                  {stat.title}
                </CardTitle>
                {(() => {
                  const { TooltipWrapper } = useTooltip(stat.tooltipKey);
                  return (
                    <TooltipWrapper>
                      <div className={`p-3 rounded-xl bg-background/50 ${stat.iconColor} group-hover:scale-110 transition-transform duration-200 ring-2 ring-white/20 hover:ring-white/40 cursor-help`}>
                        <stat.icon className="h-5 w-5" />
                      </div>
                    </TooltipWrapper>
                  );
                })()}
              </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground mb-1">{stat.value}</div>
              {stat.trend === "high" && (
                <p className="text-xs text-destructive flex items-center">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  {stat.title.includes("Spread") ? "Spread elevado" : "Taxa elevada"}
                </p>
              )}
              {stat.trend === "warning" && (
                <p className="text-xs text-amber-600 flex items-center">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Atenção necessária
                </p>
              )}
              {stat.trend === "normal" && stat.title.includes("Taxa") && (
                <p className="text-xs text-emerald-600 flex items-center">
                  Taxa adequada
                </p>
              )}
              {stat.trend === "normal" && stat.title.includes("Spread") && (
                <p className="text-xs text-blue-600 flex items-center">
                  Spread adequado
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        </div>
      </TooltipProvider>

      {/* Sistema de Amortização */}
      {filteredDebts.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                Sistema de Amortização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium text-foreground">SAC</span>
                <Badge variant={sac > 0 ? "default" : "secondary"}>
                  {sac} contrato{sac !== 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium text-foreground">PRICE</span>
                <Badge variant={price > 0 ? "default" : "secondary"}>
                  {price} contrato{price !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-2 border-border hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                  <DollarSign className="h-5 w-5 text-orange-600" />
                </div>
                Resumo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium text-foreground">Contratos ativos</span>
                <Badge variant="outline">{filteredDebts.length}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium text-foreground">PMT mensal total</span>
                <span className="font-bold text-orange-600">
                  {formatCurrency(totalCurrentPMT)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {overdueDebts > 0 && (
        <Card className="bg-destructive/5 border-2 border-destructive/20 hover:shadow-lg transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-destructive text-lg">
                  {overdueDebts} contrato{overdueDebts !== 1 ? 's' : ''} vencido{overdueDebts !== 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Verifique os contratos vencidos e organize os pagamentos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredDebts.length === 0 && debts.length > 0 && (
        <Card className="bg-card border-2 border-dashed border-muted-foreground/25">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Filter className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Nenhum contrato encontrado
              </h3>
              <p className="text-muted-foreground mb-4">
                Os filtros aplicados não retornaram resultados. Tente ajustar os critérios de busca.
              </p>
              <Button variant="outline" onClick={() => {}}>
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};