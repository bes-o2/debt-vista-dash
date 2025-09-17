import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Building, AlertTriangle } from "lucide-react";

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
}

interface DashboardStatsProps {
  debts: Debt[];
}

export const DashboardStats = ({ debts }: DashboardStatsProps) => {
  const totalFinanced = debts.reduce((sum, debt) => sum + debt.financedAmount, 0);
  const totalCosts = debts.reduce((sum, debt) => {
    let cost = debt.financedAmount;
    if (debt.iofAmount) cost += debt.iofAmount;
    if (debt.tacAmount) cost += debt.tacAmount;
    return sum + cost;
  }, 0);

  // Convert annual rates to monthly for comparison
  const normalizedRates = debts.map(debt => 
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
    
    return debts.filter(debt => {
      const dueDate = new Date(debt.dueDate);
      return dueDate >= today && dueDate <= nextMonth;
    }).length;
  };

  const getOverdueDebts = () => {
    const today = new Date();
    return debts.filter(debt => new Date(debt.dueDate) < today).length;
  };

  const getSacVsPriceDistribution = () => {
    const sac = debts.filter(debt => debt.calculationTable === 'SAC').length;
    const price = debts.filter(debt => debt.calculationTable === 'PRICE').length;
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
      gradient: "bg-gradient-primary"
    },
    {
      title: "Custo Total (c/ taxas)",
      value: formatCurrency(totalCosts),
      icon: Building,
      trend: null,
      gradient: "bg-gradient-warning"
    },
    {
      title: "Taxa Média (a.m.)",
      value: `${averageInterestRate.toFixed(3)}%`,
      icon: TrendingUp,
      trend: averageInterestRate > 1.5 ? "high" : "normal",
      gradient: averageInterestRate > 1.5 ? "bg-destructive" : "bg-gradient-success"
    },
    {
      title: "Vencimentos (30 dias)",
      value: `${upcomingDueDebts} contrato${upcomingDueDebts !== 1 ? 's' : ''}`,
      icon: Calendar,
      trend: upcomingDueDebts > 0 ? "warning" : "normal",
      gradient: upcomingDueDebts > 0 ? "bg-gradient-warning" : "bg-gradient-success"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-md ${stat.gradient} text-white`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              {stat.trend === "high" && (
                <p className="text-xs text-destructive flex items-center mt-1">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  Taxa elevada
                </p>
              )}
              {stat.trend === "warning" && (
                <p className="text-xs text-warning flex items-center mt-1">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Atenção necessária
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sistema de Amortização */}
      {debts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Sistema de Amortização</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">SAC</span>
                  <span className="font-medium text-foreground">{sac} contrato{sac !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">PRICE</span>
                  <span className="font-medium text-foreground">{price} contrato{price !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Resumo de Taxas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Contratos ativos</span>
                  <span className="font-medium text-foreground">{debts.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Impacto de taxas</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(totalCosts - totalFinanced)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {overdueDebts > 0 && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-destructive text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-destructive">
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
    </div>
  );
};