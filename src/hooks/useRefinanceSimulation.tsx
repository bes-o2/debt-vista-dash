import { useCallback, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { type NormalizedDebtForCalculation } from "@/lib/debtUtils";
import {
  getEdgeFunctionErrorMessage,
  getEdgeFunctionResponseError,
} from "@/lib/edgeFunctionErrors";
import { type CetResult, type ScheduleInstallment } from "@/lib/refinanceComparison";

interface EdgeCalculatedInstallment {
  due_date: string;
  installment_amount: number;
  amortization: number;
  principal_balance: number;
}

interface EdgeResponse {
  success?: boolean;
  installments?: EdgeCalculatedInstallment[];
  cet?: { monthlyRate: number | null; annualRate: number | null; converged: boolean };
  error?: string;
}

export interface RefinanceProposalInput {
  financedAmount: number;
  firstDueDate: string; // YYYY-MM-DD
  lastDueDate: string; // YYYY-MM-DD
  calculationTable: "SAC" | "PRICE";
  interestRate: number;
  interestType: "monthly" | "annual";
  indexer?: string; // 'Pré-fixado' ou CDI/SELIC/IPCA
  spreadRate?: number;
  iofAmount?: number;
  tacAmount?: number;
}

export interface RefinanceSimulationResult {
  installments: ScheduleInstallment[];
  cet: CetResult;
}

const FALLBACK_ERROR =
  "Não foi possível simular o refinanciamento. Verifique os dados e tente novamente.";

const mapEdgeInstallment = (row: EdgeCalculatedInstallment): ScheduleInstallment => ({
  due_date: row.due_date,
  total_amount: row.installment_amount,
  principal_amount: row.amortization,
  remaining_balance: row.principal_balance,
});

const mapDbInstallment = (row: {
  due_date: string;
  total_amount: number;
  principal_amount: number;
  remaining_balance: number;
}): ScheduleInstallment => ({
  due_date: row.due_date,
  total_amount: row.total_amount,
  principal_amount: row.principal_amount,
  remaining_balance: row.remaining_balance,
});

const SCHEDULE_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function useRefinanceSimulation() {
  const { selectedCompany } = useCompany();
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invoca a engine canônica SEM persistir (dry-run). Nunca grava no banco.
  const invokeSchedule = useCallback(
    async (
      body: Record<string, unknown>,
    ): Promise<RefinanceSimulationResult> => {
      if (!selectedCompany?.id) {
        throw new Error("Selecione uma empresa antes de simular.");
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        "calculate-amortization",
        { body: { ...body, companyId: selectedCompany.id, persist: false } },
      );

      if (fnError) {
        throw new Error(await getEdgeFunctionErrorMessage(fnError, FALLBACK_ERROR));
      }

      const responseError = getEdgeFunctionResponseError(data, FALLBACK_ERROR);
      if (responseError) {
        throw new Error(responseError);
      }

      const response = data as EdgeResponse;
      const installments = (response.installments ?? []).map(mapEdgeInstallment);
      const cet: CetResult = {
        annualRate: response.cet?.annualRate ?? null,
        monthlyRate: response.cet?.monthlyRate ?? null,
        converged: response.cet?.converged ?? false,
      };

      return { installments, cet };
    },
    [selectedCompany?.id],
  );

  // Materializa o cronograma de um contrato via dry-run (sem gravar) quando não
  // há parcelas persistidas.
  const computeScheduleFor = useCallback(
    async (debt: NormalizedDebtForCalculation): Promise<ScheduleInstallment[]> => {
      if (!debt.firstDueDate || !debt.dueDate) return [];
      const { installments } = await invokeSchedule({
        debtId: debt.id,
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
      });
      return installments;
    },
    [invokeSchedule],
  );

  /**
   * Cronogramas do cenário MANTER para UM ou MAIS contratos (consolidação N→1).
   * Lê as parcelas já persistidas em uma única query (read-only); para os
   * contratos sem parcelas calculadas, materializa em memória via dry-run
   * (concorrência limitada). Nunca grava no banco.
   */
  const fetchCurrentSchedules = useCallback(
    async (
      debts: NormalizedDebtForCalculation[],
    ): Promise<Record<string, ScheduleInstallment[]>> => {
      const result: Record<string, ScheduleInstallment[]> = {};
      if (debts.length === 0) return result;

      const ids = debts.map((debt) => debt.id);
      const { data, error: dbError } = await supabase
        .from("debt_installments")
        .select("debt_id, due_date, total_amount, principal_amount, remaining_balance")
        .in("debt_id", ids)
        .order("due_date", { ascending: true });

      if (dbError) {
        throw new Error(dbError.message);
      }

      for (const row of data ?? []) {
        (result[row.debt_id] ??= []).push(mapDbInstallment(row));
      }

      const missing = debts.filter((debt) => !result[debt.id]?.length);
      if (missing.length > 0) {
        const computed = await mapWithConcurrency(
          missing,
          SCHEDULE_CONCURRENCY,
          async (debt) => ({ id: debt.id, schedule: await computeScheduleFor(debt) }),
        );
        for (const { id, schedule } of computed) {
          if (schedule.length > 0) result[id] = schedule;
        }
      }

      return result;
    },
    [computeScheduleFor],
  );

  const simulateRefinance = useCallback(
    async (
      proposal: RefinanceProposalInput,
    ): Promise<RefinanceSimulationResult | null> => {
      setIsSimulating(true);
      setError(null);

      try {
        return await invokeSchedule({
          debtId: "refinance-simulation",
          financedAmount: proposal.financedAmount,
          firstDueDate: proposal.firstDueDate,
          lastDueDate: proposal.lastDueDate,
          calculationTable: proposal.calculationTable,
          interestRate: proposal.interestRate,
          interestType: proposal.interestType,
          indexer: proposal.indexer,
          spreadRate: proposal.spreadRate || 0,
          iofAmount: proposal.iofAmount || 0,
          tacAmount: proposal.tacAmount || 0,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : FALLBACK_ERROR);
        return null;
      } finally {
        setIsSimulating(false);
      }
    },
    [invokeSchedule],
  );

  return {
    isSimulating,
    error,
    setError,
    fetchCurrentSchedules,
    simulateRefinance,
  };
}
