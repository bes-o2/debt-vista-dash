import { useCallback, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompany } from "@/hooks/useCompany";
import { useSensitivityAnalysis } from "@/hooks/useSensitivityAnalysis";
import type { SensitivityMatrix } from "@/lib/sensitivityMatrix";
import {
  normalizeDebtForCalculation,
  type NormalizedDebtForCalculation,
} from "@/lib/debtUtils";
import type { LegacyDebt } from "@/hooks/useDebts";
import { SensitivityMatrixTable } from "@/components/SensitivityMatrixTable";

const SUPPORTED_INDEXERS = ["CDI", "SELIC", "IPCA"] as const;
type SupportedIndexer = (typeof SUPPORTED_INDEXERS)[number];
type IndexerOption = "all" | SupportedIndexer;
type HorizonOption = 6 | 12 | 24;
type RangeOption = 1 | 2 | 3;
type StepOption = 0.25 | 0.5 | 1;

interface SensitivityParams {
  indexer: IndexerOption;
  horizon: HorizonOption;
  range: RangeOption;
  step: StepOption;
}

const HORIZON_OPTIONS = [
  { value: 6, label: "6 meses" },
  { value: 12, label: "12 meses" },
  { value: 24, label: "24 meses" },
] as const;

const RANGE_OPTIONS = [
  { value: 1, label: "± 1 p.p." },
  { value: 2, label: "± 2 p.p." },
  { value: 3, label: "± 3 p.p." },
] as const;

const STEP_OPTIONS = [
  { value: 0.25, label: "0,25 p.p." },
  { value: 0.5, label: "0,50 p.p." },
  { value: 1, label: "1,00 p.p." },
] as const;

function buildShocks(range: number, step: number): number[] {
  const shocks: number[] = [];
  for (let value = -range; value <= range + 1e-9; value += step) {
    shocks.push(Number(value.toFixed(4)));
  }
  if (!shocks.some((shock) => Math.abs(shock) < 1e-9)) {
    shocks.push(0);
    shocks.sort((a, b) => a - b);
  }
  return shocks;
}

function normalizeIndexer(value?: string): SupportedIndexer | null {
  const normalized = value?.toUpperCase().trim();
  if (!normalized) return null;
  if (normalized.includes("CDI") || normalized.includes("DI")) return "CDI";
  if (normalized.includes("SELIC")) return "SELIC";
  if (normalized.includes("IPCA")) return "IPCA";
  return null;
}

interface SensitivityDashboardProps {
  debts: LegacyDebt[];
}

export const SensitivityDashboard = ({ debts }: SensitivityDashboardProps) => {
  const { selectedCompany } = useCompany();

  const [indexer, setIndexer] = useState<IndexerOption>("all");
  const [horizon, setHorizon] = useState<HorizonOption>(12);
  const [range, setRange] = useState<RangeOption>(2);
  const [step, setStep] = useState<StepOption>(0.5);
  const [resultMatrix, setResultMatrix] = useState<SensitivityMatrix | null>(null);
  const [resultIndexerLabel, setResultIndexerLabel] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{
    horizon: number;
    shockCount: number;
    params: SensitivityParams;
  } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const normalizedDebts = useMemo<NormalizedDebtForCalculation[]>(
    () => debts.map(normalizeDebtForCalculation),
    [debts],
  );

  const indexerCounts = useMemo(() => {
    const counts: Record<SupportedIndexer, number> = { CDI: 0, SELIC: 0, IPCA: 0 };
    normalizedDebts.forEach((debt) => {
      const key = normalizeIndexer(debt.indexer);
      if (key && debt.firstDueDate && debt.dueDate) {
        counts[key] += 1;
      }
    });
    return counts;
  }, [normalizedDebts]);

  const totalPostFixed =
    indexerCounts.CDI + indexerCounts.SELIC + indexerCounts.IPCA;

  const shocks = useMemo(() => buildShocks(range, step), [range, step]);
  const currentParams = useMemo<SensitivityParams>(
    () => ({ indexer, horizon, range, step }),
    [indexer, horizon, range, step],
  );

  const eligibleIndexers = useMemo<SupportedIndexer[]>(() => {
    const candidates: SupportedIndexer[] =
      indexer === "all" ? [...SUPPORTED_INDEXERS] : [indexer];
    return candidates.filter((candidate) => indexerCounts[candidate] > 0);
  }, [indexer, indexerCounts]);

  const {
    calculate,
    error: sensitivityError,
    isLoading,
  } = useSensitivityAnalysis({
    debts: normalizedDebts,
    targetIndexers: eligibleIndexers,
    horizonMonths: horizon,
    shocks,
  });

  const handleCalculate = useCallback(async () => {
    setLocalError(null);

    if (!selectedCompany?.id) {
      setLocalError("Selecione uma empresa antes de calcular.");
      return;
    }

    if (eligibleIndexers.length === 0) {
      setResultMatrix(null);
      setResultIndexerLabel(null);
      setResultMeta(null);
      setLocalError(
        indexer === "all"
          ? "Nenhuma dívida pós-fixada foi encontrada para a empresa ativa."
          : `Nenhuma dívida indexada a ${indexer} foi encontrada.`,
      );
      return;
    }

    setResultMatrix(null);
    setResultIndexerLabel(null);
    setResultMeta(null);

    const matrix = await calculate();
    if (!matrix) return;

    setResultMatrix(matrix);
    setResultIndexerLabel(
      indexer === "all" ? eligibleIndexers.join(" + ") : indexer,
    );
    setResultMeta({
      horizon,
      shockCount: shocks.length,
      params: currentParams,
    });
  }, [
    selectedCompany?.id,
    eligibleIndexers,
    indexer,
    calculate,
    horizon,
    shocks.length,
    currentParams,
  ]);

  const handleControlsKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key !== "Enter" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target as HTMLElement;
      if (!target.closest('[role="combobox"]')) return;

      event.preventDefault();
      event.stopPropagation();
      void handleCalculate();
    },
    [handleCalculate],
  );

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={<Building2 className="h-6 w-6" />}
        title="Selecione uma empresa"
        description="Escolha a empresa ativa no topo do dashboard para analisar a sensibilidade da carteira."
      />
    );
  }

  if (totalPostFixed === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-6 w-6" />}
        title="Sem dívidas pós-fixadas"
        description="A análise de sensibilidade requer ao menos um contrato indexado a CDI, SELIC ou IPCA."
      />
    );
  }

  const aggregatedError = localError ?? sensitivityError;
  const isResultStale =
    !!resultMatrix &&
    !!resultMeta &&
    (resultMeta.params.indexer !== currentParams.indexer ||
      resultMeta.params.horizon !== currentParams.horizon ||
      resultMeta.params.range !== currentParams.range ||
      resultMeta.params.step !== currentParams.step);

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Activity className="h-5 w-5" />
          Análise de sensibilidade
        </h2>
        <p className="text-sm text-muted-foreground">
          Simule choques nas taxas pós-fixadas e veja o impacto mensal nas parcelas
          (PMT) ao longo do horizonte selecionado.
        </p>
      </header>

      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
          onKeyDownCapture={handleControlsKeyDown}
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="sensitivity-indexer"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Indexador
            </Label>
            <Select
              value={indexer}
              onValueChange={(value) => setIndexer(value as IndexerOption)}
            >
              <SelectTrigger id="sensitivity-indexer" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos ({totalPostFixed})</SelectItem>
                {SUPPORTED_INDEXERS.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    disabled={indexerCounts[option] === 0}
                  >
                    {option} ({indexerCounts[option]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="sensitivity-horizon"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Horizonte
            </Label>
            <Select
              value={String(horizon)}
              onValueChange={(value) => setHorizon(Number(value) as HorizonOption)}
            >
              <SelectTrigger id="sensitivity-horizon" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HORIZON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="sensitivity-range"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Intervalo de choque
            </Label>
            <Select
              value={String(range)}
              onValueChange={(value) => setRange(Number(value) as RangeOption)}
            >
              <SelectTrigger id="sensitivity-range" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="sensitivity-step"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Passo
            </Label>
            <Select
              value={String(step)}
              onValueChange={(value) => setStep(Number(value) as StepOption)}
            >
              <SelectTrigger id="sensitivity-step" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEP_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            onClick={() => void handleCalculate()}
            disabled={isLoading}
            className="h-9 gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isLoading ? "Calculando..." : "Calcular sensibilidade"}
          </Button>
        </div>
      </div>

      {aggregatedError && !isLoading && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="space-y-0.5">
            <p className="font-medium text-destructive">
              Não foi possível calcular a sensibilidade
            </p>
            <p className="text-muted-foreground">{aggregatedError}</p>
          </div>
        </div>
      )}

      {isResultStale && !isLoading && !aggregatedError && (
        <div
          className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
          aria-live="polite"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-warning">
            Parâmetros alterados - clique em Calcular novamente para atualizar a matriz.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calculando cenários e simulando parcelas...
        </div>
      )}

      {!isLoading && !aggregatedError && resultMatrix && resultMeta && (
        <ResultPanel
          matrix={resultMatrix}
          indexerLabel={resultIndexerLabel ?? ""}
          horizon={resultMeta.horizon}
          shockCount={resultMeta.shockCount}
        />
      )}

      {!isLoading && !aggregatedError && !resultMatrix && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/40 px-4 py-12 text-center">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Configure os parâmetros e clique em &quot;Calcular sensibilidade&quot;
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            A matriz mostrará a soma das parcelas mensais para cada cenário de choque,
            com o cenário base destacado e variações em vermelho/verde.
          </p>
        </div>
      )}
    </section>
  );
};

interface ResultPanelProps {
  matrix: SensitivityMatrix;
  indexerLabel: string;
  horizon: number;
  shockCount: number;
}

const ResultPanel = ({
  matrix,
  indexerLabel,
  horizon,
  shockCount,
}: ResultPanelProps) => {
  if (matrix.rows.length === 0 || matrix.columns.length === 0) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Sem dados suficientes"
        description="Os parâmetros selecionados não geraram parcelas no horizonte. Tente ampliar o horizonte ou revisar as datas dos contratos."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Indexador:</span>
          <span className="font-semibold text-foreground">{indexerLabel}</span>
          <span aria-hidden>•</span>
          <span>{horizon} meses</span>
          <span aria-hidden>•</span>
          <span>{shockCount} cenários</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <LegendSwatch className="bg-success/[0.18] dark:bg-success/[0.26]" label="Redução de PMT" />
          <LegendSwatch className="bg-destructive/[0.18] dark:bg-destructive/[0.26]" label="Aumento de PMT" />
        </div>
      </div>

      <SensitivityMatrixTable matrix={matrix} />
    </div>
  );
};

const LegendSwatch = ({
  className,
  label,
}: {
  className: string;
  label: string;
}) => (
  <span className="flex items-center gap-1.5">
    <span
      aria-hidden
      className={`inline-block h-2.5 w-3.5 rounded-sm border border-border/60 ${className}`}
    />
    {label}
  </span>
);

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

const EmptyState = ({ icon, title, description }: EmptyStateProps) => (
  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-card/40 px-4 py-12 text-center">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
      {icon}
    </div>
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-md text-xs text-muted-foreground">{description}</p>
    </div>
  </div>
);
