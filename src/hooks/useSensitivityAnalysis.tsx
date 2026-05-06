import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { type NormalizedDebtForCalculation } from "@/lib/debtUtils";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";
import {
  buildSensitivityMatrix,
  type SensitivityMatrix,
  type SensitivityScenarioInput,
} from "@/lib/sensitivityMatrix";

interface EdgeFunctionInstallment {
  due_date: string;
  installment_amount: number;
}

interface EdgeFunctionResponse {
  success?: boolean;
  installments?: EdgeFunctionInstallment[];
  error?: string;
}

export interface UseSensitivityAnalysisOptions {
  debts: NormalizedDebtForCalculation[];
  targetIndexers: string[];
  horizonMonths: number;
  shocks?: number[];
}

export interface UseSensitivityAnalysisReturn {
  matrix: SensitivityMatrix | null;
  isLoading: boolean;
  error: string | null;
  calculate: () => Promise<SensitivityMatrix | null>;
}

const DEFAULT_SHOCKS = [-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0];
const SIMULATION_CONCURRENCY = 4;

function normalizeIndexer(value?: string): string {
  if (!value) return "";
  const normalized = value.toUpperCase().trim();
  if (normalized.includes("CDI") || normalized.includes("DI")) return "CDI";
  if (normalized.includes("SELIC")) return "SELIC";
  if (normalized.includes("IPCA")) return "IPCA";
  return normalized;
}

function formatShockLabel(value: number): string {
  const formatter = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  });
  return `${formatter.format(value)} p.p.`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

export function useSensitivityAnalysis({
  debts,
  targetIndexers,
  horizonMonths,
  shocks = DEFAULT_SHOCKS,
}: UseSensitivityAnalysisOptions): UseSensitivityAnalysisReturn {
  const { selectedCompany } = useCompany();
  const [matrix, setMatrix] = useState<SensitivityMatrix | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedTargetIndexers = useMemo(
    () => Array.from(new Set(targetIndexers.map(normalizeIndexer).filter(Boolean))),
    [targetIndexers],
  );

  const targetDebts = useMemo(() => {
    const targetSet = new Set(normalizedTargetIndexers);
    return debts.filter(
      (debt) =>
        targetSet.has(normalizeIndexer(debt.indexer)) &&
        debt.firstDueDate &&
        debt.dueDate,
    );
  }, [debts, normalizedTargetIndexers]);

  const calculate = useCallback(async () => {
    if (!selectedCompany?.id) {
      setError("Nenhuma empresa selecionada");
      setMatrix(null);
      return null;
    }

    if (targetDebts.length === 0) {
      setError("Nenhuma dívida pós-fixada elegível foi encontrada");
      setMatrix(null);
      return null;
    }

    if (horizonMonths <= 0) {
      setError("Horizonte deve ser maior que zero");
      setMatrix(null);
      return null;
    }

    setIsLoading(true);
    setError(null);
    setMatrix(null);

    try {
      const scenarioInputs: SensitivityScenarioInput[] = [];

      for (const shockValue of shocks) {
        const temporaryOverrides =
          shockValue !== 0
            ? normalizedTargetIndexers.map((indexType) => ({
                indexType,
                adjustmentPp: shockValue,
              }))
            : [];

        const simulationErrors: string[] = [];
        const debtInstallments = await mapWithConcurrency(
          targetDebts,
          SIMULATION_CONCURRENCY,
          async (debt) => {
            const { data, error: fnError } = await supabase.functions.invoke(
              "calculate-amortization",
              {
                body: {
                  debtId: debt.id,
                  companyId: selectedCompany.id,
                  financedAmount: debt.financedAmount,
                  firstDueDate: debt.firstDueDate,
                  lastDueDate: debt.dueDate,
                  calculationTable: debt.calculationTable,
                  interestRate: debt.interestRate,
                  interestType: debt.interestType,
                  indexer: debt.indexer,
                  spreadRate: debt.spreadRate || 0,
                  iofAmount: debt.iofAmount || 0,
                  tacAmount: debt.tacAmount || 0,
                  temporaryOverrides,
                  persist: false,
                  applyOverridesOnlyToFuture: true,
                },
              },
            );

            const response = data as EdgeFunctionResponse | undefined;
            const responseError = response?.error;

            if (fnError || responseError) {
              const indexer = normalizeIndexer(debt.indexer) || "indexador";
              const message = responseError
                || (fnError ? await getEdgeFunctionErrorMessage(fnError, "erro desconhecido") : "erro desconhecido");
              simulationErrors.push(`${indexer}: ${message}`);
              return {
                debtId: debt.id,
                installments: [] as EdgeFunctionInstallment[],
              };
            }

            return {
              debtId: debt.id,
              installments: response?.installments ?? [],
            };
          },
        );

        if (simulationErrors.length > 0) {
          const uniqueErrors = Array.from(new Set(simulationErrors));
          throw new Error(
            `Algumas simulações falharam: ${uniqueErrors.slice(0, 3).join(" | ")}`,
          );
        }

        scenarioInputs.push({
          shockValue,
          shockLabel: formatShockLabel(shockValue),
          debtInstallments,
        });
      }

      const builtMatrix = buildSensitivityMatrix(
        scenarioInputs,
        horizonMonths,
        new Date(),
      );

      setMatrix(builtMatrix);
      return builtMatrix;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao calcular sensibilidade";
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedCompany?.id,
    targetDebts,
    horizonMonths,
    shocks,
    normalizedTargetIndexers,
  ]);

  return {
    matrix,
    isLoading,
    error,
    calculate,
  };
}
