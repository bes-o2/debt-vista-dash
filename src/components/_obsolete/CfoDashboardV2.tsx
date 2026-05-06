import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarClock,
  Landmark,
  LineChart,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useBRLInput, BRL_INPUT_PROPS } from "@/hooks/useBRLInput";
import { useDebtGuarantees } from "@/hooks/useDebtGuarantees";
import { useDebtInstallments } from "@/hooks/useDebtInstallments";
import type { LegacyDebt } from "@/hooks/useDebts";
import { generateCfoAlerts } from "@/lib/cfoAlerts";
import { normalizeDebtForCalculation } from "@/lib/debtUtils";
import { cn } from "@/lib/utils";

interface CfoDashboardV2Props {
  debts: LegacyDebt[];
  companyId?: string;
  companyName?: string;
}

interface Installment {
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  remaining_balance: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const decimalCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);
const formatCurrencyDetailed = (value: number) => decimalCurrencyFormatter.format(value || 0);
const formatPercent = (value: number) => percentFormatter.format(value || 0);

const parseDate = (dateString: string) => {
  const parsed = new Date(dateString.includes("T") ? dateString : `${dateString}T00:00:00Z`);
  if (dateString.includes("T") || Number.isNaN(parsed.getTime())) return parsed;
  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_IN_MS);

const monthKey = (dateString: string) => dateString.slice(0, 7);

const formatMonth = (key?: string) => {
  if (!key) return "n/d";
  const date = parseDate(`${key}-01`);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "2-digit" });
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const normalizeIndexer = (indexer?: string) => {
  if (!indexer || indexer === "Pré-fixado") return "Pré-fixado";
  return indexer;
};

const getInstallmentsByDebt = (
  installmentsData: Record<string, Installment[]>,
  debtId: string,
) => [...(installmentsData[debtId] ?? [])].sort((a, b) => a.due_date.localeCompare(b.due_date));

const getOutstandingBalance = (debt: LegacyDebt, installments: Installment[], baseDate: Date) => {
  if (installments.length === 0) {
    return parseDate(debt.dueDate) >= baseDate ? debt.financedAmount : 0;
  }

  const paidOrDueInstallments = installments.filter((installment) => parseDate(installment.due_date) <= baseDate);
  if (paidOrDueInstallments.length === 0) return debt.financedAmount;

  const lastInstallment = paidOrDueInstallments[paidOrDueInstallments.length - 1];
  return Math.max(0, lastInstallment.remaining_balance);
};

const sumInstallmentsUntil = (
  installments: Installment[],
  baseDate: Date,
  endDate: Date,
  field: keyof Pick<Installment, "principal_amount" | "interest_amount" | "total_amount">,
) =>
  installments
    .filter((installment) => {
      const dueDate = parseDate(installment.due_date);
      return dueDate >= baseDate && dueDate <= endDate;
    })
    .reduce((sum, installment) => sum + Number(installment[field] || 0), 0);

const getMonthlyProjection = (
  debts: LegacyDebt[],
  installmentsData: Record<string, Installment[]>,
  baseDate: Date,
  months: number,
  field: keyof Pick<Installment, "principal_amount" | "interest_amount" | "total_amount">,
) => {
  const endDate = new Date(baseDate);
  endDate.setMonth(endDate.getMonth() + months);

  const projection = new Map<string, number>();

  debts.forEach((debt) => {
    getInstallmentsByDebt(installmentsData, debt.id)
      .filter((installment) => {
        const dueDate = parseDate(installment.due_date);
        return dueDate >= baseDate && dueDate <= endDate;
      })
      .forEach((installment) => {
        const key = monthKey(installment.due_date);
        projection.set(key, (projection.get(key) ?? 0) + Number(installment[field] || 0));
      });
  });

  return Array.from(projection.entries())
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

export function CfoDashboardV2({ debts, companyId, companyName }: CfoDashboardV2Props) {
  const [isCashInputOpen, setIsCashInputOpen] = useState(false);
  const {
    value: dailyCashDisplay,
    numericValue: dailyCashBalance,
    handleChange: handleCashChange,
    handleBlur: handleCashBlur,
    setValue: setDailyCashDisplay,
  } = useBRLInput("");

  const storageKey = companyId ? `cfo-v2:daily-cash:${companyId}` : "";
  const normalizedDebts = useMemo(() => debts.map(normalizeDebtForCalculation), [debts]);
  const { installmentsData, loading: installmentsLoading, error: installmentsError } = useDebtInstallments(normalizedDebts);
  const baseDate = useMemo(() => startOfToday(), []);

  useEffect(() => {
    if (!storageKey) {
      setDailyCashDisplay("");
      return;
    }

    setDailyCashDisplay(sessionStorage.getItem(storageKey) ?? "");
  }, [setDailyCashDisplay, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    sessionStorage.setItem(storageKey, dailyCashDisplay);
  }, [dailyCashDisplay, storageKey]);

  const metrics = useMemo(() => {
    const balanceByDebt = debts.map((debt) => {
      const installments = getInstallmentsByDebt(installmentsData, debt.id);
      return {
        debt,
        installments,
        outstandingBalance: getOutstandingBalance(debt, installments, baseDate),
      };
    });

    const outstandingBalance = balanceByDebt.reduce((sum, item) => sum + item.outstandingBalance, 0);
    const next30Pmt = balanceByDebt.reduce(
      (sum, item) => sum + sumInstallmentsUntil(item.installments, baseDate, addDays(baseDate, 30), "total_amount"),
      0,
    );
    const next90Pmt = balanceByDebt.reduce(
      (sum, item) => sum + sumInstallmentsUntil(item.installments, baseDate, addDays(baseDate, 90), "total_amount"),
      0,
    );
    const next180Pmt = balanceByDebt.reduce(
      (sum, item) => sum + sumInstallmentsUntil(item.installments, baseDate, addDays(baseDate, 180), "total_amount"),
      0,
    );
    const interestNext12Months = balanceByDebt.reduce(
      (sum, item) => sum + sumInstallmentsUntil(item.installments, baseDate, addDays(baseDate, 365), "interest_amount"),
      0,
    );
    const maturitiesNext12MonthsTotal = balanceByDebt.reduce(
      (sum, item) => sum + sumInstallmentsUntil(item.installments, baseDate, addDays(baseDate, 365), "principal_amount"),
      0,
    );

    const concentrationByBankMap = new Map<string, { amount: number; count: number }>();
    const concentrationByIndexerMap = new Map<string, { amount: number; count: number }>();

    balanceByDebt.forEach(({ debt, outstandingBalance: balance }) => {
      const bank = debt.bank || "Sem banco";
      const indexer = normalizeIndexer(debt.indexer);
      const bankEntry = concentrationByBankMap.get(bank) ?? { amount: 0, count: 0 };
      const indexerEntry = concentrationByIndexerMap.get(indexer) ?? { amount: 0, count: 0 };

      bankEntry.amount += balance;
      bankEntry.count += 1;
      indexerEntry.amount += balance;
      indexerEntry.count += 1;

      concentrationByBankMap.set(bank, bankEntry);
      concentrationByIndexerMap.set(indexer, indexerEntry);
    });

    const concentrationByBank = Array.from(concentrationByBankMap.entries())
      .map(([label, item]) => ({ label, amount: item.amount, count: item.count }))
      .sort((a, b) => b.amount - a.amount);
    const concentrationByIndexer = Array.from(concentrationByIndexerMap.entries())
      .map(([label, item]) => ({ label, amount: item.amount, count: item.count }))
      .sort((a, b) => b.amount - a.amount);

    const weightedMonthlyCost =
      outstandingBalance > 0
        ? balanceByDebt.reduce((sum, { debt, outstandingBalance: balance }) => {
            const monthlyRate =
              debt.cet_monthly_rate ??
              (debt.interestType === "annual"
                ? (Math.pow(1 + debt.interestRate / 100, 1 / 12) - 1) * 100
                : debt.interestRate);

            return sum + monthlyRate * balance;
          }, 0) / outstandingBalance
        : 0;

    const monthlyPmtProjection = getMonthlyProjection(debts, installmentsData, baseDate, 12, "total_amount");
    const maturitiesNext12Months = getMonthlyProjection(debts, installmentsData, baseDate, 12, "principal_amount");
    const peakPmtMonth = monthlyPmtProjection.reduce<{ month: string; amount: number } | null>(
      (peak, item) => (!peak || item.amount > peak.amount ? item : peak),
      null,
    );

    return {
      balanceByDebt,
      outstandingBalance,
      next30Pmt,
      next90Pmt,
      next180Pmt,
      interestNext12Months,
      maturitiesNext12MonthsTotal,
      concentrationByBank,
      concentrationByIndexer,
      weightedMonthlyCost,
      monthlyPmtProjection,
      maturitiesNext12Months,
      peakPmtMonth,
    };
  }, [baseDate, debts, installmentsData]);

  const guaranteeDebts = useMemo(
    () =>
      metrics.balanceByDebt.map(({ debt, outstandingBalance }) => ({
        id: debt.id,
        bank: debt.bank,
        financedAmount: debt.financedAmount,
        outstandingBalance,
      })),
    [metrics.balanceByDebt],
  );

  const {
    guaranteeMetrics,
    isLoading: guaranteesLoading,
    isLoadingMetrics: guaranteeMetricsLoading,
  } = useDebtGuarantees({
    companyId,
    debtIds: debts.map((debt) => debt.id),
    debts: guaranteeDebts,
  });

  const netDebt = metrics.outstandingBalance - dailyCashBalance;
  const mainBank = metrics.concentrationByBank[0];
  const mainIndexer = metrics.concentrationByIndexer[0];
  const mainBankShare = mainBank && metrics.outstandingBalance > 0 ? mainBank.amount / metrics.outstandingBalance : 0;
  const mainIndexerShare = mainIndexer && metrics.outstandingBalance > 0 ? mainIndexer.amount / metrics.outstandingBalance : 0;
  const guaranteeCoverage = guaranteeMetrics?.coverageRatio ?? 0;
  const guaranteeCoverageAmount = guaranteeMetrics?.totalGuaranteeValue ?? 0;
  const contractsWithoutGuarantee = guaranteeMetrics?.contractsWithoutGuaranteeCount ?? 0;

  const alertPack = useMemo(
    () =>
      generateCfoAlerts({
        concentrationByBank: metrics.concentrationByBank.map((item) => ({ label: item.label, amount: item.amount })),
        concentrationByIndexer: metrics.concentrationByIndexer.map((item) => ({ label: item.label, amount: item.amount })),
        maturitiesNext12Months: metrics.maturitiesNext12Months,
        monthlyPmtProjection: metrics.monthlyPmtProjection,
        guaranteeCoverage: {
          guaranteeValue: guaranteeCoverageAmount,
          coveredDebtAmount: metrics.outstandingBalance,
        },
        netDebt: {
          grossDebtAmount: metrics.outstandingBalance,
          cashAndEquivalents: dailyCashBalance,
          netDebtAmount: netDebt,
        },
      }),
    [
      dailyCashBalance,
      guaranteeCoverageAmount,
      metrics.concentrationByBank,
      metrics.concentrationByIndexer,
      metrics.maturitiesNext12Months,
      metrics.monthlyPmtProjection,
      metrics.outstandingBalance,
      netDebt,
    ],
  );

  const hasDebts = debts.length > 0;
  const hasDailyCash = dailyCashBalance > 0;
  const isLoading = installmentsLoading || guaranteesLoading || guaranteeMetricsLoading;

  if (!hasDebts) {
    return (
      <Card className="rounded-3xl border border-dashed border-border bg-card">
        <CardContent className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-5 rounded-2xl bg-primary/10 p-4">
            <LineChart className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">CFO V2 sem dados para analisar</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Cadastre dívidas primeiro para liberar a leitura executiva de saldo, concentração, vencimentos, garantias e alertas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--muted)/0.34))] shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.65fr] lg:p-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full px-3 py-1" variant="secondary">
                CFO V2
              </Badge>
              <span className="text-sm text-muted-foreground">
                Data-base: {baseDate.toLocaleDateString("pt-BR")}
                {companyName ? ` · ${companyName}` : ""}
              </span>
              {isLoading && (
                <Badge variant="outline" className="rounded-full">
                  Atualizando parcelas e garantias
                </Badge>
              )}
            </div>

            <div>
              <h2 className="max-w-3xl text-balance text-3xl font-bold tracking-tight text-foreground md:text-5xl">
                Leitura executiva da dívida, caixa informado e próximos compromissos.
              </h2>
              <p className="mt-3 max-w-2xl text-pretty text-sm text-muted-foreground md:text-base">
                Esta aba não substitui o dashboard atual: ela concentra uma visão CFO para bater números com o cliente e enxergar risco de caixa, concentração e cobertura.
              </p>
            </div>

            {installmentsError && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Não foi possível carregar todas as parcelas calculadas. Alguns indicadores podem usar dados parciais.
              </div>
            )}
          </div>

          <Card className="rounded-2xl border-border/70 bg-background/80 shadow-sm backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Wallet className="h-4 w-4 text-primary" />
                Saldo diário local
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {formatCurrencyDetailed(dailyCashBalance)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Temporário por empresa nesta sessão. Não é salvo no Supabase.
                </p>
              </div>

              {isCashInputOpen && (
                <div className="space-y-2">
                  <Label htmlFor="daily-cash-input">Informar saldo diário</Label>
                  <Input
                    id="daily-cash-input"
                    {...BRL_INPUT_PROPS}
                    value={dailyCashDisplay}
                    onChange={handleCashChange}
                    onBlur={handleCashBlur}
                    className="h-11 rounded-xl text-right tabular-nums"
                  />
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl active:scale-[0.96] transition-transform"
                onClick={() => setIsCashInputOpen((isOpen) => !isOpen)}
              >
                {isCashInputOpen ? "Fechar input" : hasDailyCash ? "Atualizar saldo diário" : "Informar saldo diário"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Saldo devedor atual"
          value={formatCurrency(metrics.outstandingBalance)}
          description={`${debts.length} contrato${debts.length !== 1 ? "s" : ""} na empresa ativa`}
          icon={Landmark}
          tone="primary"
        />
        <MetricCard
          title="Dívida líquida local"
          value={formatCurrency(netDebt)}
          description={`Saldo diário informado: ${formatCurrency(dailyCashBalance)}`}
          icon={Banknote}
          tone={netDebt > metrics.outstandingBalance * 0.85 ? "danger" : "success"}
        />
        <MetricCard
          title="PMT 90 dias"
          value={formatCurrency(metrics.next90Pmt)}
          description={`30 dias: ${formatCurrency(metrics.next30Pmt)} · 180 dias: ${formatCurrency(metrics.next180Pmt)}`}
          icon={CalendarClock}
          tone="warning"
        />
        <MetricCard
          title="Custo médio ponderado"
          value={`${metrics.weightedMonthlyCost.toFixed(2)}% a.m.`}
          description={`Juros em 12 meses: ${formatCurrency(metrics.interestNext12Months)}`}
          icon={LineChart}
          tone={metrics.weightedMonthlyCost > 1.5 ? "danger" : "success"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <AnalysisCard
          title="Concentração por banco"
          icon={Building2}
          headline={mainBank ? `${mainBank.label}: ${formatPercent(mainBankShare)}` : "Sem concentração"}
          description={
            mainBank
              ? `${formatCurrency(mainBank.amount)} em ${mainBank.count} contrato${mainBank.count !== 1 ? "s" : ""}.`
              : "Sem saldo consolidado por banco."
          }
          progress={mainBankShare * 100}
          alert={mainBankShare >= 0.55 ? "Concentração crítica" : mainBankShare >= 0.35 ? "Atenção" : "Pulverizado"}
          tone={mainBankShare >= 0.55 ? "danger" : mainBankShare >= 0.35 ? "warning" : "success"}
        />
        <AnalysisCard
          title="Exposição por indexador"
          icon={LineChart}
          headline={mainIndexer ? `${mainIndexer.label}: ${formatPercent(mainIndexerShare)}` : "Sem indexador"}
          description={
            mainIndexer
              ? `${formatCurrency(mainIndexer.amount)} expostos ao principal indexador do portfólio.`
              : "Sem saldo consolidado por indexador."
          }
          progress={mainIndexerShare * 100}
          alert={mainIndexerShare >= 0.8 ? "Muito concentrado" : mainIndexerShare >= 0.6 ? "Monitorar" : "Equilibrado"}
          tone={mainIndexerShare >= 0.8 ? "danger" : mainIndexerShare >= 0.6 ? "warning" : "success"}
        />
        <AnalysisCard
          title="Cobertura de garantias"
          icon={ShieldCheck}
          headline={`${formatPercent(guaranteeCoverage)} do saldo`}
          description={`${formatCurrency(guaranteeCoverageAmount)} em garantias. ${contractsWithoutGuarantee} contrato${contractsWithoutGuarantee !== 1 ? "s" : ""} sem garantia.`}
          progress={guaranteeCoverage * 100}
          alert={guaranteeCoverage < 0.8 ? "Insuficiente" : guaranteeCoverage < 1 ? "Atenção" : "Coberto"}
          tone={guaranteeCoverage < 0.8 ? "danger" : guaranteeCoverage < 1 ? "warning" : "success"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5 text-primary" />
              Vencimentos e picos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniStat label="Principal 12 meses" value={formatCurrency(metrics.maturitiesNext12MonthsTotal)} />
              <MiniStat
                label="Maior PMT mensal"
                value={metrics.peakPmtMonth ? formatCurrency(metrics.peakPmtMonth.amount) : formatCurrency(0)}
                helper={metrics.peakPmtMonth ? formatMonth(metrics.peakPmtMonth.month) : "Sem PMT projetado"}
              />
            </div>
            <div className="space-y-3">
              {metrics.monthlyPmtProjection.slice(0, 6).map((item) => {
                const maxAmount = metrics.peakPmtMonth?.amount || 1;
                return (
                  <div key={item.month} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="capitalize text-muted-foreground">{formatMonth(item.month)}</span>
                      <span className="font-semibold tabular-nums text-foreground">{formatCurrency(item.amount)}</span>
                    </div>
                    <Progress value={clampPercent((item.amount / maxAmount) * 100)} className="h-2" />
                  </div>
                );
              })}
              {metrics.monthlyPmtProjection.length === 0 && (
                <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Sem PMTs projetadas para os próximos 12 meses.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Alertas executivos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alertPack.alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "rounded-2xl border p-4",
                  alert.severity === "critical" && "border-destructive/30 bg-destructive/10",
                  alert.severity === "warning" && "border-amber-300/50 bg-amber-500/10",
                  alert.severity === "info" && "border-border bg-muted/30",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{alert.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{alert.summary}</p>
                  </div>
                  <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"}>
                    {alert.severity === "critical" ? "Crítico" : alert.severity === "warning" ? "Atenção" : "Info"}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{alert.recommendation}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              Task futura registrada: usar estes fatos consolidados como base para uma frase narrativa gerada por IA.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: typeof Landmark;
  tone: "primary" | "success" | "warning" | "danger";
}

function MetricCard({ title, value, description, icon: Icon, tone }: MetricCardProps) {
  return (
    <Card className="rounded-2xl border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">{title}</p>
          <div
            className={cn(
              "rounded-xl p-2",
              tone === "primary" && "bg-primary/10 text-primary",
              tone === "success" && "bg-emerald-500/10 text-emerald-600",
              tone === "warning" && "bg-amber-500/10 text-amber-600",
              tone === "danger" && "bg-destructive/10 text-destructive",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

interface AnalysisCardProps {
  title: string;
  icon: typeof Building2;
  headline: string;
  description: string;
  progress: number;
  alert: string;
  tone: "success" | "warning" | "danger";
}

function AnalysisCard({ title, icon: Icon, headline, description, progress, alert, tone }: AnalysisCardProps) {
  return (
    <Card className="rounded-2xl border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </span>
          <Badge
            variant={tone === "danger" ? "destructive" : "secondary"}
            className={cn(tone === "warning" && "bg-amber-500/15 text-amber-700 dark:text-amber-300")}
          >
            {alert}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-bold tabular-nums text-foreground">{headline}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Progress value={clampPercent(progress)} className="h-2" />
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{value}</p>
      {helper && <p className="mt-1 text-xs capitalize text-muted-foreground">{helper}</p>}
    </div>
  );
}
