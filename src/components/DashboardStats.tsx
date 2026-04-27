import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, BarChart3, Filter, HelpCircle, Building2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TooltipKeys } from "@/lib/tooltips";
import { useTooltip } from "@/hooks/useTooltip";
import { useDashboardMetrics, type PeriodMode } from "@/hooks/useDashboardMetrics";
import { useDebts } from "@/hooks/useDebts";
import { normalizeDebtForCalculation } from "@/lib/debtUtils";
import { useMemo } from "react";
import type { DashboardWidgetDensity } from "@/components/dashboard/dashboardWidgetTypes";

interface DashboardStatsProps {
  startDate?: Date;
  endDate?: Date;
  periodMode: PeriodMode;
  selectedBank?: string;
  selectedCalculationType?: string;
  selectedDebtIds?: string[];
  onClearFilters?: () => void;
  density?: DashboardWidgetDensity;
}

function StatCardTooltipIcon({ tooltipKey, icon: Icon }: { tooltipKey: TooltipKeys; icon: React.ElementType }) {
  const { TooltipWrapper } = useTooltip(tooltipKey);
  return (
    <TooltipWrapper>
      <div className="ml-auto">
        <Icon className="h-4 w-4 text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-help" />
      </div>
    </TooltipWrapper>
  );
}

function SpreadValue({ cdiRate, spread }: { cdiRate: number | null; spread: number }) {
  const formatPercent = (value: number) =>
    `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  const formatSignedPercent = (value: number) =>
    `${value >= 0 ? "+ " : "- "}${formatPercent(Math.abs(value))}`;

  if (cdiRate === null) {
    return (
      <div className="mb-1 min-h-[2.25rem] text-3xl font-bold text-foreground tabular-nums">
        —
      </div>
    );
  }

  const totalRate = cdiRate + spread;

  return (
    <div className="relative mb-1 min-h-[2.25rem] whitespace-nowrap text-3xl font-bold text-foreground tabular-nums">
      <div className="transition-[opacity,transform] duration-300 ease-out group-hover:-translate-y-1 group-hover:opacity-0">
        <span className="text-muted-foreground">CDI </span>
        <span>{formatSignedPercent(spread)}</span>
      </div>
      <div className="absolute inset-0 translate-y-1 opacity-0 transition-[opacity,transform] duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
        <span>{formatPercent(totalRate)}</span>
      </div>
    </div>
  );
}

export const DashboardStats = ({
  startDate,
  endDate,
  periodMode,
  selectedBank,
  selectedCalculationType,
  selectedDebtIds,
  onClearFilters,
  density = "default",
}: DashboardStatsProps) => {
  const { metrics, isLoading } = useDashboardMetrics({
    startDate,
    endDate,
    periodMode,
    bankFilter: selectedBank,
    calculationTypeFilter: selectedCalculationType,
    debtIdsFilter: selectedDebtIds,
  });

  // Para o estado vazio precisamos saber se há dívidas cadastradas
  const { debts: dbDebts } = useDebts();
  const hasAnyDebts = dbDebts.length > 0;

  const isCompact = density === "compact";
  const sectionSpacingClass = isCompact ? "space-y-3" : "space-y-4";
  const gridGapClass = isCompact ? "gap-3" : "gap-4";
  const valueClass = `${isCompact ? "text-2xl" : "text-3xl"} font-bold text-foreground mb-1 tabular-nums`;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatMonth = (ym: string): string => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  };

  const currentOutstandingBalance = metrics?.currentOutstandingBalance ?? 0;
  const totalCurrentPMT = metrics?.currentPMT ?? 0;
  const averageMonthlyCET = metrics?.averageMonthlyCET ?? 0;
  const averageRemainingTerm = metrics?.averageRemainingTerm ?? 0;
  const cdiSpread = metrics?.cdiSpread ?? 0;
  const cdiForDisplay = metrics?.cdiSpread != null ? (metrics.averageAnnualCET - cdiSpread) : null;
  const sacCount = metrics?.sacVsPriceCount.sac ?? 0;
  const priceCount = metrics?.sacVsPriceCount.price ?? 0;
  const totalContracts = (metrics?.concentrationByBank.reduce(
    (s, _) => s,
    sacCount + priceCount,
  ) ?? 0);

  const pmtNext30d = metrics?.pmtNext30d ?? 0;
  const pmtNext90d = metrics?.pmtNext90d ?? 0;
  const peakMonthlyPmt12m = metrics?.peakMonthlyPmt12m ?? null;
  const topConcentrationBank = metrics?.concentrationByBank[0] ?? null;
  const contractsWithoutGuaranteeCount =
    (metrics?.guaranteeCoverage as { contractsWithoutGuaranteeCount?: number } | null)
      ?.contractsWithoutGuaranteeCount ?? null;

  const stats: Array<{
    title: string;
    value: string;
    icon: React.ElementType;
    trend: "high" | "warning" | "normal" | null;
    bgColor: string;
    iconColor: string;
    borderColor: string;
    tooltipKey: TooltipKeys;
    customValue?: React.ReactNode;
  }> = [
    {
      title: "Saldo Devedor Atual",
      value: formatCurrency(currentOutstandingBalance),
      icon: HelpCircle,
      trend: null,
      bgColor: "bg-card",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
      tooltipKey: TooltipKeys.CURRENT_OUTSTANDING_BALANCE,
    },
    {
      title: "Parcela Corrente",
      value: formatCurrency(totalCurrentPMT),
      icon: HelpCircle,
      trend: null,
      bgColor: "bg-card",
      iconColor: "text-amber-500",
      borderColor: "border-amber-500/30",
      tooltipKey: TooltipKeys.CURRENT_PAYMENT,
    },
    {
      title: "Prazo Médio Restante",
      value:
        averageRemainingTerm > 0
          ? `${Math.round(averageRemainingTerm)} ${Math.round(averageRemainingTerm) === 1 ? "mês" : "meses"}`
          : "Quitado",
      icon: HelpCircle,
      trend: averageRemainingTerm > 36 ? "high" : averageRemainingTerm > 12 ? "warning" : "normal",
      bgColor: "bg-card",
      iconColor:
        averageRemainingTerm > 36
          ? "text-destructive"
          : averageRemainingTerm > 12
          ? "text-amber-500"
          : "text-emerald-500",
      borderColor:
        averageRemainingTerm > 36
          ? "border-destructive/20"
          : averageRemainingTerm > 12
          ? "border-amber-500/30"
          : "border-emerald-500/30",
      tooltipKey: TooltipKeys.AVERAGE_REMAINING_TERM,
    },
    {
      title: "CET Média",
      value: `${averageMonthlyCET.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m.`,
      icon: HelpCircle,
      trend: averageMonthlyCET > 1.5 ? "high" : "normal",
      bgColor: "bg-card",
      iconColor: averageMonthlyCET > 1.5 ? "text-destructive" : "text-emerald-500",
      borderColor: averageMonthlyCET > 1.5 ? "border-destructive/20" : "border-emerald-500/30",
      tooltipKey: TooltipKeys.AVERAGE_RATE,
    },
    {
      title: "Spread Médio",
      value:
        metrics != null && metrics.cdiSpread != null
          ? `CDI + ${cdiSpread.toFixed(1)}%`
          : "Sem dados",
      customValue: <SpreadValue cdiRate={cdiForDisplay} spread={cdiSpread} />,
      icon: HelpCircle,
      trend: cdiSpread > 5 ? "high" : "normal",
      bgColor: "bg-card",
      iconColor: cdiSpread > 5 ? "text-destructive" : "text-muted-foreground",
      borderColor: cdiSpread > 5 ? "border-destructive/20" : "border-border",
      tooltipKey: TooltipKeys.AVERAGE_SPREAD,
    },
  ];

  return (
    <div className={sectionSpacingClass}>
      {/* Stats Cards */}
      <TooltipProvider>
        <div className={`grid ${gridGapClass} md:grid-cols-2 lg:grid-cols-5`}>
          {stats.map((stat, index) => (
            <Card
              key={index}
              className={`group ${stat.bgColor} ${stat.borderColor} border hover:shadow-card transition-shadow duration-300`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs uppercase tracking-eyebrow font-semibold text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <StatCardTooltipIcon tooltipKey={stat.tooltipKey} icon={stat.icon} />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-9 w-24 rounded bg-muted animate-pulse" />
                ) : (
                  stat.customValue ?? <div className={valueClass}>{stat.value}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </TooltipProvider>

      {/* Portfolio Breakdown */}
      {metrics != null && (
        <div className={`grid ${gridGapClass} md:grid-cols-2`}>
          <Card className="bg-card border border-border hover:shadow-card transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                Sistema de Amortização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                <span className="text-sm font-medium text-foreground">SAC</span>
                <Badge variant={sacCount > 0 ? "default" : "secondary"}>
                  {sacCount} contrato{sacCount !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                <span className="text-sm font-medium text-foreground">PRICE</span>
                <Badge variant={priceCount > 0 ? "default" : "secondary"}>
                  {priceCount} contrato{priceCount !== 1 ? "s" : ""}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border hover:shadow-card transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/10">
                  <DollarSign className="h-4 w-4 text-amber-500" />
                </div>
                Resumo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                <span className="text-sm font-medium text-foreground">Contratos ativos</span>
                <Badge variant="outline">{sacCount + priceCount}</Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                <span className="text-sm font-medium text-foreground">PMT mensal total</span>
                <span className="font-bold text-amber-500 tabular-nums">
                  {formatCurrency(totalCurrentPMT)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fluxo de caixa próximo */}
      {metrics != null && (
        <div className={`grid ${gridGapClass} md:grid-cols-3`}>
          <Card className="bg-card border border-border hover:shadow-card transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs uppercase tracking-eyebrow font-semibold text-muted-foreground">
                PMT 30 dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-20 rounded bg-muted animate-pulse" />
              ) : (
                <>
                  <div className={`${isCompact ? "text-xl" : "text-2xl"} font-bold text-foreground tabular-nums mb-1`}>
                    {formatCurrency(pmtNext30d)}
                  </div>
                  <p className="text-xs text-muted-foreground">acumulado / 30 dias</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border border-border hover:shadow-card transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs uppercase tracking-eyebrow font-semibold text-muted-foreground">
                PMT 90 dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-20 rounded bg-muted animate-pulse" />
              ) : (
                <>
                  <div className={`${isCompact ? "text-xl" : "text-2xl"} font-bold text-foreground tabular-nums mb-1`}>
                    {formatCurrency(pmtNext90d)}
                  </div>
                  <p className="text-xs text-muted-foreground">acumulado / 90 dias</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={`bg-card border ${peakMonthlyPmt12m && peakMonthlyPmt12m.total > totalCurrentPMT * 1.5 ? "border-amber-500/30" : "border-border"} hover:shadow-card transition-shadow duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs uppercase tracking-eyebrow font-semibold text-muted-foreground">
                Pico mensal 12m
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-20 rounded bg-muted animate-pulse" />
              ) : peakMonthlyPmt12m ? (
                <>
                  <div className={`${isCompact ? "text-xl" : "text-2xl"} font-bold text-foreground tabular-nums mb-1`}>
                    {formatCurrency(peakMonthlyPmt12m.total)}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatMonth(peakMonthlyPmt12m.month)}</p>
                </>
              ) : (
                <div className={`${isCompact ? "text-xl" : "text-2xl"} font-bold text-muted-foreground tabular-nums mb-1`}>—</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Concentração e garantias */}
      {metrics != null && (topConcentrationBank != null || contractsWithoutGuaranteeCount != null) && (
        <div className={`grid ${gridGapClass} ${topConcentrationBank != null && contractsWithoutGuaranteeCount != null ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
          {topConcentrationBank != null && (
            <Card className={`bg-card border ${topConcentrationBank.share > 0.55 ? "border-destructive/20" : topConcentrationBank.share > 0.35 ? "border-amber-500/30" : "border-border"} hover:shadow-card transition-shadow duration-300`}>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  Maior credor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium text-foreground">{topConcentrationBank.bank}</span>
                  <Badge variant={topConcentrationBank.share > 0.55 ? "destructive" : topConcentrationBank.share > 0.35 ? "outline" : "secondary"}>
                    {(topConcentrationBank.share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(topConcentrationBank.balance)} do saldo total
                </p>
              </CardContent>
            </Card>
          )}
          {contractsWithoutGuaranteeCount != null && (
            <Card className={`bg-card border ${contractsWithoutGuaranteeCount > 0 ? "border-amber-500/30" : "border-emerald-500/30"} hover:shadow-card transition-shadow duration-300`}>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className={`p-1.5 rounded-md ${contractsWithoutGuaranteeCount > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                    <ShieldAlert className={`h-4 w-4 ${contractsWithoutGuaranteeCount > 0 ? "text-amber-500" : "text-emerald-500"}`} />
                  </div>
                  Contratos sem garantia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium text-foreground">Sem cobertura</span>
                  <Badge
                    variant={contractsWithoutGuaranteeCount > 0 ? "outline" : "secondary"}
                    className={contractsWithoutGuaranteeCount > 0 ? "text-amber-600 border-amber-400/50" : ""}
                  >
                    {contractsWithoutGuaranteeCount} contrato{contractsWithoutGuaranteeCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
                {contractsWithoutGuaranteeCount === 0 && (
                  <p className="text-xs text-emerald-600">Todos os contratos têm garantia</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!isLoading && metrics == null && hasAnyDebts && (
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
              {onClearFilters && (
                <Button variant="outline" onClick={onClearFilters}>
                  Limpar Filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
