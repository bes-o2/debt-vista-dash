import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowRight, DollarSign, BarChart3, Filter, HelpCircle, Building2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TooltipKeys } from "@/lib/tooltips";
import { useTooltip } from "@/hooks/useTooltip";
import { useDashboardMetrics, type PeriodMode } from "@/hooks/useDashboardMetrics";
import { useDebts } from "@/hooks/useDebts";
import { normalizeDebtForCalculation } from "@/lib/debtUtils";
import { CET_NOT_CONVERGED_TOOLTIP } from "@/lib/cetStatus";
import { generateCfoAlerts, type CfoAlertCategory, type CfoAlertSeverity } from "@/lib/cfoAlerts";
import { CalculationInfoPopover } from "@/components/CalculationInfoPopover";
import { CalculationRuleKeys } from "@/lib/calculationRules";
import { useMemo } from "react";
import type { DashboardWidgetDensity } from "@/components/dashboard/dashboardWidgetTypes";
import type { GuaranteeMetrics } from "@/lib/guaranteeMetrics";

interface DashboardStatsProps {
  startDate?: Date;
  endDate?: Date;
  periodMode: PeriodMode;
  selectedBank?: string;
  selectedCalculationType?: string;
  selectedDebtIds?: string[];
  onClearFilters?: () => void;
  density?: DashboardWidgetDensity;
  cashPosition?: number;
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

const alertSeverityMeta: Record<
  CfoAlertSeverity,
  { label: string; badgeClass: string; itemClass: string; iconClass: string }
> = {
  critical: {
    label: "Crítico",
    badgeClass: "border-destructive/40 bg-destructive/10 text-destructive",
    itemClass: "border-destructive/25 bg-destructive/5",
    iconClass: "text-destructive",
  },
  warning: {
    label: "Atenção",
    badgeClass: "border-warning/40 bg-warning/10 text-warning",
    itemClass: "border-warning/25 bg-warning/5",
    iconClass: "text-warning",
  },
  info: {
    label: "Informativo",
    badgeClass: "border-border bg-muted/40 text-muted-foreground",
    itemClass: "border-border bg-muted/20",
    iconClass: "text-muted-foreground",
  },
};

const alertTargets: Record<CfoAlertCategory, { href: string; label: string }> = {
  concentracao_banco: {
    href: "#dashboard-widget-saldo-devedor-banco",
    label: "Ver bancos",
  },
  concentracao_indexador: {
    href: "#dashboard-widget-perfil-divida",
    label: "Ver perfil",
  },
  vencimentos_12m: {
    href: "#dashboard-widget-perfil-divida",
    label: "Ver vencimentos",
  },
  pmt_mensal_maximo: {
    href: "#dashboard-widget-perfil-divida",
    label: "Ver fluxo",
  },
  cobertura_garantias: {
    href: "#dashboard-garantias",
    label: "Ver garantias",
  },
  divida_liquida: {
    href: "#dashboard-widget-resumo-executivo",
    label: "Ver resumo",
  },
};

export const DashboardStats = ({
  startDate,
  endDate,
  periodMode,
  selectedBank,
  selectedCalculationType,
  selectedDebtIds,
  onClearFilters,
  density = "default",
  cashPosition = 0,
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
  const formatPercentage = (value: number) =>
    `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  const currentOutstandingBalance = metrics?.currentOutstandingBalance ?? 0;
  const netDebt = currentOutstandingBalance - cashPosition;
  const totalCurrentPMT = metrics?.currentPMT ?? 0;
  const averageMonthlyCET = metrics?.averageMonthlyCET ?? 0;
  const averageCetStatus = metrics?.averageCetStatus ?? "calculado";
  const isCetEstimated = metrics?.isCetEstimated ?? false;
  const averageRemainingTerm = metrics?.averageRemainingTerm ?? 0;
  const cdiSpread = metrics?.cdiSpread ?? 0;
  const cdiForDisplay = metrics?.cdiSpread != null ? (metrics.averageAnnualCET - cdiSpread) : null;
  const sacCount = metrics?.sacVsPriceCount.sac ?? 0;
  const priceCount = metrics?.sacVsPriceCount.price ?? 0;
  const totalContracts = sacCount + priceCount;

  const pmtNext30d = metrics?.pmtNext30d ?? 0;
  const pmtNext90d = metrics?.pmtNext90d ?? 0;
  const peakMonthlyPmt12m = metrics?.peakMonthlyPmt12m ?? null;
  const topConcentrationBank = metrics?.concentrationByBank[0] ?? null;
  const guaranteeMetrics = metrics?.guaranteeCoverage as GuaranteeMetrics | null;
  const contractsWithoutGuaranteeCount =
    guaranteeMetrics?.contractsWithoutGuaranteeCount ?? null;
  const guaranteeGapsByBank =
    guaranteeMetrics?.coverageByBank
      .map((item) => ({
        ...item,
        gap: Math.max(0, item.debtBalance - item.guaranteeValue),
      }))
      .filter((item) => item.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 3) ?? [];
  const cfoAlerts = useMemo(() => {
    if (metrics == null) return [];

    const guaranteeCoverage =
      metrics.guaranteeCoverage as
        | { totalGuaranteeValue?: number; totalDebtBalance?: number }
        | null;

    return generateCfoAlerts({
      concentrationByBank: metrics.concentrationByBank.map((item) => ({
        label: item.bank,
        amount: item.balance,
      })),
      concentrationByIndexer: metrics.concentrationByIndexer.map((item) => ({
        label: item.indexer,
        amount: item.balance,
      })),
      maturitiesNext12Months: metrics.maturitiesNext12MonthsByMonth,
      monthlyPmtProjection: metrics.monthlyPmtProjection,
      guaranteeCoverage: {
        guaranteeValue: guaranteeCoverage?.totalGuaranteeValue ?? 0,
        coveredDebtAmount: guaranteeCoverage?.totalDebtBalance ?? 0,
      },
      netDebt: {
        grossDebtAmount: currentOutstandingBalance,
        cashAndEquivalents: cashPosition,
        netDebtAmount: netDebt,
      },
    }).alerts
      .filter((alert) => alert.category !== "divida_liquida")
      .slice(0, 5);
  }, [cashPosition, currentOutstandingBalance, metrics, netDebt]);

  const stats: Array<{
    title: string;
    value: string;
    icon: React.ElementType;
    trend: "high" | "warning" | "normal" | null;
    bgColor: string;
    iconColor: string;
    borderColor: string;
    tooltipKey: TooltipKeys;
    calculationRuleKey?: CalculationRuleKeys;
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
      calculationRuleKey: CalculationRuleKeys.CURRENT_OUTSTANDING_BALANCE,
    },
    {
      title: "Parcela Corrente",
      value: formatCurrency(totalCurrentPMT),
      icon: HelpCircle,
      trend: null,
      bgColor: "bg-card",
      iconColor: "text-warning",
      borderColor: "border-warning/30",
      tooltipKey: TooltipKeys.CURRENT_PAYMENT,
      calculationRuleKey: CalculationRuleKeys.CURRENT_PAYMENT,
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
          ? "text-warning"
          : "text-success",
      borderColor:
        averageRemainingTerm > 36
          ? "border-destructive/20"
          : averageRemainingTerm > 12
          ? "border-warning/30"
          : "border-success/30",
      tooltipKey: TooltipKeys.AVERAGE_REMAINING_TERM,
      calculationRuleKey: CalculationRuleKeys.AVERAGE_REMAINING_TERM,
    },
    {
      title: "CET Média",
      value: `${averageMonthlyCET.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m.`,
      icon: HelpCircle,
      trend: averageCetStatus === "calculado" && averageMonthlyCET > 1.5 ? "high" : "normal",
      bgColor: "bg-card",
      iconColor:
        averageCetStatus === "calculado" && averageMonthlyCET > 1.5
          ? "text-destructive"
          : "text-success",
      borderColor:
        averageCetStatus === "calculado" && averageMonthlyCET > 1.5
          ? "border-destructive/20"
          : "border-success/30",
      tooltipKey: TooltipKeys.AVERAGE_RATE,
      calculationRuleKey: CalculationRuleKeys.AVERAGE_MONTHLY_CET,
      customValue:
        averageCetStatus === "nao_convergiu" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`${valueClass} cursor-help text-muted-foreground`}>—</div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{CET_NOT_CONVERGED_TOOLTIP}</p>
            </TooltipContent>
          </Tooltip>
        ) : isCetEstimated ? (
          <div className={valueClass}>
            ~{averageMonthlyCET.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m.
            <span className="ml-2 align-middle text-xs font-medium text-muted-foreground">
              estimado
            </span>
          </div>
        ) : averageCetStatus === "pendente" ? (
          <div className={`${valueClass} text-muted-foreground`}>calculando...</div>
        ) : undefined,
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
      calculationRuleKey: CalculationRuleKeys.AVERAGE_SPREAD,
    },
  ];

  return (
    <div className={sectionSpacingClass}>
      {metrics != null && (
        <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${netDebt < 0 ? "bg-success/10" : "bg-primary/10"}`}>
              <DollarSign className={`h-4 w-4 ${netDebt < 0 ? "text-success" : "text-primary"}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">
                Dívida Líquida
              </p>
              <p className={`text-xl font-bold tabular-nums ${netDebt < 0 ? "text-success" : "text-foreground"}`}>
                {formatCurrency(netDebt)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:justify-end">
            <span className="tabular-nums">
              Saldo: {formatCurrency(currentOutstandingBalance)}
            </span>
            <span className="hidden text-border sm:inline">|</span>
            <span className="tabular-nums">
              Caixa: {formatCurrency(cashPosition)}
            </span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <TooltipProvider>
        <div className={`grid ${gridGapClass} md:grid-cols-2 lg:grid-cols-5`}>
          {stats.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <Card
                key={index}
                className={`group ${stat.bgColor} ${stat.borderColor} border hover:shadow-card transition-shadow duration-300`}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-1.5">
                    <CardTitle className="text-xs uppercase tracking-eyebrow font-semibold text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    {stat.calculationRuleKey && (
                      <CalculationInfoPopover ruleKey={stat.calculationRuleKey} />
                    )}
                  </div>
                  <StatCardTooltipIcon tooltipKey={stat.tooltipKey} icon={Icon} />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-9 w-24 rounded bg-muted animate-pulse" />
                  ) : (
                    stat.customValue ?? <div className={valueClass}>{stat.value}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TooltipProvider>

      {metrics != null && cfoAlerts.length > 0 && (
        <Card className="bg-card border border-border hover:shadow-card transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
              Pontos de atenção
            </CardTitle>
            <Badge variant="outline">
              {cfoAlerts.length} alerta{cfoAlerts.length !== 1 ? "s" : ""}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className={`grid ${gridGapClass} lg:grid-cols-2`}>
              {cfoAlerts.map((alert) => {
                const meta = alertSeverityMeta[alert.severity];
                const target = alertTargets[alert.category];

                return (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-3 ${meta.itemClass}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={meta.badgeClass}>
                            {meta.label}
                          </Badge>
                          <span className="text-sm font-semibold text-foreground">
                            {alert.title}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {alert.summary}
                        </p>
                      </div>
                      <AlertTriangle className={`h-4 w-4 shrink-0 ${meta.iconClass}`} />
                    </div>

                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {alert.evidence.slice(0, 2).map((evidence) => (
                        <li key={evidence} className="leading-relaxed">
                          {evidence}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        {alert.recommendation}
                      </p>
                      <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 px-2">
                        <a href={target.href}>
                          {target.label}
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
                <div className="p-1.5 rounded-md bg-warning/10">
                  <DollarSign className="h-4 w-4 text-warning" />
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
                <span className="font-bold text-warning tabular-nums">
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
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-xs uppercase tracking-eyebrow font-semibold text-muted-foreground">
                  PMT 30 dias
                </CardTitle>
                <CalculationInfoPopover ruleKey={CalculationRuleKeys.PMT_NEXT_30D} />
              </div>
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
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-xs uppercase tracking-eyebrow font-semibold text-muted-foreground">
                  PMT 90 dias
                </CardTitle>
                <CalculationInfoPopover ruleKey={CalculationRuleKeys.PMT_NEXT_90D} />
              </div>
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

          <Card className={`bg-card border ${peakMonthlyPmt12m && peakMonthlyPmt12m.total > totalCurrentPMT * 1.5 ? "border-warning/30" : "border-border"} hover:shadow-card transition-shadow duration-300`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-xs uppercase tracking-eyebrow font-semibold text-muted-foreground">
                  Pico mensal 12m
                </CardTitle>
                <CalculationInfoPopover ruleKey={CalculationRuleKeys.PEAK_MONTHLY_PMT_12M} />
              </div>
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
      {metrics != null && (topConcentrationBank != null || guaranteeMetrics != null) && (
        <div id="dashboard-garantias" className={`grid ${gridGapClass} ${topConcentrationBank != null && guaranteeMetrics != null ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
          {topConcentrationBank != null && (
            <Card className={`bg-card border ${topConcentrationBank.share > 0.55 ? "border-destructive/20" : topConcentrationBank.share > 0.35 ? "border-warning/30" : "border-border"} hover:shadow-card transition-shadow duration-300`}>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <span>Maior credor</span>
                  <CalculationInfoPopover ruleKey={CalculationRuleKeys.TOP_CONCENTRATION_BANK} />
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
          {guaranteeMetrics != null && (
            <Card className={`bg-card border ${guaranteeMetrics.insufficientGuaranteeAlert || (contractsWithoutGuaranteeCount ?? 0) > 0 ? "border-warning/30" : "border-success/30"} hover:shadow-card transition-shadow duration-300`}>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className={`p-1.5 rounded-md ${guaranteeMetrics.insufficientGuaranteeAlert || (contractsWithoutGuaranteeCount ?? 0) > 0 ? "bg-warning/10" : "bg-success/10"}`}>
                    <ShieldAlert className={`h-4 w-4 ${guaranteeMetrics.insufficientGuaranteeAlert || (contractsWithoutGuaranteeCount ?? 0) > 0 ? "text-warning" : "text-success"}`} />
                  </div>
                  <span>Garantias</span>
                  <CalculationInfoPopover ruleKey={CalculationRuleKeys.GUARANTEE_COVERAGE} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <span className="text-xs text-muted-foreground">Valor total</span>
                    <div className="mt-1 font-bold text-foreground tabular-nums">
                      {formatCurrency(guaranteeMetrics.totalGuaranteeValue)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <span className="text-xs text-muted-foreground">Cobertura sobre saldo</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-bold text-foreground tabular-nums">
                        {formatPercentage(guaranteeMetrics.coveragePercentage)}
                      </span>
                      <Badge
                        variant={guaranteeMetrics.coverageRatio >= 1 ? "secondary" : "outline"}
                        className={guaranteeMetrics.coverageRatio < 1 ? "text-warning border-warning/50" : ""}
                      >
                        {guaranteeMetrics.coverageRatio >= 1 ? "Coberto" : "Gap"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium text-foreground">Contratos sem garantia</span>
                  <Badge
                    variant={(contractsWithoutGuaranteeCount ?? 0) > 0 ? "outline" : "secondary"}
                    className={(contractsWithoutGuaranteeCount ?? 0) > 0 ? "text-warning border-warning/50" : ""}
                  >
                    {contractsWithoutGuaranteeCount ?? 0} contrato{(contractsWithoutGuaranteeCount ?? 0) !== 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="rounded-lg bg-muted/30 p-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Gap por banco</span>
                    <Badge variant="outline">{guaranteeGapsByBank.length}</Badge>
                  </div>
                  {guaranteeGapsByBank.length > 0 ? (
                    <div className="space-y-2">
                      {guaranteeGapsByBank.map((item) => (
                        <div key={item.bank} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-muted-foreground">{item.bank}</span>
                          <span className="font-semibold text-warning tabular-nums">
                            {formatCurrency(item.gap)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-success">Sem gap de garantia por banco</p>
                  )}
                </div>

                {(contractsWithoutGuaranteeCount ?? 0) === 0 && (
                  <p className="text-xs text-success">Todos os contratos têm garantia cadastrada</p>
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
