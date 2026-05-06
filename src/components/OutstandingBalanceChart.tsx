import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { Building, Loader2, Minus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { cn, getBankColor } from "@/lib/utils";
import { useDebtInstallments } from "@/hooks/useDebtInstallments";
import {
  debtIntersectsDateRange,
  parseLocalDate,
  type NormalizedDebtForCalculation,
} from "@/lib/debtUtils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type {
  DashboardWidgetDensity,
  DashboardWidgetHorizon,
} from "@/components/dashboard/dashboardWidgetTypes";

interface OutstandingBalanceChartProps {
  debts: NormalizedDebtForCalculation[];
  startDate?: Date;
  endDate?: Date;
  horizon?: DashboardWidgetHorizon;
  density?: DashboardWidgetDensity;
  unstyled?: boolean;
  hideTitle?: boolean;
  onHorizonChange?: (horizon: DashboardWidgetHorizon) => void;
}

type Horizon = DashboardWidgetHorizon;

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatBRLShort = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return `R$ ${value.toFixed(0)}`;
};

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (d: Date) =>
  d
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "");

// Mesma fórmula usada em DashboardStats (calculateDebtOutstandingBalance) para
// garantir consistência entre os KPIs do header e o card de Saldo Devedor Atual.
const analyticalOutstandingBalance = (
  debt: NormalizedDebtForCalculation,
  today: Date,
) => {
  const contractDate = new Date(debt.releaseDate);
  const lastDueDate = new Date(debt.dueDate);
  const termInMonths = Math.round(
    (lastDueDate.getTime() - contractDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
  );
  const monthsElapsed = Math.max(
    0,
    Math.round((today.getTime() - contractDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
  );
  if (monthsElapsed <= 0 || monthsElapsed >= termInMonths) {
    return monthsElapsed <= 0 ? debt.financedAmount : 0;
  }
  const monthlyRate =
    debt.interestType === "annual"
      ? Math.pow(1 + debt.interestRate / 100, 1 / 12) - 1
      : debt.interestRate / 100;
  const principal = debt.financedAmount;
  if (debt.calculationTable === "SAC") {
    const amort = principal / termInMonths;
    return Math.max(0, principal - amort * monthsElapsed);
  }
  if (monthlyRate > 0) {
    const pmt =
      (principal * (monthlyRate * Math.pow(1 + monthlyRate, termInMonths))) /
      (Math.pow(1 + monthlyRate, termInMonths) - 1);
    const balance =
      principal * Math.pow(1 + monthlyRate, monthsElapsed) -
      pmt * ((Math.pow(1 + monthlyRate, monthsElapsed) - 1) / monthlyRate);
    return Math.max(0, balance);
  }
  return Math.max(0, principal - (principal / termInMonths) * monthsElapsed);
};

// Mesma fórmula usada em DashboardStats para "Parcela Corrente".
const analyticalCurrentPMT = (debt: NormalizedDebtForCalculation, baseDate = new Date()) => {
  const today = new Date(baseDate);
  today.setHours(0, 0, 0, 0);
  const release = new Date(debt.releaseDate);
  release.setHours(0, 0, 0, 0);
  const due = new Date(debt.dueDate);
  due.setHours(0, 0, 0, 0);
  const term = Math.round(
    (due.getTime() - release.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
  );
  if (term <= 0) return 0;
  if (today < release || today > due) return 0;

  const monthlyRate =
    debt.interestType === "annual"
      ? Math.pow(1 + debt.interestRate / 100, 1 / 12) - 1
      : debt.interestRate / 100;
  const principal = debt.financedAmount;
  if (debt.calculationTable === "PRICE") {
    if (monthlyRate > 0) {
      return (
        (principal * (monthlyRate * Math.pow(1 + monthlyRate, term))) /
        (Math.pow(1 + monthlyRate, term) - 1)
      );
    }
    return principal / term;
  }
  const elapsedMonths = Math.max(
    0,
    Math.round((today.getTime() - release.getTime()) / (30.44 * 24 * 3600 * 1000)),
  );
  if (elapsedMonths >= term) return 0;

  const amortization = principal / term;
  const currentBalance = Math.max(0, principal - amortization * elapsedMonths);
  return amortization + currentBalance * monthlyRate;
};


export const OutstandingBalanceChart = ({
  debts,
  startDate,
  endDate,
  horizon: controlledHorizon,
  density = "default",
  unstyled = false,
  hideTitle = false,
  onHorizonChange,
}: OutstandingBalanceChartProps) => {
  const [internalHorizon, setInternalHorizon] = useState<Horizon>("12m");
  const [showCashFreed, setShowCashFreed] = useState(false);
  const horizon = controlledHorizon ?? internalHorizon;
  const setHorizon = onHorizonChange ?? setInternalHorizon;
  const chartHeight = density === "compact" ? 280 : 350;
  const filteredDebts = useMemo(
    () => debts.filter((debt) => debtIntersectsDateRange(debt, startDate, endDate)),
    [debts, startDate, endDate],
  );
  const { installmentsData, loading } = useDebtInstallments(filteredDebts);

  // "Caixa liberado" só faz sentido em horizonte futuro; em "Total" o passado
  // teria PMT > hoje, o que inverteria a leitura. Desliga automaticamente.
  useEffect(() => {
    if (horizon === "total" && showCashFreed) setShowCashFreed(false);
  }, [horizon, showCashFreed]);

  const banks = useMemo(() => {
    const unique = [...new Set(filteredDebts.map((d) => d.bank))];
    return unique.map((name) => ({ name, color: getBankColor(name) }));
  }, [filteredDebts]);

  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    banks.forEach((b) => {
      cfg[b.name] = { label: b.name, color: b.color };
    });
    return cfg;
  }, [banks]);

  // Saldo + PMT por mês (todo o horizonte conhecido). Usado tanto pelo gráfico
  // quanto pelos KPIs do header (que precisam do mês atual e anterior).
  const monthlySeries = useMemo<Array<Record<string, number | string>>>(() => {
    if (filteredDebts.length === 0 || Object.keys(installmentsData).length === 0) return [];

    const releaseTimes = filteredDebts
      .map((d) => parseLocalDate(d.releaseDate)?.getTime())
      .filter((t): t is number => typeof t === "number");
    const dueTimes = filteredDebts
      .map((d) => parseLocalDate(d.dueDate)?.getTime())
      .filter((t): t is number => typeof t === "number");
    if (releaseTimes.length === 0 || dueTimes.length === 0) return [];

    const start = new Date(Math.min(...releaseTimes));
    const end = new Date(Math.max(...dueTimes));
    start.setDate(1);
    end.setDate(1);

    const months: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      months.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return months.map((date) => {
      const mKey = monthKey(date);
      const row: Record<string, number | string> = {
        month: mKey,
        displayMonth: monthLabel(date),
      };
      let totalPMT = 0;
      let totalSaldo = 0;

      banks.forEach((bank) => {
        const bankDebts = filteredDebts.filter((d) => d.bank === bank.name);
        const bankBalance = bankDebts.reduce((sum, debt) => {
          const rows = installmentsData[debt.id];
          if (!rows || rows.length === 0) return sum;

          const release = parseLocalDate(debt.releaseDate);
          if (!release) return sum;
          if (mKey < monthKey(release)) return sum;

          const monthInst = rows.find((r) => r.due_date.substring(0, 7) === mKey);
          if (monthInst) totalPMT += monthInst.total_amount;

          const next = [...rows]
            .sort((a, b) => a.due_date.localeCompare(b.due_date))
            .find((r) => r.due_date.substring(0, 7) >= mKey);

          return sum + (next ? Math.max(0, next.remaining_balance) : 0);
        }, 0);

        row[bank.name] = bankBalance;
        totalSaldo += bankBalance;
      });

      row.totalPMT = totalPMT;
      row.totalSaldo = totalSaldo;
      return row;
    });
  }, [filteredDebts, banks, installmentsData]);

  // Janela visível conforme horizonte selecionado. Quando o toggle de "caixa
  // liberado" está ligado, anexamos `cashFreed[m] = PMT[hoje] - PMT[m]` —
  // quanto a empresa terá liberado de PMT mensal vs. o mês corrente.
  const chartData = useMemo(() => {
    if (monthlySeries.length === 0) return [];

    const todayMonth = (() => {
      const t = new Date();
      t.setDate(1);
      return monthKey(t);
    })();
    const todayRow = monthlySeries.find((r) => r.month === todayMonth);
    const todayPMT = (todayRow?.totalPMT as number) ?? 0;

    const withCashFreed: Array<Record<string, number | string>> = monthlySeries.map(
      (row) => ({
        ...row,
        cashFreed: Math.max(0, todayPMT - ((row.totalPMT as number) ?? 0)),
      }),
    );

    if (horizon === "total") return withCashFreed;
    const startIdx = withCashFreed.findIndex(
      (r) => (r.month as string) >= todayMonth,
    );
    const anchor = startIdx === -1 ? 0 : startIdx;
    const span = horizon === "12m" ? 12 : 24;
    return withCashFreed.slice(anchor, anchor + span);
  }, [monthlySeries, horizon]);

  // KPIs do header usam fórmula analítica (mesma do DashboardStats), garantindo
  // que "Saldo Devedor Atual" e "Parcela Corrente" batam visualmente entre os cards.
  // Os deltas vs mês anterior são placeholder até a feature de tracking real
  // de parcelas pagas existir — ficam sempre em vermelho (destrutivo).
  const kpis = useMemo(() => {
    if (filteredDebts.length === 0) {
      return { saldo: 0, pmt: 0, deltaSaldo: 0, deltaPmt: 0 };
    }
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const saldo = filteredDebts.reduce(
      (s, d) => s + analyticalOutstandingBalance(d, today),
      0,
    );
    const saldoPrev = filteredDebts.reduce(
      (s, d) => s + analyticalOutstandingBalance(d, lastMonth),
      0,
    );
    // PMT analítico só conta para contratos ativos no mês - quando um contrato
    // encerra entre lastMonth e today, o delta captura a "saída" daquela parcela.
    const pmtAt = (when: Date) =>
      filteredDebts.reduce((s, d) => {
        const release = new Date(d.releaseDate);
        const due = new Date(d.dueDate);
        if (when < release || when > due) return s;
        return s + analyticalCurrentPMT(d, when);
      }, 0);
    const pmt = pmtAt(today);
    const pmtPrev = pmtAt(lastMonth);
    return {
      saldo,
      pmt,
      deltaSaldo: saldo - saldoPrev,
      deltaPmt: pmt - pmtPrev,
    };
  }, [filteredDebts]);

  // Linha vertical "hoje" — apenas em Total, onde temos passado e projeção.
  const todayMarker = useMemo(() => {
    if (horizon !== "total" || chartData.length === 0) return null;
    const today = new Date();
    today.setDate(1);
    const cur = monthKey(today);
    const found = chartData.find((r) => r.month === cur);
    return found?.displayMonth ?? null;
  }, [chartData, horizon]);

  // Compartilhamento do banco com maior saldo no mês corrente — usado na legenda.
  const concentration = useMemo(() => {
    if (banks.length === 0 || monthlySeries.length === 0) return [];
    const today = new Date();
    today.setDate(1);
    const idx = monthlySeries.findIndex((r) => r.month === monthKey(today));
    const safeIdx = idx === -1 ? monthlySeries.length - 1 : idx;
    const row = monthlySeries[safeIdx];
    const total = (row.totalSaldo as number) || 1;
    return banks
      .map((b) => ({
        name: b.name,
        color: b.color,
        share: ((row[b.name] as number) ?? 0) / total,
      }))
      .sort((a, b) => b.share - a.share);
  }, [banks, monthlySeries]);

  const tickInterval = useMemo(() => {
    if (chartData.length <= 12) return 0;
    if (chartData.length <= 24) return 1;
    return Math.max(1, Math.floor(chartData.length / 12));
  }, [chartData.length]);

  const horizonOptions: { value: Horizon; label: string }[] = [
    { value: "12m", label: "12m" },
    { value: "24m", label: "24m" },
    { value: "total", label: "Total" },
  ];

  const header = (
    <div className="space-y-4">
        <div className={cn("flex items-start gap-4", hideTitle ? "justify-end" : "justify-between")}>
          {!hideTitle && (
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Saldo Devedor por Banco
              </h3>
            </div>
          )}
          <div className="flex items-center gap-2">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={showCashFreed ? "default" : "outline"}
                    onClick={() => setShowCashFreed((v) => !v)}
                    disabled={horizon === "total"}
                    className="h-7 px-3 text-xs gap-1.5"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Caixa liberado
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                  <p className="font-medium mb-1">Caixa liberado mensal</p>
                  <p className="text-muted-foreground">
                    Mostra, em cada mês futuro, quanto a empresa pagará a menos
                    de PMT mensal vs. hoje — o "alívio" de caixa que cada
                    contrato traz conforme seus pagamentos avançam.
                  </p>
                  {horizon === "total" && (
                    <p className="mt-1.5 text-amber-500">
                      Disponível apenas nos horizontes 12m e 24m.
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted/40 p-1">
              {horizonOptions.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={horizon === opt.value ? "default" : "ghost"}
                  onClick={() => setHorizon(opt.value)}
                  className="h-7 px-3 text-xs transition-transform active:scale-[0.96]"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiBlock
            label="PMT este mês"
            value={formatBRL(kpis.pmt)}
            delta={kpis.deltaPmt}
          />
          <KpiBlock
            label="Saldo total atual"
            value={formatBRL(kpis.saldo)}
            delta={kpis.deltaSaldo}
          />
        </div>
    </div>
  );

  const content = (
    <div>
        {loading ? (
          <div
            className="flex items-center justify-center"
            style={{ height: chartHeight }}
          >
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Carregando dados de parcelas...
            </span>
          </div>
        ) : chartData.length === 0 ? (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height: chartHeight }}
          >
            Sem dados para o horizonte selecionado.
          </div>
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              className="w-full aspect-auto"
              style={{ height: chartHeight }}
            >
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: showCashFreed ? 8 : 8, left: 0, bottom: 0 }}
              >
                <defs>
                  {banks.map((bank) => (
                    <linearGradient
                      key={bank.name}
                      id={`fill-${bank.name.replace(/\s+/g, "-")}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={bank.color} stopOpacity={0.85} />
                      <stop offset="100%" stopColor={bank.color} stopOpacity={0.15} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="displayMonth"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  interval={tickInterval}
                  tickMargin={8}
                />
                <YAxis
                  yAxisId="balance"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={56}
                  tickFormatter={(v: number) => formatBRLShort(v)}
                />
                {showCashFreed && (
                  <YAxis
                    yAxisId="cash"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={56}
                    stroke="hsl(152 65% 45%)"
                    tickFormatter={(v: number) => formatBRLShort(v)}
                  />
                )}
                {todayMarker && (
                  <ReferenceLine
                    yAxisId="balance"
                    x={todayMarker}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    label={{
                      value: "hoje",
                      position: "top",
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                )}
                <ChartTooltip
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(label) => `Mês: ${label}`}
                      formatter={(value, name, item) => {
                        const colorVal =
                          (item as { color?: string })?.color ??
                          getBankColor(String(name));
                        return (
                          <div className="flex w-full items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-[2px] shrink-0"
                                style={{ backgroundColor: colorVal }}
                              />
                              <span className="text-muted-foreground">{name}</span>
                            </div>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {formatBRL(Number(value))}
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                {banks.map((bank, i) => (
                  <Area
                    key={bank.name}
                    yAxisId="balance"
                    type="monotone"
                    dataKey={bank.name}
                    stackId="saldo"
                    stroke={bank.color}
                    strokeWidth={1.5}
                    fill={`url(#fill-${bank.name.replace(/\s+/g, "-")})`}
                    animationBegin={i * 60}
                    animationDuration={500}
                  />
                ))}
                {showCashFreed && (
                  <Line
                    yAxisId="cash"
                    type="monotone"
                    dataKey="cashFreed"
                    name="Caixa liberado"
                    stroke="hsl(152 65% 45%)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                    animationDuration={500}
                  />
                )}
              </ComposedChart>
            </ChartContainer>

            <div className="mt-4 border-t border-border/50 pt-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground text-center mb-2">
                Composição atual da dívida por credor
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {concentration.map((b) => (
                  <div key={b.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-[2px]"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="text-foreground font-medium">{b.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {(b.share * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
                {showCashFreed && (
                  <div className="flex items-center gap-2 text-xs ml-2 pl-3 border-l border-border/50">
                    <span
                      className="h-0.5 w-4 rounded-full"
                      style={{ backgroundColor: "hsl(152 65% 45%)" }}
                    />
                    <span className="text-foreground font-medium">Caixa liberado</span>
                  </div>
                )}
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

interface KpiBlockProps {
  label: string;
  value: string;
  delta: number;
}

const KpiBlock = ({ label, value, delta }: KpiBlockProps) => {
  const tone = delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral";
  const DeltaIcon = tone === "positive" ? TrendingUp : tone === "negative" ? TrendingDown : Minus;
  const toneClass =
    tone === "positive"
      ? "text-emerald-500"
      : tone === "negative"
        ? "text-destructive"
        : "text-muted-foreground";
  const sign = delta > 0 ? "+" : delta < 0 ? "" : "";

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
        {value}
      </p>
      <p className={`mt-1 flex items-center gap-1 text-xs ${toneClass}`}>
        <DeltaIcon className="h-3 w-3" />
        <span className="tabular-nums">
          {sign}
          {formatBRLShort(delta)} vs mês anterior
        </span>
      </p>
    </div>
  );
};
