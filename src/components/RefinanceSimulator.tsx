import { useCallback, useEffect, useMemo, useState } from "react";
import { addMonths } from "date-fns";
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  Info,
  Layers,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCompany } from "@/hooks/useCompany";
import type { LegacyDebt } from "@/hooks/useDebts";
import {
  useRefinanceSimulation,
  type RefinanceProposalInput,
} from "@/hooks/useRefinanceSimulation";
import {
  normalizeDebtForCalculation,
  parseLocalDate,
  type NormalizedDebtForCalculation,
} from "@/lib/debtUtils";
import { CET_NOT_CONVERGED_TOOLTIP } from "@/lib/cetStatus";
import {
  compareScenarios,
  summarizeKeepScenario,
  summarizeRefinanceScenario,
  type KeepScenarioSummary,
  type RefinanceComparison,
  type ScheduleInstallment,
} from "@/lib/refinanceComparison";

// ─── Formatação (padrão do projeto: pt-BR / BRL) ──────────────────────────────

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number): string => currencyFormatter.format(value);

const formatNumber = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatPercent = (value: number | null, suffix = "a.a."): string => {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${formatNumber(value)}% ${suffix}`;
};

const formatPp = (value: number): string =>
  `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(value)} p.p.`;

const parseBRL = (value: string): number => {
  if (!value) return 0;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
};

// ─── Datas ────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const toISODate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Usa date-fns/addMonths, que faz o clamp correto de fim de mês
// (31/01 + 1 mês = 28/02), igual ao shiftMonthISO da Edge Function.
const addMonthsISO = (iso: string, months: number): string => {
  const date = parseLocalDate(iso);
  if (!date) return iso;
  return toISODate(addMonths(date, months));
};

const getDefaultFirstDueDate = (): string => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() + 1);
  return toISODate(date);
};

// ─── Tipos de UI ────────────────────────────────────────────────────────────

type RateKind = "pre" | "pos";
type PostIndexer = "CDI" | "SELIC" | "IPCA";

const POST_INDEXERS: PostIndexer[] = ["CDI", "SELIC", "IPCA"];

const normalizeIndexerKind = (
  indexer?: string,
): { kind: RateKind; postIndexer: PostIndexer } => {
  const normalized = indexer?.toUpperCase().trim() ?? "";
  if (normalized.includes("CDI") || normalized.includes("DI"))
    return { kind: "pos", postIndexer: "CDI" };
  if (normalized.includes("SELIC")) return { kind: "pos", postIndexer: "SELIC" };
  if (normalized.includes("IPCA")) return { kind: "pos", postIndexer: "IPCA" };
  return { kind: "pre", postIndexer: "CDI" };
};

interface ProposalDefaults {
  rateKind: RateKind;
  postIndexer: PostIndexer;
  calculationTable: "SAC" | "PRICE";
  interestUnit: "monthly" | "annual";
  interestRate: string;
  spread: string;
}

// Deriva defaults da proposta a partir do conjunto selecionado.
// Pré-preenche taxa/spread apenas para 1 contrato; em pacotes a taxa nova é
// uma negociação fresca, então fica em branco.
const deriveProposalDefaults = (
  debts: NormalizedDebtForCalculation[],
): ProposalDefaults => {
  const kinds = debts.map((d) => normalizeIndexerKind(d.indexer));
  const postSet = new Set(
    kinds.filter((k) => k.kind === "pos").map((k) => k.postIndexer),
  );
  const allSamePost = kinds.every((k) => k.kind === "pos") && postSet.size === 1;

  const rateKind: RateKind = allSamePost ? "pos" : "pre";
  const postIndexer: PostIndexer = allSamePost
    ? [...postSet][0]
    : "CDI";

  const tables = new Set(debts.map((d) => d.calculationTable));
  const calculationTable = tables.size === 1 ? [...tables][0] : "PRICE";

  const units = new Set(debts.map((d) => d.interestType));
  const interestUnit = units.size === 1 ? [...units][0] : "monthly";

  const single = debts.length === 1 ? debts[0] : null;
  const interestRate =
    single && rateKind === "pre" && single.interestRate
      ? String(single.interestRate)
      : "";
  const spread = single && single.spreadRate ? String(single.spreadRate) : "";

  return { rateKind, postIndexer, calculationTable, interestUnit, interestRate, spread };
};

interface RefinanceSimulatorProps {
  debts: LegacyDebt[];
}

export const RefinanceSimulator = ({ debts }: RefinanceSimulatorProps) => {
  const { selectedCompany } = useCompany();
  const { isSimulating, error, setError, fetchCurrentSchedules, simulateRefinance } =
    useRefinanceSimulation();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const normalizedDebts = useMemo<NormalizedDebtForCalculation[]>(
    () => debts.map(normalizeDebtForCalculation),
    [debts],
  );

  const bankOptions = useMemo(
    () => Array.from(new Set(normalizedDebts.map((d) => d.bank))).sort(),
    [normalizedDebts],
  );

  const [bankFilter, setBankFilter] = useState<string>("all");
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const selectedIdsSignature = selectedDebtIds.slice().sort().join("|");

  const [keepLoading, setKeepLoading] = useState(false);
  const [keepError, setKeepError] = useState<string | null>(null);
  const [schedulesByDebt, setSchedulesByDebt] = useState<
    Record<string, ScheduleInstallment[]>
  >({});
  const [keepSummary, setKeepSummary] = useState<KeepScenarioSummary | null>(null);

  // Proposta
  const [amountValue, setAmountValue] = useState("");
  const [rateKind, setRateKind] = useState<RateKind>("pre");
  const [interestRate, setInterestRate] = useState("");
  const [interestUnit, setInterestUnit] = useState<"monthly" | "annual">("monthly");
  const [postIndexer, setPostIndexer] = useState<PostIndexer>("CDI");
  const [spread, setSpread] = useState("");
  const [calculationTable, setCalculationTable] = useState<"SAC" | "PRICE">("PRICE");
  const [termMonths, setTermMonths] = useState("");
  const [iofValue, setIofValue] = useState("");
  const [tacValue, setTacValue] = useState("");

  const [comparison, setComparison] = useState<RefinanceComparison | null>(null);

  const filteredDebts = useMemo(
    () =>
      bankFilter === "all"
        ? normalizedDebts
        : normalizedDebts.filter((d) => d.bank === bankFilter),
    [normalizedDebts, bankFilter],
  );

  const selectedDebts = useMemo(
    () => normalizedDebts.filter((d) => selectedDebtIds.includes(d.id)),
    [normalizedDebts, selectedDebtIds],
  );

  const toggleDebt = useCallback((id: string) => {
    setSelectedDebtIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedDebtIds((prev) =>
      Array.from(new Set([...prev, ...filteredDebts.map((d) => d.id)])),
    );
  }, [filteredDebts]);

  const clearSelection = useCallback(() => setSelectedDebtIds([]), []);

  // Carrega cronogramas do(s) contrato(s) e pré-preenche a proposta.
  useEffect(() => {
    if (selectedDebts.length === 0) {
      setKeepSummary(null);
      setSchedulesByDebt({});
      setComparison(null);
      return;
    }

    let cancelled = false;
    setKeepLoading(true);
    setKeepError(null);
    setKeepSummary(null);
    setComparison(null);
    setError(null);

    void (async () => {
      try {
        const schedules = await fetchCurrentSchedules(selectedDebts);
        if (cancelled) return;

        setSchedulesByDebt(schedules);
        const summary = summarizeKeepScenario(
          selectedDebts.map((d) => schedules[d.id] ?? []),
          today,
        );
        setKeepSummary(summary);

        const defaults = deriveProposalDefaults(selectedDebts);
        setRateKind(defaults.rateKind);
        setPostIndexer(defaults.postIndexer);
        setCalculationTable(defaults.calculationTable);
        setInterestUnit(defaults.interestUnit);
        setInterestRate(defaults.interestRate);
        setSpread(defaults.spread);
        setTermMonths(summary.termMonths > 0 ? String(summary.termMonths) : "");
        setAmountValue(
          summary.outstandingBalance > 0
            ? formatNumber(summary.outstandingBalance)
            : "",
        );
        setIofValue("");
        setTacValue("");
      } catch (err) {
        if (cancelled) return;
        setKeepError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar os cronogramas dos contratos.",
        );
      } finally {
        if (!cancelled) setKeepLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // selectedIdsSignature captura a mudança real do conjunto selecionado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdsSignature, fetchCurrentSchedules, setError, today]);

  // Detalhamento por contrato dentro do envelope.
  const perContract = useMemo(() => {
    return selectedDebts
      .map((debt) => ({
        debt,
        summary: summarizeKeepScenario([schedulesByDebt[debt.id] ?? []], today),
      }))
      .filter((row) => row.summary.contractCount > 0);
  }, [selectedDebts, schedulesByDebt, today]);

  const isBundle = (keepSummary?.contractCount ?? 0) > 1;

  const handleSimulate = useCallback(async () => {
    setError(null);
    setComparison(null);

    if (!selectedCompany?.id) {
      setError("Selecione uma empresa antes de simular.");
      return;
    }
    if (!keepSummary || keepSummary.contractCount === 0) {
      setError("Selecione ao menos um contrato com saldo em aberto.");
      return;
    }

    const financedAmount = parseBRL(amountValue);
    const term = parseInt(termMonths, 10);

    if (!(financedAmount > 0)) {
      setError("Informe um valor refinanciado válido.");
      return;
    }
    if (!Number.isFinite(term) || term <= 0) {
      setError("Informe um novo prazo válido (em meses).");
      return;
    }

    const rate = parseFloat(interestRate.replace(",", "."));
    const spreadRate = parseFloat(spread.replace(",", "."));

    if (rateKind === "pre" && !(rate > 0)) {
      setError("Informe a taxa de juros da proposta.");
      return;
    }

    const firstDueDate = getDefaultFirstDueDate();
    const lastDueDate = addMonthsISO(firstDueDate, term - 1);

    const proposal: RefinanceProposalInput =
      rateKind === "pre"
        ? {
            financedAmount,
            firstDueDate,
            lastDueDate,
            calculationTable,
            interestRate: rate,
            interestType: interestUnit,
            indexer: "Pré-fixado",
            spreadRate: 0,
            iofAmount: parseBRL(iofValue),
            tacAmount: parseBRL(tacValue),
          }
        : {
            financedAmount,
            firstDueDate,
            lastDueDate,
            calculationTable,
            interestRate: 0,
            interestType: "monthly",
            indexer: postIndexer,
            spreadRate: Number.isFinite(spreadRate) ? spreadRate : 0,
            iofAmount: parseBRL(iofValue),
            tacAmount: parseBRL(tacValue),
          };

    const result = await simulateRefinance(proposal);
    if (!result) return;

    const refinanceSummary = summarizeRefinanceScenario(
      result.installments,
      result.cet,
      financedAmount,
    );
    const upfrontCost = (proposal.iofAmount ?? 0) + (proposal.tacAmount ?? 0);
    setComparison(compareScenarios(keepSummary, refinanceSummary, upfrontCost));
  }, [
    selectedCompany?.id,
    keepSummary,
    amountValue,
    termMonths,
    interestRate,
    spread,
    rateKind,
    interestUnit,
    postIndexer,
    calculationTable,
    iofValue,
    tacValue,
    simulateRefinance,
    setError,
  ]);

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={<Building2 className="h-6 w-6" />}
        title="Selecione uma empresa"
        description="Escolha a empresa ativa no topo do dashboard para simular um refinanciamento."
      />
    );
  }

  if (normalizedDebts.length === 0) {
    return (
      <EmptyState
        icon={<ArrowLeftRight className="h-6 w-6" />}
        title="Sem contratos cadastrados"
        description="Cadastre ao menos um contrato de dívida para comparar com uma proposta de refinanciamento."
      />
    );
  }

  const selectedTotalFinanced = selectedDebts.reduce(
    (sum, d) => sum + d.financedAmount,
    0,
  );

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ArrowLeftRight className="h-5 w-5" />
          Simulador de refinanciamento
        </h2>
        <p className="text-sm text-muted-foreground">
          Compare manter os contratos atuais com uma proposta de refinanciamento.
          Selecione vários contratos para simular a consolidação ("envelopar") de
          tudo em uma única dívida nova. Os cálculos rodam em memória — nada é gravado.
        </p>
      </header>

      {/* Passo 1: seleção de contratos */}
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5 sm:max-w-xs">
            <Label
              htmlFor="refi-bank"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Filtrar por banco
            </Label>
            <Select value={bankFilter} onValueChange={setBankFilter}>
              <SelectTrigger id="refi-bank" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os bancos</SelectItem>
                {bankOptions.map((bank) => (
                  <SelectItem key={bank} value={bank}>
                    {bank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={selectAllFiltered}
            >
              <Layers className="h-3.5 w-3.5" />
              Selecionar {bankFilter === "all" ? "todos" : `todos de ${bankFilter}`}
            </Button>
            {selectedDebtIds.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                Limpar ({selectedDebtIds.length})
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-md border border-border/40 p-1">
          {filteredDebts.map((debt) => {
            const checked = selectedDebtIds.includes(debt.id);
            return (
              <label
                key={debt.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/50 ${
                  checked ? "bg-muted/40" : ""
                }`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleDebt(debt.id)}
                  aria-label={`Selecionar ${debt.bank}`}
                />
                <span className="flex-1 truncate text-foreground">
                  {debt.bank}
                  {debt.contractNumber ? (
                    <span className="text-muted-foreground"> · {debt.contractNumber}</span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(debt.financedAmount)}
                </span>
              </label>
            );
          })}
        </div>

        {selectedDebts.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedDebts.length} contrato(s) selecionado(s) · valor financiado
            original somado {formatCurrency(selectedTotalFinanced)}
          </p>
        )}
      </div>

      {keepLoading && (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando cronogramas dos contratos...
        </div>
      )}

      {keepError && !keepLoading && (
        <ErrorBanner title="Não foi possível carregar os contratos" message={keepError} />
      )}

      {!keepLoading &&
        !keepError &&
        selectedDebts.length > 0 &&
        keepSummary &&
        keepSummary.contractCount === 0 && (
          <ErrorBanner
            title="Sem saldo em aberto"
            message="Os contratos selecionados não têm parcelas futuras (já quitados). Selecione contratos com saldo devedor."
          />
        )}

      {!keepLoading && !keepError && keepSummary && keepSummary.contractCount > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Passo 2: cenário MANTER (agregado) */}
            <div className="rounded-lg border border-border/60 bg-card p-4">
              <div className="mb-3 flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-foreground">
                  {isBundle ? "Manter contratos atuais" : "Manter contrato atual"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isBundle
                    ? `${keepSummary.contractCount} contratos · saldo e parcelas remanescentes`
                    : "Saldo devedor e parcelas remanescentes"}
                </p>
              </div>

              <dl className="space-y-2">
                <Row label="Saldo devedor total" value={formatCurrency(keepSummary.outstandingBalance)} />
                <Row
                  label="Prazo até quitação"
                  value={`${keepSummary.termMonths} mês(es)`}
                />
                <Row label="Custo total remanescente" value={formatCurrency(keepSummary.totalCost)} />
                <Row
                  label="Parcela mensal atual (soma)"
                  value={formatCurrency(keepSummary.firstPMT)}
                />
                {isBundle && (
                  <Row
                    label="Pico mensal de parcelas"
                    value={formatCurrency(keepSummary.peakMonthlyPMT)}
                  />
                )}
              </dl>

              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border/60 pt-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  CET {isBundle ? "combinado" : ""}
                </dt>
                <dd className="font-mono text-lg font-semibold tabular-nums text-foreground">
                  <CetValue annual={keepSummary.cetAnnual} converged={keepSummary.cetConverged} />
                </dd>
              </div>

              {isBundle && perContract.length > 0 && (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Contratos no envelope
                  </p>
                  <div className="space-y-1">
                    {perContract.map(({ debt, summary }) => (
                      <div
                        key={debt.id}
                        className="flex items-baseline justify-between gap-3 text-xs"
                      >
                        <span className="truncate text-muted-foreground">
                          {debt.bank}
                          {debt.contractNumber ? ` · ${debt.contractNumber}` : ""}
                        </span>
                        <span className="flex shrink-0 items-baseline gap-3 font-mono tabular-nums">
                          <span className="text-foreground">
                            {formatCurrency(summary.outstandingBalance)}
                          </span>
                          <span className="w-20 text-right text-muted-foreground">
                            <CetValue
                              annual={summary.cetAnnual}
                              converged={summary.cetConverged}
                            />
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Passo 3: proposta */}
            <div className="rounded-lg border border-border/60 bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Proposta de refinanciamento
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                {isBundle
                  ? "Uma única dívida nova substituindo o pacote. Valor padrão = saldo devedor total."
                  : "Valor padrão = saldo devedor atual. Ajuste conforme a oferta do banco."}
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Valor refinanciado">
                  <CurrencyInput
                    className="h-9 font-mono tabular-nums"
                    value={amountValue}
                    onValueChange={(formatted) => setAmountValue(formatted)}
                    showCurrencySymbol
                    placeholder="0,00"
                  />
                </Field>

                <Field label="Novo prazo (meses)">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="h-9"
                    value={termMonths}
                    onChange={(e) => setTermMonths(e.target.value)}
                    placeholder="Ex.: 48"
                  />
                </Field>

                <Field label="Sistema de amortização">
                  <Select
                    value={calculationTable}
                    onValueChange={(value) =>
                      setCalculationTable(value as "SAC" | "PRICE")
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRICE">PRICE</SelectItem>
                      <SelectItem value="SAC">SAC</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Tipo de taxa">
                  <Select
                    value={rateKind}
                    onValueChange={(value) => setRateKind(value as RateKind)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pre">Pré-fixado</SelectItem>
                      <SelectItem value="pos">Pós-fixado</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {rateKind === "pre" ? (
                  <>
                    <Field label="Taxa de juros">
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        className="h-9"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        placeholder="Ex.: 1,80"
                      />
                    </Field>
                    <Field label="Base da taxa">
                      <Select
                        value={interestUnit}
                        onValueChange={(value) =>
                          setInterestUnit(value as "monthly" | "annual")
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">ao mês (a.m.)</SelectItem>
                          <SelectItem value="annual">ao ano (a.a.)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Indexador">
                      <Select
                        value={postIndexer}
                        onValueChange={(value) => setPostIndexer(value as PostIndexer)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {POST_INDEXERS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Spread (a.a.)">
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        className="h-9"
                        value={spread}
                        onChange={(e) => setSpread(e.target.value)}
                        placeholder="Ex.: 3,50"
                      />
                    </Field>
                  </>
                )}

                <Field label="IOF (novo)">
                  <CurrencyInput
                    className="h-9 font-mono tabular-nums"
                    value={iofValue}
                    onValueChange={(formatted) => setIofValue(formatted)}
                    showCurrencySymbol
                    placeholder="0,00"
                  />
                </Field>

                <Field label="TAC (nova)">
                  <CurrencyInput
                    className="h-9 font-mono tabular-nums"
                    value={tacValue}
                    onValueChange={(formatted) => setTacValue(formatted)}
                    showCurrencySymbol
                    placeholder="0,00"
                  />
                </Field>
              </div>

              {rateKind === "pos" && (
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  A taxa do indexador usa a projeção-base da empresa para os períodos
                  futuros (mesma premissa do dashboard).
                </p>
              )}

              <Button
                type="button"
                onClick={() => void handleSimulate()}
                disabled={isSimulating}
                className="mt-4 h-9 w-full gap-2"
              >
                {isSimulating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isSimulating ? "Simulando..." : "Simular refinanciamento"}
              </Button>
            </div>
          </div>

          {error && !isSimulating && (
            <ErrorBanner title="Não foi possível simular" message={error} />
          )}

          {/* Passo 4 e 5: resultado e comparação */}
          {comparison && !isSimulating && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ScenarioCard
                  tone="neutral"
                  title={isBundle ? "Manter contratos atuais" : "Manter contrato atual"}
                  subtitle={
                    isBundle
                      ? `${comparison.keep.contractCount} contratos · remanescente`
                      : "Parcelas remanescentes"
                  }
                  rows={[
                    { label: "Prazo até quitação", value: `${comparison.keep.termMonths} mês(es)` },
                    { label: "Custo total remanescente", value: formatCurrency(comparison.keep.totalCost) },
                    { label: "Parcela mensal atual (soma)", value: formatCurrency(comparison.keep.firstPMT) },
                  ]}
                  cetAnnual={comparison.keep.cetAnnual}
                  cetConverged={comparison.keep.cetConverged}
                />
                <ScenarioCard
                  tone="accent"
                  title="Refinanciar (dívida única)"
                  subtitle="Proposta simulada"
                  rows={[
                    { label: "Valor financiado", value: formatCurrency(comparison.refinance.principalBasis) },
                    { label: "Novo prazo", value: `${comparison.refinance.termMonths} parcela(s)` },
                    { label: "Custo total", value: formatCurrency(comparison.refinance.totalCost) },
                    { label: "Nova parcela inicial", value: formatCurrency(comparison.refinance.firstPMT) },
                    { label: "IOF + TAC (entrada)", value: formatCurrency(comparison.upfrontCost) },
                  ]}
                  cetAnnual={comparison.refinance.cetAnnual}
                  cetConverged={comparison.refinance.cetConverged}
                />
              </div>

              <VerdictPanel comparison={comparison} isBundle={isBundle} />
            </div>
          )}
        </>
      )}
    </section>
  );
};

// ─── Subcomponentes ───────────────────────────────────────────────────────────

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </Label>
    {children}
  </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="font-mono text-sm tabular-nums text-foreground">{value}</dd>
  </div>
);

const CetValue = ({
  annual,
  converged,
}: {
  annual: number | null;
  converged: boolean;
}) =>
  converged && annual != null ? (
    <>{formatPercent(annual)}</>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help text-muted-foreground">—</span>
      </TooltipTrigger>
      <TooltipContent>{CET_NOT_CONVERGED_TOOLTIP}</TooltipContent>
    </Tooltip>
  );

interface ScenarioCardProps {
  tone: "neutral" | "accent";
  title: string;
  subtitle: string;
  rows: { label: string; value: string }[];
  cetAnnual: number | null;
  cetConverged: boolean;
}

const ScenarioCard = ({
  tone,
  title,
  subtitle,
  rows,
  cetAnnual,
  cetConverged,
}: ScenarioCardProps) => (
  <div
    className={`rounded-lg border p-4 ${
      tone === "accent"
        ? "border-primary/40 bg-primary/5"
        : "border-border/60 bg-card"
    }`}
  >
    <div className="mb-3 flex flex-col gap-0.5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>

    <dl className="space-y-2">
      {rows.map((row) => (
        <Row key={row.label} label={row.label} value={row.value} />
      ))}
    </dl>

    <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border/60 pt-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        CET
      </dt>
      <dd className="font-mono text-lg font-semibold tabular-nums text-foreground">
        <CetValue annual={cetAnnual} converged={cetConverged} />
      </dd>
    </div>
  </div>
);

const VerdictPanel = ({
  comparison,
  isBundle,
}: {
  comparison: RefinanceComparison;
  isBundle: boolean;
}) => {
  const {
    verdict,
    cetDeltaAnnual,
    monthlyPmtRelief,
    firstPmtRelief,
    nominalCostDelta,
    termDeltaMonths,
    breakevenMonths,
  } = comparison;

  const config: Record<
    RefinanceComparison["verdict"],
    { tone: string; icon: React.ReactNode; headline: string }
  > = {
    economia: {
      tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
      icon: <TrendingDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
      headline:
        cetDeltaAnnual != null
          ? `Economia real: o refinanciamento reduz o CET em ${formatPp(Math.abs(cetDeltaAnnual))} a.a.`
          : "Economia real: o refinanciamento reduz o CET.",
    },
    alivio_fluxo: {
      tone: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
      icon: <Info className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      headline:
        cetDeltaAnnual != null
          ? `Não há economia de juros (o CET sobe ${formatPp(cetDeltaAnnual)} a.a.), mas a parcela fica menor — alívio de caixa.`
          : "A parcela fica menor, mas sem economia de juros — alívio de caixa.",
    },
    mais_caro: {
      tone: "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-100",
      icon: <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />,
      headline:
        cetDeltaAnnual != null
          ? `Refinanciar encarece: o CET sobe ${formatPp(cetDeltaAnnual)} a.a. e a parcela não diminui.`
          : "Refinanciar encarece e a parcela não diminui.",
    },
    neutro: {
      tone: "border-border/60 bg-card text-foreground",
      icon: <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />,
      headline: "CET praticamente igual — avalie o alívio de parcela e o prazo.",
    },
    indefinido: {
      tone: "border-border/60 bg-muted/30 text-muted-foreground",
      icon: <AlertTriangle className="h-5 w-5 text-muted-foreground" />,
      headline:
        "Não foi possível comparar o CET — algum cenário não convergiu. Compare apenas parcela e prazo.",
    },
  };

  const current = config[verdict];
  const pmtReliefLabel = isBundle
    ? "Alívio de caixa mensal (soma → parcela única)"
    : "Alívio de PMT (média)";

  return (
    <div className={`rounded-lg border p-4 ${current.tone}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{current.icon}</span>
        <div className="space-y-3">
          <p className="text-sm font-semibold">{current.headline}</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Metric
              label={pmtReliefLabel}
              value={`${formatCurrency(Math.abs(firstPmtRelief))}/mês`}
              hint={firstPmtRelief >= 0 ? "redução na parcela" : "aumento na parcela"}
            />
            <Metric
              label="Variação da PMT média"
              value={`${formatCurrency(Math.abs(monthlyPmtRelief))}/mês`}
              hint={monthlyPmtRelief >= 0 ? "redução" : "aumento"}
            />
            {breakevenMonths != null && (
              <Metric
                label="Payback do IOF/TAC"
                value={`${Math.ceil(breakevenMonths)} mês(es)`}
                hint="até o alívio de parcela cobrir os custos de entrada"
              />
            )}
            <Metric
              label="Diferença de custo nominal"
              value={`${formatCurrency(Math.abs(nominalCostDelta))}`}
              hint={
                termDeltaMonths !== 0
                  ? `${nominalCostDelta >= 0 ? "menor" : "maior"} — prazos diferentes, não comparável diretamente`
                  : nominalCostDelta >= 0
                    ? "menor"
                    : "maior"
              }
            />
          </div>

          <p className="text-xs opacity-80">
            O comparativo honesto é o CET (taxa). Parcela menor em prazo maior pode
            custar mais juros no total.
          </p>
        </div>
      </div>
    </div>
  );
};

const Metric = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="rounded-md border border-border/40 bg-background/40 px-3 py-2">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-mono text-sm font-semibold tabular-nums">{value}</p>
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

const ErrorBanner = ({ title, message }: { title: string; message: string }) => (
  <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
    <div className="space-y-0.5">
      <p className="font-medium text-destructive">{title}</p>
      <p className="text-muted-foreground">{message}</p>
    </div>
  </div>
);

interface EmptyStateProps {
  icon: React.ReactNode;
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
