import { useMemo } from "react";
import { useDebts } from "@/hooks/useDebts";
import { useDebtInstallments } from "@/hooks/useDebtInstallments";
import { useDebtGuarantees } from "@/hooks/useDebtGuarantees";
import { useEconomicIndices } from "@/hooks/useEconomicIndices";
import { useCompany } from "@/hooks/useCompany";
import { normalizeDebtForCalculation, debtIntersectsDateRange, parseLocalDate } from "@/lib/debtUtils";
import { computeDashboardMetrics, type DashboardMetrics } from "@/lib/dashboardMetrics";

export type PeriodMode = "vigencia" | "vencimento";

export interface UseDashboardMetricsOptions {
  startDate?: Date;
  endDate?: Date;
  periodMode: PeriodMode;
  bankFilter?: string;
  calculationTypeFilter?: string;
  debtIdsFilter?: string[];
}

export function useDashboardMetrics(opts: UseDashboardMetricsOptions): {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { selectedCompany } = useCompany();
  const { debts: dbDebts, isLoading: debtsLoading } = useDebts();
  const { latestRates } = useEconomicIndices();

  // Normaliza todos os contratos
  const allNormalized = useMemo(
    () => dbDebts.map(normalizeDebtForCalculation),
    [dbDebts],
  );

  // Aplica filtros de banco / tipo / ids (sem período — período depende de installments)
  const preFilteredDebts = useMemo(() => {
    return allNormalized.filter((debt) => {
      if (opts.bankFilter && opts.bankFilter !== "all" && debt.bank !== opts.bankFilter)
        return false;
      if (
        opts.calculationTypeFilter &&
        opts.calculationTypeFilter !== "all" &&
        debt.calculationTable !== opts.calculationTypeFilter
      )
        return false;
      if (opts.debtIdsFilter && opts.debtIdsFilter.length > 0 && !opts.debtIdsFilter.includes(debt.id))
        return false;
      return true;
    });
  }, [allNormalized, opts.bankFilter, opts.calculationTypeFilter, opts.debtIdsFilter]);

  // Busca parcelas para os contratos pré-filtrados
  const { installmentsData, loading: installsLoading } = useDebtInstallments(preFilteredDebts);

  // Filtro de período (após ter installments disponíveis)
  const filteredDebts = useMemo(() => {
    if (opts.periodMode === "vigencia") {
      return preFilteredDebts.filter((debt) =>
        debtIntersectsDateRange(debt, opts.startDate, opts.endDate),
      );
    }

    // Modo vencimento: mantém contratos que tenham ao menos uma parcela no range
    return preFilteredDebts.filter((debt) => {
      if (!opts.startDate && !opts.endDate) return true;
      const installments = installmentsData[debt.id];
      if (!installments || installments.length === 0) return false;

      const startYM = opts.startDate
        ? `${opts.startDate.getFullYear()}-${String(opts.startDate.getMonth() + 1).padStart(2, "0")}`
        : null;
      const endYM = opts.endDate
        ? `${opts.endDate.getFullYear()}-${String(opts.endDate.getMonth() + 1).padStart(2, "0")}`
        : null;

      return installments.some((inst) => {
        const due = parseLocalDate(inst.due_date);
        if (!due) return false;
        const dueYM = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}`;
        if (startYM && dueYM < startYM) return false;
        if (endYM && dueYM > endYM) return false;
        return true;
      });
    });
  }, [preFilteredDebts, installmentsData, opts.periodMode, opts.startDate, opts.endDate]);

  const { guaranteeMetrics } = useDebtGuarantees({
    companyId: selectedCompany?.id,
    includeMetrics: true,
  });

  const cdiAnnualRate = latestRates?.CDI?.value ?? null;

  const metrics = useMemo<DashboardMetrics | null>(() => {
    if (filteredDebts.length === 0) return null;

    return computeDashboardMetrics({
      debts: filteredDebts,
      installmentsByDebtId: installmentsData,
      guaranteeMetrics: guaranteeMetrics ?? null,
      cdiAnnualRate,
      today: new Date(),
      period: {
        start: opts.startDate ?? null,
        end: opts.endDate ?? null,
        mode: opts.periodMode,
      },
    });
  }, [filteredDebts, installmentsData, guaranteeMetrics, cdiAnnualRate, opts.startDate, opts.endDate, opts.periodMode]);

  const isLoading = debtsLoading || installsLoading;

  return {
    metrics,
    isLoading,
    error: null,
  };
}
