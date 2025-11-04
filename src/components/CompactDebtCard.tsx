import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Calendar, DollarSign, Percent, Calculator, BarChart3, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

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
  cet_monthly_rate?: number;
  cet_annual_rate?: number;
  spread_rate?: number;
}

interface CompactDebtCardProps {
  debt: Debt;
  onEdit: (debt: Debt) => void;
  onDelete?: (debt: Debt) => void;
  onViewTable?: (debt: Debt) => void;
  onViewAnalysis?: (debt: Debt) => void;
}

export const CompactDebtCard = ({ debt, onEdit, onDelete, onViewTable, onViewAnalysis }: CompactDebtCardProps) => {
  // Use stored CET values from database
  const cetMonthly = debt.cet_monthly_rate;
  const cetAnnual = debt.cet_annual_rate;
  
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

  // Convert interest rate to show both monthly and annual
  const getMonthlyRate = () => {
    // For post-fixed debts, show indexer + spread
    if (debt.indexer && debt.indexer !== 'Pré-fixado') {
      // Show just the spread for now (will be combined with real-time indexer later)
      const spreadRate = debt.spread_rate || 0;
      // Convert annual spread to monthly for display
      return (Math.pow(1 + spreadRate / 100, 1 / 12) - 1) * 100;
    }
    
    // For pre-fixed debts
    if (debt.interestType === 'monthly') {
      return debt.interestRate;
    }
    // Convert annual to monthly: (1 + annual)^(1/12) - 1
    return (Math.pow(1 + debt.interestRate / 100, 1 / 12) - 1) * 100;
  };

  const getAnnualRate = () => {
    // For post-fixed debts, show indexer + spread
    if (debt.indexer && debt.indexer !== 'Pré-fixado') {
      return debt.spread_rate || 0;
    }
    
    // For pre-fixed debts
    if (debt.interestType === 'annual') {
      return debt.interestRate;
    }
    // Convert monthly to annual: (1 + monthly)^12 - 1
    return (Math.pow(1 + debt.interestRate / 100, 12) - 1) * 100;
  };

  const monthlyRate = getMonthlyRate();
  const annualRate = getAnnualRate();

  const daysUntilDue = getDaysUntilDue(debt.dueDate);
  const isOverdue = daysUntilDue < 0;
  const isDueSoon = daysUntilDue <= 7 && daysUntilDue >= 0;

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
              #{debt.bank}{debt.contractNumber ? ` - ${debt.contractNumber}` : ''}
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
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Contrato</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir este contrato do <strong>{debt.bank}</strong>?
                      <br />
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(debt)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4 items-center">
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
              {debt.indexer && debt.indexer !== 'Pré-fixado' ? (
                <span className="flex flex-col">
                  <span className="text-xs">{debt.indexer} + {annualRate.toFixed(2)}% a.a</span>
                  <span className="text-xs text-muted-foreground">Spread: {monthlyRate.toFixed(4)}% a.m</span>
                </span>
              ) : (
                <span>{monthlyRate.toFixed(2)}% a.m | {annualRate.toFixed(2)}% a.a</span>
              )}
            </span>
          </div>

          {/* CET */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <Percent className="h-3 w-3" />
              <span className="text-xs">CET</span>
            </div>
            <span className="text-sm font-medium text-primary">
              {(cetMonthly !== null && cetMonthly !== undefined && 
                cetAnnual !== null && cetAnnual !== undefined &&
                !isNaN(cetMonthly) && !isNaN(cetAnnual)) ? (
                `${cetMonthly.toFixed(2)}% a.m | ${cetAnnual.toFixed(2)}% a.a`
              ) : (
                <span className="text-xs text-muted-foreground">Calcular</span>
              )}
            </span>
          </div>

          {/* Início */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              <span className="text-xs">Início</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {formatDate(debt.releaseDate)}
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