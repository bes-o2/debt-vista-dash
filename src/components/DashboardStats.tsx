import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Building, AlertTriangle, BarChart3, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
}

export const DashboardStats = ({ debts }: DashboardStatsProps) => {
  const [selectedBank, setSelectedBank] = useState<string>("all");
  const [selectedCalculationType, setSelectedCalculationType] = useState<string>("all");

  // Get unique banks
  const availableBanks = useMemo(() => {
    return [...new Set(debts.map(debt => debt.bank))];
  }, [debts]);

  // Filter debts based on selections
  const filteredDebts = useMemo(() => {
    return debts.filter(debt => {
      const bankMatch = selectedBank === "all" || debt.bank === selectedBank;
      const typeMatch = selectedCalculationType === "all" || debt.calculationTable === selectedCalculationType;
      return bankMatch && typeMatch;
    });
  }, [debts, selectedBank, selectedCalculationType]);

  const totalFinanced = filteredDebts.reduce((sum, debt) => sum + debt.financedAmount, 0);
  const totalCosts = filteredDebts.reduce((sum, debt) => {
    let cost = debt.financedAmount;
    if (debt.iofAmount) cost += debt.iofAmount;
    if (debt.tacAmount) cost += debt.tacAmount;
    return sum + cost;
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
      currency: 'BRL' 
    }).format(value);

  const upcomingDueDebts = getDebtsWithUpcomingDueDate();
  const overdueDebts = getOverdueDebts();
  const { sac, price } = getSacVsPriceDistribution();

  const stats = [
    {
      title: "Total Financiado",
      value: formatCurrency(totalFinanced),
      icon: DollarSign,
      trend: null,
      bgColor: "bg-card",
      iconColor: "text-primary",
      borderColor: "border-primary/20"
    },
    {
      title: "Custo Total (c/ taxas)",
      value: formatCurrency(totalCosts),
      icon: Building,
      trend: null,
      bgColor: "bg-card",
      iconColor: "text-orange-600",
      borderColor: "border-orange-200"
    },
    {
      title: "Taxa Média (a.m.)",
      value: `${averageInterestRate.toFixed(3)}%`,
      icon: TrendingUp,
      trend: averageInterestRate > 1.5 ? "high" : "normal",
      bgColor: "bg-card",
      iconColor: averageInterestRate > 1.5 ? "text-destructive" : "text-emerald-600",
      borderColor: averageInterestRate > 1.5 ? "border-destructive/20" : "border-emerald-200"
    },
    {
      title: "Vencimentos (30 dias)",
      value: `${upcomingDueDebts} contrato${upcomingDueDebts !== 1 ? 's' : ''}`,
      icon: Calendar,
      trend: upcomingDueDebts > 0 ? "warning" : "normal",
      bgColor: "bg-card",
      iconColor: upcomingDueDebts > 0 ? "text-amber-600" : "text-emerald-600",
      borderColor: upcomingDueDebts > 0 ? "border-amber-200" : "border-emerald-200"
    }
  ];

  const clearFilters = () => {
    setSelectedBank("all");
    setSelectedCalculationType("all");
  };

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

        {/* Filters Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Filtrar por Banco</label>
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os bancos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os bancos</SelectItem>
                {availableBanks.map((bank) => (
                  <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Sistema de Amortização</label>
            <Select value={selectedCalculationType} onValueChange={setSelectedCalculationType}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os sistemas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os sistemas</SelectItem>
                <SelectItem value="SAC">SAC</SelectItem>
                <SelectItem value="PRICE">PRICE</SelectItem>
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
        {(selectedBank !== "all" || selectedCalculationType !== "all") && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Filtros ativos:</span>
            {selectedBank !== "all" && (
              <Badge variant="secondary">
                Banco: {selectedBank}
              </Badge>
            )}
            {selectedCalculationType !== "all" && (
              <Badge variant="secondary">
                Sistema: {selectedCalculationType}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index} className={`${stat.bgColor} ${stat.borderColor} border-2 hover:shadow-lg transition-all duration-300 group`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-3 rounded-xl bg-background/50 ${stat.iconColor} group-hover:scale-110 transition-transform duration-200`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground mb-1">{stat.value}</div>
              {stat.trend === "high" && (
                <p className="text-xs text-destructive flex items-center">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  Taxa elevada
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
            </CardContent>
          </Card>
        ))}
      </div>

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
                <span className="text-sm font-medium text-foreground">Impacto de taxas</span>
                <span className="font-bold text-orange-600">
                  {formatCurrency(totalCosts - totalFinanced)}
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
              <Button variant="outline" onClick={clearFilters}>
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};