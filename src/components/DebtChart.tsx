import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Filter,
  Landmark,
  Receipt,
  TrendingUp,
  X,
} from "lucide-react";
import { useDebtInstallments } from "@/hooks/useDebtInstallments";
import { debtIntersectsDateRange } from "@/lib/debtUtils";
import { cn } from "@/lib/utils";
import type {
  DashboardWidgetDensity,
  DashboardWidgetViewMode,
} from "@/components/dashboard/dashboardWidgetTypes";

interface Debt {
  id: string;
  financedAmount: number;
  releaseDate: string;
  firstDueDate: string;
  dueDate: string;
  calculationTable: "SAC" | "PRICE";
  indexer?: string;
  interestRate: number;
  interestType: "monthly" | "annual";
  bank: string;
  iofAmount?: number;
  tacAmount?: number;
  contractNumber?: string;
  cet_monthly_rate?: number;
  cet_annual_rate?: number;
}

interface DebtChartProps {
  debts: Debt[];
  selectedBank?: string;
  startDate?: Date;
  endDate?: Date;
  viewType?: DashboardWidgetViewMode;
  density?: DashboardWidgetDensity;
  unstyled?: boolean;
  hideTitle?: boolean;
  onViewTypeChange?: (viewType: DashboardWidgetViewMode) => void;
}

type ViewType = DashboardWidgetViewMode;

type ComparisonTooltipItem = {
  dataKey?: string;
  payload?: BankComparisonRow;
};

type BankComparisonRow = {
  name: string;
  principalAmount: number;
  financedInterest: number;
  totalAmount: number;
  avgCET: number;
  count: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatCurrencyShort = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return `R$ ${value.toFixed(0)}`;
};

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

const getPrimaryMetricLabel = (viewType: ViewType) =>
  viewType === "total" ? "Valor financiado" : "Saldo devedor";

const getInterestMetricLabel = (viewType: ViewType) =>
  viewType === "total" ? "Juros financiados" : "Juros futuros";

const isPreFixedIndexer = (indexer?: string) => {
  if (!indexer) return true;

  const normalized = indexer
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  return ["pre-fixado", "pre fixado", "prefixado", "pre_fixado"].includes(normalized);
};

const calculateWeightedAnnualCET = (debts: Debt[]) => {
  const debtsWithCET = debts.filter(
    (debt) =>
      debt.cet_annual_rate !== null &&
      debt.cet_annual_rate !== undefined &&
      !Number.isNaN(debt.cet_annual_rate),
  );

  const totalWeight = debtsWithCET.reduce(
    (sum, debt) => sum + debt.financedAmount,
    0,
  );

  return totalWeight > 0
    ? debtsWithCET.reduce(
        (sum, debt) => sum + (debt.cet_annual_rate || 0) * debt.financedAmount,
        0,
      ) / totalWeight
    : 0;
};

const calculateApproximateInterest = (debt: Debt) => {
  const months = Math.ceil(
    (new Date(debt.dueDate).getTime() - new Date(debt.firstDueDate).getTime()) /
      (1000 * 60 * 60 * 24 * 30),
  );
  const monthlyRate =
    debt.interestType === "annual"
      ? Math.pow(1 + debt.interestRate / 100, 1 / 12) - 1
      : debt.interestRate / 100;

  return debt.financedAmount * monthlyRate * months * 0.5;
};

// Component for debt visualization focused on bank comparison
export const DebtChart = ({
  debts,
  selectedBank = "all",
  startDate,
  endDate,
  viewType: controlledViewType,
  density = "default",
  unstyled = false,
  hideTitle = false,
  onViewTypeChange,
}: DebtChartProps) => {
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [selectedIndexerType, setSelectedIndexerType] = useState<string>("all");
  const [internalViewType, setInternalViewType] = useState<ViewType>("total");
  const viewType = controlledViewType ?? internalViewType;
  const setViewType = onViewTypeChange ?? setInternalViewType;
  const chartHeight = density === "compact" ? 280 : 350;

  useEffect(() => {
    setSelectedBanks([]);
  }, [selectedBank]);

  const baseDebts = useMemo(() => {
    return debts.filter((debt) => {
      const bankMatch = selectedBank === "all" || debt.bank === selectedBank;
      const dateMatch = debtIntersectsDateRange(debt, startDate, endDate);
      return bankMatch && dateMatch;
    });
  }, [debts, selectedBank, startDate, endDate]);

  const {
    installmentsData,
    loading: installmentsLoading,
    error: installmentsError,
  } = useDebtInstallments(baseDebts);

  const availableBanks = useMemo(() => {
    return [...new Set(baseDebts.map((debt) => debt.bank))];
  }, [baseDebts]);

  const filteredDebts = useMemo(() => {
    return baseDebts.filter((debt) => {
      const bankMatch =
        selectedBank !== "all" ||
        selectedBanks.length === 0 ||
        selectedBanks.includes(debt.bank);
      const isPreFixado = isPreFixedIndexer(debt.indexer);

      const indexerTypeMatch =
        selectedIndexerType === "all" ||
        (selectedIndexerType === "pre" && isPreFixado) ||
        (selectedIndexerType === "pos" && !isPreFixado);

      return bankMatch && indexerTypeMatch;
    });
  }, [baseDebts, selectedBank, selectedBanks, selectedIndexerType]);

  const bankComparisonData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return availableBanks
      .map((bank) => {
        const bankDebts = filteredDebts.filter((debt) => debt.bank === bank);

        let principalAmount = 0;
        let financedInterest = 0;

        if (viewType === "total") {
          principalAmount = bankDebts.reduce(
            (sum, debt) => sum + debt.financedAmount,
            0,
          );

          financedInterest = bankDebts.reduce((sum, debt) => {
            const installments = installmentsData[debt.id];
            if (installments && installments.length > 0) {
              const totalInterest = installments.reduce(
                (interestSum, inst) => interestSum + inst.interest_amount,
                0,
              );
              return sum + totalInterest;
            }

            return sum + calculateApproximateInterest(debt);
          }, 0);
        } else {
          bankDebts.forEach((debt) => {
            const installments = installmentsData[debt.id];
            if (installments && installments.length > 0) {
              const futureInstallments = installments.filter((inst) => {
                const dueDate = new Date(inst.due_date);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate >= today;
              });

              if (futureInstallments.length > 0) {
                principalAmount += futureInstallments[0].remaining_balance;
                const futureInterest = futureInstallments.reduce(
                  (sum, inst) => sum + inst.interest_amount,
                  0,
                );
                financedInterest += futureInterest;
              }
            } else {
              principalAmount += debt.financedAmount;
              financedInterest += calculateApproximateInterest(debt);
            }
          });
        }

        return {
          name: bank,
          principalAmount,
          financedInterest,
          totalAmount: principalAmount + financedInterest,
          count: bankDebts.length,
        };
      })
      .filter((item) => item.count > 0);
  }, [availableBanks, filteredDebts, viewType, installmentsData]);

  // Calculate max Y value across both views for consistent axis scale.
  const maxYValue = useMemo(() => {
    const calculateMaxForView = (viewMode: ViewType) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return availableBanks.reduce((maxValue, bank) => {
        const bankDebts = filteredDebts.filter((debt) => debt.bank === bank);

        let principalAmount = 0;
        let financedInterest = 0;

        if (viewMode === "total") {
          principalAmount = bankDebts.reduce(
            (sum, debt) => sum + debt.financedAmount,
            0,
          );

          financedInterest = bankDebts.reduce((sum, debt) => {
            const installments = installmentsData[debt.id];
            if (installments && installments.length > 0) {
              const totalInterest = installments.reduce(
                (interestSum, inst) => interestSum + inst.interest_amount,
                0,
              );
              return sum + totalInterest;
            }

            return sum + calculateApproximateInterest(debt);
          }, 0);
        } else {
          bankDebts.forEach((debt) => {
            const installments = installmentsData[debt.id];
            if (installments && installments.length > 0) {
              const futureInstallments = installments.filter((inst) => {
                const dueDate = new Date(inst.due_date);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate >= today;
              });

              if (futureInstallments.length > 0) {
                principalAmount += futureInstallments[0].remaining_balance;
                const futureInterest = futureInstallments.reduce(
                  (sum, inst) => sum + inst.interest_amount,
                  0,
                );
                financedInterest += futureInterest;
              }
            } else {
              principalAmount += debt.financedAmount;
              financedInterest += calculateApproximateInterest(debt);
            }
          });
        }

        return Math.max(maxValue, principalAmount + financedInterest);
      }, 0);
    };

    const maxTotal = calculateMaxForView("total");
    const maxAtual = calculateMaxForView("atual");

    return Math.max(maxTotal, maxAtual);
  }, [availableBanks, filteredDebts, installmentsData]);

  const bankComparisonDataWithCET = useMemo<BankComparisonRow[]>(() => {
    return bankComparisonData
      .map((item) => {
        const bankDebts = filteredDebts.filter((d) => d.bank === item.name);
        const avgCET = calculateWeightedAnnualCET(bankDebts);

        return {
          ...item,
          avgCET,
        };
      })
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [bankComparisonData, filteredDebts]);

  const chartConfig = useMemo<ChartConfig>(
    () => ({
      principalAmount: {
        label: getPrimaryMetricLabel(viewType),
        color: "hsl(var(--chart-1))",
      },
      financedInterest: {
        label: getInterestMetricLabel(viewType),
        color: "hsl(var(--chart-3))",
      },
      avgCET: {
        label: "CET médio",
        color: "hsl(var(--chart-5))",
      },
    }),
    [viewType],
  );

  const comparisonTotals = useMemo(() => {
    const principalAmount = bankComparisonDataWithCET.reduce(
      (sum, bank) => sum + bank.principalAmount,
      0,
    );
    const financedInterest = bankComparisonDataWithCET.reduce(
      (sum, bank) => sum + bank.financedInterest,
      0,
    );
    const avgCET = calculateWeightedAnnualCET(filteredDebts);

    return {
      principalAmount,
      financedInterest,
      avgCET,
      bankCount: bankComparisonDataWithCET.length,
      contractCount: filteredDebts.length,
    };
  }, [bankComparisonDataWithCET, filteredDebts]);

  const chartLayout = useMemo(() => {
    const barCount = Math.max(bankComparisonDataWithCET.length, 1);
    const barSize =
      barCount <= 3 ? 92 : barCount <= 5 ? 72 : barCount <= 8 ? 54 : 38;

    return {
      barSize,
      categoryGap: barCount <= 3 ? "14%" : barCount <= 7 ? "10%" : "8%",
    };
  }, [bankComparisonDataWithCET.length]);

  const primaryMetricLabel = getPrimaryMetricLabel(viewType);
  const interestMetricLabel = getInterestMetricLabel(viewType);
  const hasActiveFilters =
    selectedBanks.length > 0 || selectedIndexerType !== "all";
  const isChartLoading =
    installmentsLoading && Object.keys(installmentsData).length === 0;

  const handleBankToggle = (bank: string) => {
    setSelectedBanks((prev) =>
      prev.includes(bank) ? prev.filter((b) => b !== bank) : [...prev, bank],
    );
  };

  const clearFilters = () => {
    setSelectedBanks([]);
    setSelectedIndexerType("all");
  };

  if (debts.length === 0) {
    const emptyHeader = !hideTitle && (
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Gráficos e Análises
          </h2>
          <p className="text-sm text-muted-foreground">
            Comparativo de bancos por saldo, juros e CET.
          </p>
        </div>
      </div>
    );
    const emptyContent = (
      <div
        className="flex flex-col items-center justify-center gap-2 text-center"
        style={{ height: chartHeight }}
      >
        <TrendingUp className="h-10 w-10 text-muted-foreground/50" />
        <h3 className="text-lg font-semibold text-muted-foreground">
          Nenhum contrato cadastrado
        </h3>
        <p className="text-sm text-muted-foreground">
          Cadastre suas dívidas para visualizar o comparativo por bancos.
        </p>
      </div>
    );

    if (unstyled) {
      return (
        <div className={cn("space-y-4", density === "compact" && "space-y-3")}>
          {emptyHeader}
          {emptyContent}
        </div>
      );
    }

    return (
      <Card className="bg-card border hover:shadow-lg transition-shadow duration-300">
        {emptyHeader && <CardHeader>{emptyHeader}</CardHeader>}
        <CardContent>{emptyContent}</CardContent>
      </Card>
    );
  }

  const header = (
    <div className="space-y-5">
      <div className={cn("flex flex-col gap-4 xl:flex-row xl:items-start", hideTitle ? "xl:justify-end" : "xl:justify-between")}>
        {!hideTitle && (
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Gráficos e Análises
              </h2>
              <p className="text-sm text-muted-foreground">
                Comparativo de bancos por saldo, juros financiados e CET.
              </p>
            </div>
          </div>
        )}

          <TooltipProvider delayDuration={150}>
            <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted/40 p-1">
              <UITooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewType === "atual" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewType("atual")}
                    className="h-8 gap-1.5 px-3 text-xs transition-transform active:scale-[0.96]"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Atual
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  <p className="mb-1 font-semibold">Visão atual</p>
                  <p className="text-muted-foreground">
                    Saldo devedor remanescente e juros das parcelas futuras.
                  </p>
                </TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewType === "total" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewType("total")}
                    className="h-8 gap-1.5 px-3 text-xs transition-transform active:scale-[0.96]"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Total
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  <p className="mb-1 font-semibold">Visão total do contrato</p>
                  <p className="text-muted-foreground">
                    Valor financiado original e juros de toda a vigência.
                  </p>
                </TooltipContent>
              </UITooltip>
            </div>
          </TooltipProvider>
      </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiBlock
            label={primaryMetricLabel}
            value={formatCurrency(comparisonTotals.principalAmount)}
            detail={`${comparisonTotals.contractCount} contrato${
              comparisonTotals.contractCount !== 1 ? "s" : ""
            }`}
          />
          <KpiBlock
            label={interestMetricLabel}
            value={formatCurrency(comparisonTotals.financedInterest)}
            detail={`${formatCurrency(
              comparisonTotals.principalAmount + comparisonTotals.financedInterest,
            )} no total`}
          />
          <KpiBlock
            label="CET médio"
            value={comparisonTotals.avgCET > 0 ? formatPercent(comparisonTotals.avgCET) : "Sem CET"}
            detail={`${comparisonTotals.bankCount} banco${
              comparisonTotals.bankCount !== 1 ? "s" : ""
            } no comparativo`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Filtrar por bancos
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 w-full justify-between bg-popover transition-transform hover:bg-accent hover:text-accent-foreground active:scale-[0.96]"
                >
                  {selectedBanks.length === 0
                    ? "Todos os bancos"
                    : `${selectedBanks.length} banco${
                        selectedBanks.length !== 1 ? "s" : ""
                      } selecionado${selectedBanks.length !== 1 ? "s" : ""}`}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 border border-border bg-popover shadow-lg">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground">
                      Selecionar bancos
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBanks([])}
                      className="h-7 px-2 text-xs transition-transform active:scale-[0.96]"
                    >
                      Limpar
                    </Button>
                  </div>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {availableBanks.map((bank) => (
                      <div
                        key={bank}
                        className="flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-accent"
                      >
                        <Checkbox
                          id={bank}
                          checked={selectedBanks.includes(bank)}
                          onCheckedChange={() => handleBankToggle(bank)}
                        />
                        <label
                          htmlFor={bank}
                          className="flex-1 cursor-pointer text-sm font-medium"
                        >
                          {bank}
                        </label>
                        <Badge variant="outline" className="text-xs tabular-nums">
                          {baseDebts.filter((d) => d.bank === bank).length}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pré/Pós fixado
            </label>
            <Select value={selectedIndexerType} onValueChange={setSelectedIndexerType}>
              <SelectTrigger className="h-10 bg-popover">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent className="border border-border bg-popover shadow-lg">
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="pre">Pré-fixado</SelectItem>
                <SelectItem value="pos">Pós-fixado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={clearFilters}
              className="h-10 w-full gap-2 transition-transform active:scale-[0.96] lg:w-auto"
            >
              <Filter className="h-4 w-4" />
              Limpar filtros
            </Button>
          </div>
        </div>

        <div className="flex min-h-7 flex-wrap items-center gap-2">
          {hasActiveFilters && (
            <>
              <span className="text-sm text-muted-foreground">Filtros ativos:</span>
              {selectedBanks.map((bank) => (
                <Badge key={bank} variant="secondary" className="gap-1">
                  {bank}
                  <button
                    type="button"
                    onClick={() => handleBankToggle(bank)}
                    className="rounded-sm text-muted-foreground hover:text-foreground"
                    aria-label={`Remover filtro ${bank}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedIndexerType !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  {selectedIndexerType === "pre" ? "Pré-fixado" : "Pós-fixado"}
                  <button
                    type="button"
                    onClick={() => setSelectedIndexerType("all")}
                    className="rounded-sm text-muted-foreground hover:text-foreground"
                    aria-label="Remover filtro de indexador"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </>
          )}
        </div>
    </div>
  );

  const content = (
    <div>
        {installmentsError && !isChartLoading && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Não foi possível carregar todas as parcelas. O comparativo pode usar
              estimativas para contratos sem cronograma calculado.
            </p>
          </div>
        )}

        {isChartLoading ? (
          <ChartSkeleton height={chartHeight} />
        ) : bankComparisonDataWithCET.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 text-center"
            style={{ height: chartHeight }}
          >
            <Landmark className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-muted-foreground">
              Nenhum banco encontrado
            </h3>
            <p className="text-sm text-muted-foreground">
              Ajuste os filtros para visualizar o comparativo.
            </p>
          </div>
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              className="w-full aspect-auto"
              style={{ height: chartHeight }}
            >
              <ComposedChart
                data={bankComparisonDataWithCET}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                barCategoryGap={chartLayout.categoryGap}
                barGap={0}
              >
                <defs>
                  <linearGradient id="debt-bank-principal" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.92}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.68}
                    />
                  </linearGradient>
                  <linearGradient id="debt-bank-interest" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--chart-3))"
                      stopOpacity={0.9}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--chart-3))"
                      stopOpacity={0.58}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickMargin={8}
                  height={bankComparisonDataWithCET.length > 5 ? 48 : 32}
                  interval={0}
                  tickFormatter={(value: string) =>
                    value.length > 14 ? `${value.slice(0, 12)}...` : value
                  }
                />
                <YAxis
                  yAxisId="amount"
                  domain={[0, maxYValue > 0 ? maxYValue * 1.1 : 1]}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                  fontSize={11}
                  tickFormatter={(value: number) => formatCurrencyShort(value)}
                />
                <YAxis
                  yAxisId="cet"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  fontSize={11}
                  stroke="hsl(var(--chart-5))"
                  tickFormatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <ChartTooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.22)" }}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(_, payload) =>
                        String(payload?.[0]?.payload?.name ?? "")
                      }
                      formatter={(value, name, item) => {
                        const tooltipItem = item as ComparisonTooltipItem;
                        const dataKey = String(tooltipItem.dataKey ?? name);
                        const row = tooltipItem.payload;

                        if (dataKey === "avgCET") {
                          return (
                            <TooltipRow
                              color="hsl(var(--chart-5))"
                              label="CET médio"
                              value={formatPercent(Number(value))}
                            />
                          );
                        }

                        const label =
                          dataKey === "principalAmount"
                            ? primaryMetricLabel
                            : interestMetricLabel;
                        const color =
                          dataKey === "principalAmount"
                            ? "hsl(var(--chart-1))"
                            : "hsl(var(--chart-3))";

                        return (
                          <TooltipRow
                            color={color}
                            label={label}
                            value={formatCurrency(Number(value))}
                            detail={
                              dataKey === "financedInterest" && row
                                ? `${formatCurrency(row.totalAmount)} total`
                                : undefined
                            }
                          />
                        );
                      }}
                    />
                  }
                />
                <Bar
                  yAxisId="amount"
                  dataKey="principalAmount"
                  stackId="bank"
                  name={primaryMetricLabel}
                  fill="url(#debt-bank-principal)"
                  radius={[0, 0, 6, 6]}
                  barSize={chartLayout.barSize}
                  animationDuration={500}
                />
                <Bar
                  yAxisId="amount"
                  dataKey="financedInterest"
                  stackId="bank"
                  name={interestMetricLabel}
                  fill="url(#debt-bank-interest)"
                  radius={[6, 6, 0, 0]}
                  barSize={chartLayout.barSize}
                  animationBegin={80}
                  animationDuration={500}
                />
                <Line
                  yAxisId="cet"
                  type="monotone"
                  dataKey="avgCET"
                  name="CET médio"
                  stroke="hsl(var(--chart-5))"
                  strokeWidth={2.5}
                  dot={{
                    r: 4,
                    fill: "hsl(var(--background))",
                    stroke: "hsl(var(--chart-5))",
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 5 }}
                  animationDuration={500}
                />
              </ComposedChart>
            </ChartContainer>

            <div className="mt-4 border-t border-border/50 pt-3">
              <p className="mb-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
                Comparativo por banco
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <LegendItem
                  color="hsl(var(--chart-1))"
                  label={primaryMetricLabel}
                />
                <LegendItem
                  color="hsl(var(--chart-3))"
                  label={interestMetricLabel}
                />
                <LegendItem color="hsl(var(--chart-5))" label="CET médio" line />
              </div>
            </div>
          </>
        )}
    </div>
  );

  if (unstyled) {
    return (
      <div className={cn("space-y-4", density === "compact" && "space-y-3")}>
        {header}
        {content}
      </div>
    );
  }

  return (
    <Card className="bg-card border hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="space-y-5">{header}</CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};

interface KpiBlockProps {
  label: string;
  value: string;
  detail: string;
}

const KpiBlock = ({ label, value, detail }: KpiBlockProps) => (
  <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
      {value}
    </p>
    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
      {detail}
    </p>
  </div>
);

const ChartSkeleton = ({ height }: { height: number }) => (
  <div
    className="rounded-lg border border-border/60 bg-muted/20 px-5 py-6"
    style={{ height }}
  >
    <div className="flex h-full items-end justify-center gap-4">
      {[66, 88, 54, 76, 62, 92].map((height, index) => (
        <div
          key={`${height}-${index}`}
          className="flex w-10 flex-col items-center justify-end gap-2 sm:w-14"
        >
          <div
            className="w-full animate-pulse rounded-t-md bg-muted"
            style={{ height: `${height}%` }}
          />
          <div className="h-2 w-10 animate-pulse rounded-full bg-muted sm:w-12" />
        </div>
      ))}
    </div>
  </div>
);

interface TooltipRowProps {
  color: string;
  label: string;
  value: string;
  detail?: string;
}

const TooltipRow = ({ color, label, value, detail }: TooltipRowProps) => (
  <div className="flex w-full min-w-[240px] items-center justify-between gap-4">
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
    <div className="text-right">
      <span className="font-mono font-medium tabular-nums text-foreground">
        {value}
      </span>
      {detail && (
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {detail}
        </p>
      )}
    </div>
  </div>
);

interface LegendItemProps {
  color: string;
  label: string;
  line?: boolean;
}

const LegendItem = ({ color, label, line = false }: LegendItemProps) => (
  <div className="flex items-center gap-2 text-xs">
    <span
      className={line ? "h-0.5 w-4 rounded-full" : "h-2.5 w-2.5 rounded-[2px]"}
      style={{ backgroundColor: color }}
    />
    <span className="font-medium text-foreground">{label}</span>
  </div>
);
