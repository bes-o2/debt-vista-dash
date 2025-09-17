import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Calendar, CreditCard, AlertTriangle } from "lucide-react";

interface Debt {
  id: string;
  name: string;
  amount: number;
  interestRate: number;
  dueDate: string;
  minimumPayment: number;
  category: string;
}

interface DashboardStatsProps {
  debts: Debt[];
}

export const DashboardStats = ({ debts }: DashboardStatsProps) => {
  const totalDebt = debts.reduce((sum, debt) => sum + debt.amount, 0);
  const totalMinimumPayment = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
  const averageInterestRate = debts.length > 0 
    ? debts.reduce((sum, debt) => sum + debt.interestRate, 0) / debts.length 
    : 0;

  const getDebtsWithUpcomingDueDate = () => {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return debts.filter(debt => {
      const dueDate = new Date(debt.dueDate);
      return dueDate >= today && dueDate <= nextWeek;
    }).length;
  };

  const getOverdueDebts = () => {
    const today = new Date();
    return debts.filter(debt => new Date(debt.dueDate) < today).length;
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);

  const upcomingDueDebts = getDebtsWithUpcomingDueDate();
  const overdueDebts = getOverdueDebts();

  const stats = [
    {
      title: "Dívida Total",
      value: formatCurrency(totalDebt),
      icon: DollarSign,
      trend: null,
      gradient: "bg-gradient-primary"
    },
    {
      title: "Pagamento Mínimo Total",
      value: formatCurrency(totalMinimumPayment),
      icon: CreditCard,
      trend: null,
      gradient: "bg-gradient-warning"
    },
    {
      title: "Taxa Média de Juros",
      value: `${averageInterestRate.toFixed(2)}% a.m.`,
      icon: TrendingUp,
      trend: averageInterestRate > 3 ? "high" : "normal",
      gradient: averageInterestRate > 3 ? "bg-destructive" : "bg-gradient-success"
    },
    {
      title: "Vencimentos Próximos",
      value: `${upcomingDueDebts} dívida${upcomingDueDebts !== 1 ? 's' : ''}`,
      icon: Calendar,
      trend: upcomingDueDebts > 0 ? "warning" : "normal",
      gradient: upcomingDueDebts > 0 ? "bg-gradient-warning" : "bg-gradient-success"
    }
  ];

  return (
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

      {overdueDebts > 0 && (
        <Card className="md:col-span-2 lg:col-span-4 bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-destructive text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-destructive">
                  {overdueDebts} dívida{overdueDebts !== 1 ? 's' : ''} em atraso
                </h3>
                <p className="text-sm text-muted-foreground">
                  Verifique as dívidas vencidas e organize os pagamentos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};