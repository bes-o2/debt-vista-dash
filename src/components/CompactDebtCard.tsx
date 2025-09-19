import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Calendar, DollarSign, Percent, Calculator, BarChart3 } from "lucide-react";
import { useCET } from "@/hooks/useCET";

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

interface CompactDebtCardProps {
  debt: Debt;
  onEdit: (debt: Debt) => void;
  onViewTable?: (debt: Debt) => void;
  onViewAnalysis?: (debt: Debt) => void;
}

export const CompactDebtCard = ({ debt, onEdit, onViewTable, onViewAnalysis }: CompactDebtCardProps) => {
  const { cet, loading: cetLoading } = useCET(debt);
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);

  const formatDate = (dateString: string) => 
    new Date(dateString).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit' 
    });

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

  // Generate contract number if not available
  const contractDisplay = debt.contractNumber || `CT${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  return (
    <Card className="group hover:shadow-md transition-all duration-200 bg-gradient-card border-border/50 relative">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs px-2 py-1">
                {debt.calculationTable}
              </Badge>
              {debt.indexer && (
                <Badge variant="secondary" className="text-xs px-2 py-1">
                  {debt.indexer}
                </Badge>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              #{contractDisplay}
            </span>
          </div>
          
          {/* Action buttons - always visible for better UX */}
          <div className="flex gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
            <Button 
              onClick={() => onEdit(debt)}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            {onViewTable && (
              <Button 
                onClick={() => onViewTable(debt)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <Calculator className="h-3 w-3" />
              </Button>
            )}
            {onViewAnalysis && (
              <Button 
                onClick={() => onViewAnalysis(debt)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <BarChart3 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 items-center">
          {/* Valor Financiado */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3" />
              <span className="text-xs">Valor</span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {formatCurrency(debt.financedAmount)}
            </span>
          </div>

          {/* Taxa de Juros */}
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground mb-1">Taxa</span>
            <span className="text-sm font-medium text-foreground">
              {debt.interestType === 'monthly' 
                ? `${debt.interestRate.toFixed(2)}% a.m.`
                : `${debt.interestRate.toFixed(2)}% a.a.`
              }
            </span>
          </div>

          {/* CET */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <Percent className="h-3 w-3" />
              <span className="text-xs">CET</span>
            </div>
            <span className="text-sm font-medium text-primary">
              {cetLoading ? (
                <span className="text-xs">...</span>
              ) : cet ? (
                `${cet.toFixed(2)}%`
              ) : (
                <span className="text-xs text-muted-foreground">N/A</span>
              )}
            </span>
          </div>

          {/* Vencimento */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              <span className="text-xs">Venc.</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {formatDate(debt.dueDate)}
            </span>
            <span className={`text-xs ${
              isOverdue 
                ? 'text-destructive' 
                : isDueSoon 
                  ? 'text-warning' 
                  : 'text-muted-foreground'
            }`}>
              {isOverdue 
                ? `${Math.abs(daysUntilDue)}d atraso`
                : `${daysUntilDue}d rest.`
              }
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};