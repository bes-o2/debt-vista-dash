import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type NormalizedDebtForCalculation } from '@/lib/debtUtils';
import { getEdgeFunctionErrorMessage, getEdgeFunctionResponseError } from '@/lib/edgeFunctionErrors';
import { useCompany } from '@/hooks/useCompany';
import { useTemporaryScenario } from '@/hooks/useTemporaryScenario';
import { toast } from '@/hooks/use-toast';

const PRE_FIXED_INDEXERS = ['Pré-fixado', 'PRE_FIXADO', 'prefixado'];

const formatBRDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-');
  return day && month && year ? `${day}/${month}/${year}` : isoDate;
};

interface Installment {
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  remaining_balance: number;
}

interface CalculatedInstallment {
  installment_number: number;
  due_date: string;
  amortization: number;
  interest_amount: number;
  installment_amount: number;
  principal_balance: number;
}

type Debt = NormalizedDebtForCalculation;

const mapInstallmentRow = (row: {
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  remaining_balance: number;
}): Installment => ({
  installment_number: row.installment_number,
  due_date: row.due_date,
  principal_amount: row.principal_amount,
  interest_amount: row.interest_amount,
  total_amount: row.total_amount,
  remaining_balance: row.remaining_balance,
});

const mapCalculatedInstallment = (row: CalculatedInstallment): Installment => ({
  installment_number: row.installment_number,
  due_date: row.due_date,
  principal_amount: row.amortization,
  interest_amount: row.interest_amount,
  total_amount: row.installment_amount,
  remaining_balance: row.principal_balance,
});

export const useDebtInstallments = (debts: Debt[]) => {
  const [installmentsData, setInstallmentsData] = useState<{ [debtId: string]: Installment[] }>({});
  const [isFetching, setIsFetching] = useState(false);
  // Assinatura do conjunto de dívidas já refletido em installmentsData. Enquanto
  // não bater com debtsSignature, consideramos "loading" — evita a janela em que
  // loading=false mas os dados ainda são do conjunto anterior (números "pulando").
  const [reconciledSignature, setReconciledSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { selectedCompany } = useCompany();
  const { scenarioSignature, toOverrides } = useTemporaryScenario();
  const temporaryOverrides = useMemo(() => toOverrides(), [toOverrides]);
  const hasTemporaryScenario = temporaryOverrides.length > 0;

  // Memoize debt IDs to prevent infinite re-renders
  const debtIds = useMemo(() => debts.map(debt => debt.id).sort(), [debts]);
  const debtsSignature = useMemo(() => debts
    .map((debt) => [
      debt.id,
      debt.financedAmount,
      debt.releaseDate,
      debt.firstDueDate,
      debt.dueDate,
      debt.calculationTable,
      debt.interestRate,
      debt.interestType,
      debt.indexer || '',
      debt.spreadRate || 0,
      debt.iofAmount || 0,
      debt.tacAmount || 0,
    ].join(':'))
    .sort()
    .join('|'), [debts]);
  const debtMap = useMemo(() => {
    const map: { [id: string]: Debt } = {};
    debts.forEach(debt => {
      map[debt.id] = debt;
    });
    return map;
  }, [debts]);

  // A post-fixed debt is stale when a period that has ALREADY ENDED is still
  // priced with a projected rate (source 'projecao_base'). That happens when
  // new realized BCB data arrived or simply because time passed — either way
  // the installment must be repriced with the now-realized index.
  // Returns the debt ids to reprice and the most recent realized data date
  // (for an auditable "reprecificado com dados de DD/MM" message).
  const detectStaleDebtIds = async (
    storedDebtIds: string[],
  ): Promise<{ ids: string[]; latestDataDate: string | null }> => {
    if (storedDebtIds.length === 0 || !selectedCompany?.id) {
      return { ids: [], latestDataDate: null };
    }

    const postFixedIds = storedDebtIds.filter((id) => {
      const indexer = debtMap[id]?.indexer;
      return indexer && !PRE_FIXED_INDEXERS.includes(indexer);
    });
    if (postFixedIds.length === 0) return { ids: [], latestDataDate: null };

    const today = new Date().toISOString().split('T')[0];

    const { data: staleRefs, error: staleError } = await supabase
      .from('debt_installment_rate_refs')
      .select('debt_id, index_type')
      .eq('source', 'projecao_base')
      .lte('period_end', today)
      .in('debt_id', postFixedIds);

    if (staleError || !staleRefs || staleRefs.length === 0) {
      return { ids: [], latestDataDate: null };
    }

    const ids = Array.from(new Set(staleRefs.map((r) => r.debt_id)));
    const indexTypes = Array.from(new Set(staleRefs.map((r) => r.index_type)));

    let latestDataDate: string | null = null;
    const { data: latestIndex } = await supabase
      .from('economic_indices')
      .select('reference_date')
      .in('index_type', indexTypes)
      .order('reference_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestIndex?.reference_date) latestDataDate = latestIndex.reference_date;

    return { ids, latestDataDate };
  };

  const calculateMissingInstallments = async (
    missingDebtIds: string[],
  ): Promise<{ [debtId: string]: Installment[] }> => {
    const calculatedInstallments: { [debtId: string]: Installment[] } = {};

    await Promise.all(missingDebtIds.map(async (debtId) => {
      const debt = debtMap[debtId];
      if (!debt || !debt.firstDueDate || !debt.dueDate) {
        console.warn('[useDebtInstallments] debt rejeitado por falta de firstDueDate/dueDate:', debt?.id, { firstDueDate: debt?.firstDueDate, dueDate: debt?.dueDate });
        return;
      }

      try {
        if (!selectedCompany?.id) {
          console.warn('[useDebtInstallments] empresa não selecionada');
          return;
        }

        const { data, error: calculationError } = await supabase.functions.invoke('calculate-amortization', {
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
            applyOverridesOnlyToFuture: true,
            persist: !hasTemporaryScenario,
          }
        });

        if (calculationError) {
          throw new Error(await getEdgeFunctionErrorMessage(
            calculationError,
            'Nao foi possivel recalcular as parcelas. Atualize as projecoes e tente novamente.'
          ));
        }

        const responseError = getEdgeFunctionResponseError(
          data,
          'Nao foi possivel recalcular as parcelas. Atualize as projecoes e tente novamente.'
        );

        if (responseError) {
          throw new Error(responseError);
        }

        calculatedInstallments[debtId] = (data?.installments ?? []).map(mapCalculatedInstallment);
      } catch (calculationError) {
        console.error(`Error recalculating installments for debt ${debtId}:`, calculationError);
      }
    }));

    return calculatedInstallments;
  };

  const fetchInstallments = async () => {
    if (debtIds.length === 0) {
      setInstallmentsData({});
      setReconciledSignature(debtsSignature);
      return;
    }

    // Verify session is available directly from client (not React state) to avoid race conditions
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) return;
    
    setIsFetching(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('debt_installments')
        .select('debt_id, installment_number, due_date, principal_amount, interest_amount, total_amount, remaining_balance')
        .in('debt_id', debtIds)
        .order('due_date', { ascending: true });

      if (fetchError) throw fetchError;

      if (hasTemporaryScenario) {
        const recalculatedInstallments = await calculateMissingInstallments(debtIds);
        const hasAnyInstallments = Object.keys(recalculatedInstallments).length > 0;

        if (!hasAnyInstallments) {
          setError('Nao foi possivel simular as parcelas das dividas.');
        }

        setInstallmentsData(recalculatedInstallments);
        return;
      }

      const groupedInstallments = (data ?? []).reduce<{ [debtId: string]: Installment[] }>((acc, row) => {
        if (!acc[row.debt_id]) {
          acc[row.debt_id] = [];
        }

        acc[row.debt_id].push(mapInstallmentRow(row));
        return acc;
      }, {});

      const missingDebtIds = debtIds.filter((debtId) => !groupedInstallments[debtId]?.length);

      // Auto-reprice post-fixed debts whose past periods are still projected.
      const storedDebtIds = debtIds.filter((debtId) => groupedInstallments[debtId]?.length);
      const { ids: staleDebtIds, latestDataDate } = await detectStaleDebtIds(storedDebtIds);

      const recalcDebtIds = Array.from(new Set([...missingDebtIds, ...staleDebtIds]));
      const recalculatedInstallments = recalcDebtIds.length > 0
        ? await calculateMissingInstallments(recalcDebtIds)
        : {};
      const hasAnyInstallments =
        Object.keys(groupedInstallments).length > 0 || Object.keys(recalculatedInstallments).length > 0;

      if (!hasAnyInstallments && missingDebtIds.length > 0) {
        setError('Nao foi possivel carregar ou recalcular as parcelas das dividas.');
      }

      setInstallmentsData({
        ...groupedInstallments,
        ...recalculatedInstallments,
      });

      // Notify the CFO that figures were refreshed (only when stale debts were
      // actually repriced, not for the first-time calculation of new debts).
      const repricedCount = staleDebtIds.filter((id) => recalculatedInstallments[id]?.length).length;
      if (repricedCount > 0) {
        toast({
          title: 'Dívidas reprecificadas',
          description: `${repricedCount} dívida(s) pós-fixada(s) atualizada(s) com os dados do BCB${latestDataDate ? ` de ${formatBRDate(latestDataDate)}` : ''}.`,
        });
      }
    } catch (err) {
      console.error('Error fetching installments:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar parcelas');
    } finally {
      setIsFetching(false);
      setReconciledSignature(debtsSignature);
    }
  };

  useEffect(() => {
    fetchInstallments();
  }, [debtsSignature, selectedCompany?.id, scenarioSignature]);  // Refetch when debt parameters, company, or scenario changes

  // "loading" verdadeiro: buscando OU o conjunto atual de dívidas ainda não foi
  // reconciliado em installmentsData (sem a janela falsa de loading=false).
  const loading = isFetching || reconciledSignature !== debtsSignature;

  return {
    installmentsData,
    loading,
    error,
    refetch: fetchInstallments
  };
};
