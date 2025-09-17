import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Calendar, DollarSign, TrendingUp, Building } from "lucide-react";

interface Debt {
  id: string;
  financedAmount: number;
  releaseDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  indexer?: string;
  interestRate: number;
  interestRateType: 'monthly' | 'annual';
  iofAmount?: number;
  tacAmount?: number;
  bank: string;
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

  const getTotalCost = () => {
    let total = debt.financedAmount;
    if (debt.iofAmount) total += debt.iofAmount;
    if (debt.tacAmount) total += debt.tacAmount;
    return total;
  };

  const daysUntilDue = getDaysUntilDue(debt.dueDate);
  const isOverdue = daysUntilDue < 0;
  const isDueSoon = daysUntilDue <= 7 && daysUntilDue >= 0;

  return (
    <Card className="group hover:shadow-elegant transition-all duration-300 bg-gradient-card border-border/50">
      <div className="flex">
        {/* Left Section - Bank and Header */}
        <div className="flex-shrink-0 w-64 p-6 border-r border-border/50 bg-muted/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gradient-primary text-white">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">
                {debt.bank}
              </h3>
              <p className="text-sm text-muted-foreground">
                Financiamento #{debt.id.slice(-4)}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Badge 
              variant={debt.calculationTable === 'SAC' ? 'default' : 'secondary'}
              className="w-fit"
            >
              {debt.calculationTable}
            </Badge>
            {debt.indexer && (
              <Badge variant="outline" className="w-fit">
                {debt.indexer}
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(debt)}
            className="mt-4 w-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>

        {/* Right Section - Details */}
        <div className="flex-1 p-6">
          <div className="grid grid-cols-2 gap-6 h-full">
            {/* Financial Info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">Valor Financiado</span>
                </div>
                <span className="text-xl font-bold text-foreground">
                  {formatCurrency(debt.financedAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Taxa de juros</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  {debt.interestRate.toFixed(3)}% {debt.interestRateType === 'monthly' ? 'a.m.' : 'a.a.'}
                </span>
              </div>

              {(debt.iofAmount || debt.tacAmount) && (
                <div className="space-y-2">
                  {debt.iofAmount && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">IOF</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(debt.iofAmount)}
                      </span>
                    </div>
                  )}
                  {debt.tacAmount && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">TAC</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(debt.tacAmount)}
                      </span>
                    </div>
                  )}
                  <hr className="border-border/50" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Custo Total</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(getTotalCost())}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="space-y-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Liberação</span>
                </div>
                <div className="text-base font-medium text-foreground">
                  {formatDate(debt.releaseDate)}
                </div>
              </div>

              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Vencimento</span>
                </div>
                <div className="text-base font-medium text-foreground">
                  {formatDate(debt.dueDate)}
                </div>
                <div className={`text-sm mt-2 ${
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
          </div>
        </div>
      </div>
    </Card>
  );
};