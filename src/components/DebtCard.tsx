import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Calendar, DollarSign } from "lucide-react";

interface Debt {
  id: string;
  name: string;
  amount: number;
  interestRate: number;
  dueDate: string;
  minimumPayment: number;
  category: string;
}

interface DebtCardProps {
  debt: Debt;
  onEdit: (debt: Debt) => void;
}

export const DebtCard = ({ debt, onEdit }: DebtCardProps) => {
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);

  const formatDate = (dateString: string) => 
    new Date(dateString).toLocaleDateString('pt-BR');

  const getDaysUntilDue = (dateString: string) => {
    const today = new Date();
    const dueDate = new Date(dateString);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilDue = getDaysUntilDue(debt.dueDate);
  const isOverdue = daysUntilDue < 0;
  const isDueSoon = daysUntilDue <= 7 && daysUntilDue >= 0;

  return (
    <Card className="group hover:shadow-elegant transition-all duration-300 bg-gradient-card border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            {debt.name}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(debt)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
        <Badge 
          variant={debt.category === 'Cartão de Crédito' ? 'destructive' : 'secondary'}
          className="w-fit"
        >
          {debt.category}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">Valor total</span>
          </div>
          <span className="text-xl font-bold text-foreground">
            {formatCurrency(debt.amount)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Taxa de juros</span>
          <span className="font-medium text-foreground">
            {debt.interestRate.toFixed(2)}% a.m.
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Pagamento mínimo</span>
          <span className="font-medium text-foreground">
            {formatCurrency(debt.minimumPayment)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Vencimento</span>
          </div>
          <div className="text-right">
            <div className="font-medium text-foreground">
              {formatDate(debt.dueDate)}
            </div>
            <div className={`text-xs ${
              isOverdue 
                ? 'text-destructive' 
                : isDueSoon 
                  ? 'text-warning' 
                  : 'text-muted-foreground'
            }`}>
              {isOverdue 
                ? `${Math.abs(daysUntilDue)} dias em atraso`
                : isDueSoon
                  ? `${daysUntilDue} dias restantes`
                  : `${daysUntilDue} dias restantes`
              }
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};