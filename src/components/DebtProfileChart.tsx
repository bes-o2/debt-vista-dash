import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  AlertCircle,
  CalendarDays,
  Loader2,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebtInstallments } from "@/hooks/useDebtInstallments";
import { getAnalyticalOutstanding } from "@/lib/balanceCalculator";
import { debtIntersectsDateRange, parseLocalDate } from "@/lib/debtUtils";
import { getEffectiveMonthlyRate } from "@/lib/rateUtils";
import { cn, getBankColor } from "@/lib/utils";
import type { DashboardWidgetDensity } from "@/components/dashboard/dashboardWidgetTypes";

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
  spreadRate?: number;
  spread_rate?: number;
  bank: string;
  iofAmount?: number;
  tacAmount?: number;
  contractNumber?: string;
}

interface DebtProfileChartProps {
  debts: Debt[];
  startDate?: Date;
  endDate?: Date;
  density?: DashboardWidgetDensity;
  unstyled?: boolean;
  hideTitle?: boolean;
}

interface ChartRow {
  bank: string;
  bankColor: string;
  shortTerm: number;
  longTerm: number;
  shortTermAmount: number;
  longTermAmount: number;
  totalAmount: number;
}

type ProfileSegment = "shortTerm" | "longTerm";

type LabelRendererProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  index?: number;
};

type TooltipItem = {
  dataKey?: string;
  payload?: ChartRow;
};

type BankTickProps = {
  x?: number;
  y?: number;
  payload?: {
    value?: string;
  };
};

type InstallmentRow = {
  due_date: string;
  principal_amount: number;
  remaining_balance: number;
};

const PROFILE_SERIES: Record<
  ProfileSegment,
  { label: string; detail: string; color: string; gradientId: string }
> = {
  shortTerm: {
    label: "Curto prazo",
    detail: "Até 12 meses",
    color: "hsl(var(--chart-3))",
    gradientId: "debt-profile-short-term",
  },
  longTerm: {
    label: "Longo prazo",
    detail: "> 12 meses",
    color: "hsl(var(--primary))",
    gradientId: "debt-profile-long-term",
  },
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

const toNumber = (value: number | string | undefined) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const isProfileSegment = (value: string): value is ProfileSegment =>
  value === "shortTerm" || value === "longTerm";

const formatMonthYear = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

const parseMonthYear = (value: string) => {
  const match = /^(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12 || year < 1900) return null;

  return new Date(year, month - 1, 1);
};

const maskMonthYear = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const getCurrentOutstandingBalance = (
  debt: Debt,
  installments: InstallmentRow[],
  baseDate: Date,
) => {
  if (installments.length === 0) {
    return getAnalyticalOutstanding(debt, baseDate);
  }

  const sortedInstallments = [...installments].sort((a, b) =>
    a.due_date.localeCompare(b.due_date),
  );
  const installmentsBeforeBase = sortedInstallments.filter((installment) => {
    const dueDate = parseLocalDate(installment.due_date);
    return dueDate ? dueDate <= baseDate : false;
  });

  if (installmentsBeforeBase.length === 0) {
    const releaseDate = parseLocalDate(debt.releaseDate);
    return releaseDate && releaseDate > baseDate ? 0 : debt.financedAmount;
  }

  const lastInstallment = installmentsBeforeBase[installmentsBeforeBase.length - 1];
  const remainingBalance = Number(lastInstallment.remaining_balance);
  return Number.isFinite(remainingBalance) ? Math.max(0, remainingBalance) : 0;
};

const estimateFutureAmortization = (
  debt: Debt,
  baseDate: Date,
  twelveMonthsFromBase: Date,
) => {
  const firstDueDate = parseLocalDate(debt.firstDueDate);
  const dueDate = parseLocalDate(debt.dueDate);

  if (!firstDueDate || !dueDate || dueDate < baseDate || debt.financedAmount <= 0) {
    return { shortTerm: 0, longTerm: 0 };
  }

  firstDueDate.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const dueDates: Date[] = [];
  let cursor = new Date(firstDueDate);

  for (let guard = 0; cursor <= dueDate && guard < 600; guard += 1) {
    dueDates.push(new Date(cursor));
    cursor = addMonths(cursor, 1);
  }

  if (dueDates.length === 0) {
    return { shortTerm: 0, longTerm: 0 };
  }

  const monthlyRate = getEffectiveMonthlyRate(
    debt.interestRate,
    debt.spreadRate ?? debt.spread_rate ?? 0,
    debt.interestType,
  );
  const principal = debt.financedAmount;
  const termInMonths = dueDates.length;
  let remainingBalance = principal;

  if (debt.calculationTable === "PRICE" && monthlyRate > 0) {
    const pmt =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, termInMonths)) /
      (Math.pow(1 + monthlyRate, termInMonths) - 1);

    return dueDates.reduce(
      (acc, currentDueDate) => {
        const interestAmount = remainingBalance * monthlyRate;
        const principalAmount = Math.min(
          remainingBalance,
          Math.max(0, pmt - interestAmount),
        );

        remainingBalance = Math.max(0, remainingBalance - principalAmount);

        if (currentDueDate < baseDate) return acc;

        if (currentDueDate < twelveMonthsFromBase) {
          acc.shortTerm += principalAmount;
        } else {
          acc.longTerm += principalAmount;
        }

        return acc;
      },
      { shortTerm: 0, longTerm: 0 },
    );
  }

  const monthlyAmortization = principal / termInMonths;

  return dueDates.reduce(
    (acc, currentDueDate) => {
      if (currentDueDate < baseDate) return acc;

      if (currentDueDate < twelveMonthsFromBase) {
        acc.shortTerm += monthlyAmortization;
      } else {
        acc.longTerm += monthlyAmortization;
      }

      return acc;
    },
    { shortTerm: 0, longTerm: 0 },
  );
};

export const DebtProfileChart = ({
  debts,
  startDate,
  endDate,
  density = "default",
  unstyled = false,
  hideTitle = false,
}: DebtProfileChartProps) => {
  const [dateType, setDateType] = useState<"today" | "custom">("today");
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [customMonthInput, setCustomMonthInput] = useState(() =>
    formatMonthYear(new Date()),
  );
  const chartFrameRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = density === "compact" ? 280 : 350;
  const filteredDebts = useMemo(
    () => debts.filter((debt) => debtIntersectsDateRange(debt, startDate, endDate)),
    [debts, startDate, endDate],
  );
  const { installmentsData, loading, error } = useDebtInstallments(filteredDebts);

  useEffect(() => {
    const chartFrame = chartFrameRef.current;
    if (!chartFrame) return;

    const updateChartWidth = () => setChartWidth(chartFrame.clientWidth);
    updateChartWidth();

    const resizeObserver = new ResizeObserver(updateChartWidth);
    resizeObserver.observe(chartFrame);

    return () => resizeObserver.disconnect();
  }, []);

  const chartData = useMemo<ChartRow[]>(() => {
    const baseDate = dateType === "today" ? new Date() : new Date(customDate);
    baseDate.setHours(0, 0, 0, 0);

    const twelveMonthsFromBase = new Date(baseDate);
    twelveMonthsFromBase.setMonth(twelveMonthsFromBase.getMonth() + 12);

    const bankGroups = filteredDebts.reduce<Record<string, Debt[]>>((acc, debt) => {
      const key = debt.bank || "Sem Nome";
      if (!acc[key]) acc[key] = [];
      acc[key].push(debt);
      return acc;
    }, {});

    return Object.entries(bankGroups)
      .map(([bankName, bankDebts]) => {
        let shortTermAmortization = 0;
        let longTermAmortization = 0;

        bankDebts.forEach((debt) => {
          const debtInstallments = installmentsData[debt.id] || [];
          let debtAmortization = 0;
          const currentOutstandingBalance = getCurrentOutstandingBalance(
            debt,
            debtInstallments,
            baseDate,
          );

          debtInstallments.forEach((installment) => {
            const dueDate = parseLocalDate(installment.due_date);
            const principalAmount = Number(installment.principal_amount);

            if (!dueDate || !Number.isFinite(principalAmount) || principalAmount <= 0) {
              return;
            }

            if (dueDate < baseDate) return;

            if (dueDate < twelveMonthsFromBase) {
              shortTermAmortization += principalAmount;
              debtAmortization += principalAmount;
              return;
            }

            longTermAmortization += principalAmount;
            debtAmortization += principalAmount;
          });

          if (debtAmortization === 0) {
            const fallback = estimateFutureAmortization(
              debt,
              baseDate,
              twelveMonthsFromBase,
            );

            shortTermAmortization += fallback.shortTerm;
            longTermAmortization += fallback.longTerm;
            debtAmortization += fallback.shortTerm + fallback.longTerm;
          }

          const missingAmortization = Math.max(0, currentOutstandingBalance - debtAmortization);

          if (missingAmortization > 1) {
            const dueDate = parseLocalDate(debt.dueDate);

            if (!dueDate || dueDate < twelveMonthsFromBase) {
              shortTermAmortization += missingAmortization;
            } else {
              longTermAmortization += missingAmortization;
            }
          }
        });

        const totalAmortization = shortTermAmortization + longTermAmortization;

        return {
          bank: bankName,
          bankColor: getBankColor(bankName),
          shortTerm: totalAmortization > 0 ? (shortTermAmortization / totalAmortization) * 100 : 0,
          longTerm: totalAmortization > 0 ? (longTermAmortization / totalAmortization) * 100 : 0,
          shortTermAmount: shortTermAmortization,
          longTermAmount: longTermAmortization,
          totalAmount: totalAmortization,
        };
      })
      .filter((item) => item.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [customDate, dateType, filteredDebts, installmentsData]);

  const chartConfig = useMemo<ChartConfig>(
    () => ({
      shortTerm: {
        label: PROFILE_SERIES.shortTerm.label,
        color: PROFILE_SERIES.shortTerm.color,
      },
      longTerm: {
        label: PROFILE_SERIES.longTerm.label,
        color: PROFILE_SERIES.longTerm.color,
      },
    }),
    [],
  );

  const profileTotals = useMemo(() => {
    const shortTermAmount = chartData.reduce((sum, row) => sum + row.shortTermAmount, 0);
    const longTermAmount = chartData.reduce((sum, row) => sum + row.longTermAmount, 0);
    const totalAmount = shortTermAmount + longTermAmount;

    return {
      shortTermAmount,
      longTermAmount,
      shortTermShare: totalAmount > 0 ? shortTermAmount / totalAmount : 0,
      longTermShare: totalAmount > 0 ? longTermAmount / totalAmount : 0,
    };
  }, [chartData]);

  const bankColorByName = useMemo(
    () =>
      chartData.reduce<Record<string, string>>((acc, row) => {
        acc[row.bank] = row.bankColor;
        return acc;
      }, {}),
    [chartData],
  );

  const isProfileLoading =
    loading || (!error && filteredDebts.length > 0 && Object.keys(installmentsData).length < filteredDebts.length);

  const chartLayout = useMemo(() => {
    const barCount = Math.max(chartData.length, 1);
    const measuredWidth = chartWidth || 960;
    const compact = measuredWidth < 640;
    const availableWidth = Math.max(measuredWidth - 78, 240);
    const rawBarSize = Math.floor((availableWidth / barCount) * 0.88);
    const minBarSize = compact ? 68 : barCount <= 4 ? 168 : barCount <= 6 ? 128 : 84;
    const maxBarSize = compact ? 112 : 240;

    return {
      barSize: Math.max(minBarSize, Math.min(maxBarSize, rawBarSize)),
      categoryGap: compact ? "8%" : barCount <= 4 ? "3%" : barCount <= 7 ? "5%" : "8%",
    };
  }, [chartData.length, chartWidth]);

  const renderLabel = (props: LabelRendererProps, dataKey: ProfileSegment) => {
    const { index } = props;
    const x = toNumber(props.x);
    const y = toNumber(props.y);
    const width = toNumber(props.width);
    const height = toNumber(props.height);

    if (typeof index !== "number" || width < 28 || height < 18) return null;

    const data = chartData[index];
    if (!data) return null;

    const pct = data[dataKey];
    const amount = dataKey === "shortTerm" ? data.shortTermAmount : data.longTermAmount;
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const textColor =
      dataKey === "longTerm" ? "hsl(var(--primary-foreground))" : "hsl(0 0% 12%)";

    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        fill={textColor}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={700}
        className="tabular-nums"
      >
        <tspan x={x + width / 2} dy={height > 52 ? "-0.55em" : "0"}>
          {pct.toFixed(0)}%
        </tspan>
        {height > 52 && (
          <tspan x={x + width / 2} dy="1.35em">
            {formatCurrencyShort(amount)}
          </tspan>
        )}
      </text>
    );
  };

  const handleMonthInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = maskMonthYear(event.target.value);
    setCustomMonthInput(nextValue);

    const parsedDate = parseMonthYear(nextValue);
    if (parsedDate) setCustomDate(parsedDate);
  };

  const handleMonthInputBlur = () => {
    const parsedDate = parseMonthYear(customMonthInput);
    if (parsedDate) {
      setCustomMonthInput(formatMonthYear(parsedDate));
      return;
    }

    setCustomMonthInput(formatMonthYear(customDate));
  };

  const renderBankTick = ({ x, y, payload }: BankTickProps) => {
    if (x == null || y == null) return null;

    const bankName = String(payload?.value ?? "");
    const color = bankColorByName[bankName] ?? getBankColor(bankName);

    return (
      <g transform={`translate(${x},${y})`}>
        <circle cx={0} cy={9} r={3} fill={color} />
        <text
          x={0}
          y={26}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="hsl(var(--muted-foreground))"
        >
          {bankName}
        </text>
      </g>
    );
  };

  const header = (
    <div className="space-y-4">
      <div className={cn("flex flex-col gap-4 lg:flex-row lg:items-start", hideTitle ? "lg:justify-end" : "lg:justify-between")}>
        {!hideTitle && (
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Perfil da Dívida
            </h3>
          </div>
        )}

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <Label
              htmlFor="debt-profile-base-month"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Data base
            </Label>
            <div className="flex h-10 w-full items-center gap-2 sm:w-auto">
              <div className="flex h-10 items-center gap-1 rounded-lg border border-border/70 bg-muted/40 p-1">
                <Button
                  size="sm"
                  variant={dateType === "today" ? "default" : "ghost"}
                  onClick={() => setDateType("today")}
                  className="h-8 px-3 text-xs transition-transform active:scale-[0.96]"
                >
                  Hoje
                </Button>
                <Button
                  size="sm"
                  variant={dateType === "custom" ? "default" : "ghost"}
                  onClick={() => setDateType("custom")}
                  className="h-8 px-3 text-xs gap-1.5 transition-transform active:scale-[0.96]"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Mês
                </Button>
              </div>

              <Input
                id="debt-profile-base-month"
                inputMode="numeric"
                maxLength={7}
                placeholder="MM/YYYY"
                value={customMonthInput}
                onChange={handleMonthInputChange}
                onBlur={handleMonthInputBlur}
                disabled={dateType === "today"}
                className="h-10 w-[118px] text-center font-mono text-sm tabular-nums"
              />
            </div>
          </div>
      </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ProfileKpiBlock
            label={PROFILE_SERIES.shortTerm.detail}
            value={isProfileLoading ? "..." : formatCurrency(profileTotals.shortTermAmount)}
            share={isProfileLoading ? "Calculando" : `${(profileTotals.shortTermShare * 100).toFixed(0)}% do total`}
            color={PROFILE_SERIES.shortTerm.color}
          />
          <ProfileKpiBlock
            label={PROFILE_SERIES.longTerm.detail}
            value={isProfileLoading ? "..." : formatCurrency(profileTotals.longTermAmount)}
            share={isProfileLoading ? "Calculando" : `${(profileTotals.longTermShare * 100).toFixed(0)}% do total`}
            color={PROFILE_SERIES.longTerm.color}
          />
        </div>
    </div>
  );

  const content = (
    <div>
      {isProfileLoading ? (
          <div
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
            style={{ height: chartHeight }}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Carregando parcelas...</span>
          </div>
        ) : error ? (
          <div
            className="flex flex-col items-center justify-center gap-2 text-center"
            style={{ height: chartHeight }}
          >
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm font-medium text-foreground">Não foi possível montar o perfil da dívida.</p>
            <p className="max-w-md text-sm text-muted-foreground">{error}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div
            className="flex items-center justify-center text-center text-sm text-muted-foreground"
            style={{ height: chartHeight }}
          >
            Nenhuma amortização futura encontrada para o período selecionado.
          </div>
        ) : (
          <>
            <div ref={chartFrameRef} className="w-full">
              <ChartContainer
                config={chartConfig}
                className="w-full aspect-auto"
                style={{ height: chartHeight }}
              >
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  barCategoryGap={chartLayout.categoryGap}
                  barGap={0}
                >
                  <defs>
                    <linearGradient
                      id={PROFILE_SERIES.shortTerm.gradientId}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={PROFILE_SERIES.shortTerm.color}
                        stopOpacity={0.92}
                      />
                      <stop
                        offset="100%"
                        stopColor={PROFILE_SERIES.shortTerm.color}
                        stopOpacity={0.62}
                      />
                    </linearGradient>
                    <linearGradient
                      id={PROFILE_SERIES.longTerm.gradientId}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={PROFILE_SERIES.longTerm.color}
                        stopOpacity={0.58}
                      />
                      <stop
                        offset="100%"
                        stopColor={PROFILE_SERIES.longTerm.color}
                        stopOpacity={0.92}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="bank"
                    interval={0}
                    height={48}
                    tick={renderBankTick}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tickMargin={8}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={42}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <ChartTooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.22)" }}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) =>
                          String(payload?.[0]?.payload?.bank ?? "")
                        }
                        formatter={(value, name, item) => {
                          const tooltipItem = item as TooltipItem;
                          const rawKey = String(tooltipItem.dataKey ?? name);
                          const dataKey = isProfileSegment(rawKey) ? rawKey : "shortTerm";
                          const amount =
                            dataKey === "shortTerm"
                              ? tooltipItem.payload?.shortTermAmount
                              : tooltipItem.payload?.longTermAmount;
                          const series = PROFILE_SERIES[dataKey];

                          return (
                            <div className="flex w-full min-w-[220px] items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                  style={{ backgroundColor: series.color }}
                                />
                                <span className="text-muted-foreground">
                                  {series.label}
                                </span>
                              </div>
                              <span className="font-mono font-medium tabular-nums text-foreground">
                                {Number(value).toFixed(0)}% - {formatCurrency(Number(amount ?? 0))}
                              </span>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="shortTerm"
                    stackId="debt"
                    name={PROFILE_SERIES.shortTerm.label}
                    fill={`url(#${PROFILE_SERIES.shortTerm.gradientId})`}
                    radius={[0, 0, 6, 6]}
                    barSize={chartLayout.barSize}
                    animationDuration={500}
                  >
                    {chartData.map((row) => (
                      <Cell
                        key={`short-${row.bank}`}
                        stroke={row.bankColor}
                        strokeOpacity={0.42}
                        strokeWidth={1}
                      />
                    ))}
                    <LabelList content={(props) => renderLabel(props, "shortTerm")} />
                  </Bar>
                  <Bar
                    dataKey="longTerm"
                    stackId="debt"
                    name={PROFILE_SERIES.longTerm.label}
                    fill={`url(#${PROFILE_SERIES.longTerm.gradientId})`}
                    radius={[6, 6, 0, 0]}
                    barSize={chartLayout.barSize}
                    animationBegin={80}
                    animationDuration={500}
                  >
                    {chartData.map((row) => (
                      <Cell
                        key={`long-${row.bank}`}
                        stroke={row.bankColor}
                        strokeOpacity={0.42}
                        strokeWidth={1}
                      />
                    ))}
                    <LabelList content={(props) => renderLabel(props, "longTerm")} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>

            <div className="mt-4 border-t border-border/50 pt-3">
              <p className="mb-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
                Composição por prazo de amortização
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {(["shortTerm", "longTerm"] as ProfileSegment[]).map((key) => {
                  const amount =
                    key === "shortTerm"
                      ? profileTotals.shortTermAmount
                      : profileTotals.longTermAmount;
                  const share =
                    key === "shortTerm"
                      ? profileTotals.shortTermShare
                      : profileTotals.longTermShare;
                  const series = PROFILE_SERIES[key];

                  return (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2.5 w-2.5 rounded-[2px]"
                        style={{ backgroundColor: series.color }}
                      />
                      <span className="font-medium text-foreground">{series.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {(share * 100).toFixed(0)}%
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatCurrencyShort(amount)}
                      </span>
                    </div>
                  );
                })}
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
      <CardHeader className="space-y-4">{header}</CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};

interface ProfileKpiBlockProps {
  label: string;
  value: string;
  share: string;
  color: string;
}

const ProfileKpiBlock = ({ label, value, share, color }: ProfileKpiBlockProps) => (
  <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
      {value}
    </p>
    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
      {share}
    </p>
  </div>
);
