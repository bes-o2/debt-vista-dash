import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { useCompany } from '@/hooks/useCompany';
import {
  calculateGuaranteeMetrics,
  type GuaranteeMetricDebt,
  type GuaranteeMetricRow,
  type GuaranteeMetrics,
} from '@/lib/guaranteeMetrics';

export type GuaranteeType =
  | 'imovel'
  | 'veiculo'
  | 'equipamento'
  | 'fianca'
  | 'aval'
  | 'recebiveis'
  | 'outros';

export const GUARANTEE_TYPE_LABELS: Record<GuaranteeType, string> = {
  imovel: 'Imóvel',
  veiculo: 'Veículo',
  equipamento: 'Equipamento',
  fianca: 'Fiança',
  aval: 'Aval',
  recebiveis: 'Recebíveis',
  outros: 'Outros',
};

type DebtGuaranteeRow = Tables<'debt_guarantees'>;
type DebtGuaranteeInsertRow = TablesInsert<'debt_guarantees'>;
type DebtRowForMetrics = Pick<Tables<'debts'>, 'id' | 'bank' | 'financed_amount'>;

export interface DebtGuarantee {
  id: string;
  debt_id: string;
  company_id: string;
  type: GuaranteeType;
  value: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface DebtGuaranteeInput {
  type: GuaranteeType;
  value: number;
  description?: string;
}

export interface UseDebtGuaranteesOptions {
  debtId?: string;
  companyId?: string;
  debtIds?: string[];
  debts?: GuaranteeMetricDebt[];
  includeMetrics?: boolean;
}

const mapGuaranteeRow = (row: DebtGuaranteeRow): DebtGuarantee => ({
  ...row,
  type: row.type as GuaranteeType,
  description: row.description ?? undefined,
});

const normalizeDebtIds = (debtIds?: string[]) =>
  [...new Set((debtIds ?? []).filter((debtId): debtId is string => Boolean(debtId)))].sort();

const mapDebtRowForMetrics = (row: DebtRowForMetrics): GuaranteeMetricDebt => ({
  id: row.id,
  bank: row.bank,
  financedAmount: row.financed_amount,
});

const normalizeGuaranteeRowForMetrics = (row: DebtGuarantee): GuaranteeMetricRow => ({
  debt_id: row.debt_id,
  value: row.value,
});

export function useDebtGuarantees(debtOrOptions?: string | UseDebtGuaranteesOptions) {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  const isSingleDebtScope = typeof debtOrOptions === 'string';
  const options = typeof debtOrOptions === 'object' && debtOrOptions !== null ? debtOrOptions : undefined;
  const debtId = isSingleDebtScope ? debtOrOptions : options?.debtId;
  const companyId = options ? options.companyId ?? selectedCompany?.id : undefined;
  const debtIds = normalizeDebtIds(options?.debtIds);
  const debtIdsKey = debtIds.join('|');
  const shouldLoadMetrics = !!options && (options.includeMetrics !== false || !!options.debts);
  const scopeKey = debtId
    ? `debt:${debtId}`
    : `company:${companyId ?? 'none'}:debtIds:${debtIdsKey || 'none'}`;

  const guaranteesQuery = useQuery({
    queryKey: ['debt_guarantees', scopeKey],
    queryFn: async () => {
      if (!debtId && !companyId && debtIds.length === 0) return [];

      let query = supabase
        .from('debt_guarantees')
        .select('*')
        .order('created_at', { ascending: true });

      if (debtId) {
        query = query.eq('debt_id', debtId);
      } else {
        if (companyId) {
          query = query.eq('company_id', companyId);
        }

        if (debtIds.length > 0) {
          query = query.in('debt_id', debtIds);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []).map(mapGuaranteeRow);
    },
    enabled: !!debtId || !!companyId || debtIds.length > 0,
  });

  const metricsDebtQuery = useQuery({
    queryKey: ['debt_guarantees_metrics_debts', scopeKey],
    queryFn: async () => {
      if (!shouldLoadMetrics || options?.debts) return [];
      if (!debtId && !companyId && debtIds.length === 0) return [];

      let query = supabase
        .from('debts')
        .select('id, bank, financed_amount')
        .order('created_at', { ascending: false });

      if (debtId) {
        query = query.eq('id', debtId);
      } else {
        if (companyId) {
          query = query.eq('company_id', companyId);
        }

        if (debtIds.length > 0) {
          query = query.in('id', debtIds);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []).map(mapDebtRowForMetrics);
    },
    enabled: shouldLoadMetrics && !options?.debts && (!!debtId || !!companyId || debtIds.length > 0),
  });

  const metricDebts = options?.debts ?? metricsDebtQuery.data ?? [];
  const guaranteeMetrics = shouldLoadMetrics
    ? calculateGuaranteeMetrics({
        debts: metricDebts,
        guarantees: (guaranteesQuery.data ?? []).map(normalizeGuaranteeRowForMetrics),
      })
    : undefined;

  const guarantees = guaranteesQuery.data ?? [];
  const isLoading = guaranteesQuery.isLoading;
  const isLoadingMetrics = metricsDebtQuery.isLoading;
  const error = guaranteesQuery.error ?? metricsDebtQuery.error;

  const saveGuaranteesMutation = useMutation({
    mutationFn: async ({
      debtId: targetDebtId,
      companyId,
      guarantees: nextGuarantees,
    }: {
      debtId: string;
      companyId: string;
      guarantees: DebtGuaranteeInput[];
    }) => {
      const { error: deleteError } = await supabase
        .from('debt_guarantees')
        .delete()
        .eq('debt_id', targetDebtId)
        .eq('company_id', companyId);

      if (deleteError) throw deleteError;

      if (nextGuarantees.length === 0) return;

      const payload: DebtGuaranteeInsertRow[] = nextGuarantees.map((guarantee) => ({
        debt_id: targetDebtId,
        company_id: companyId,
        type: guarantee.type,
        value: guarantee.value,
        description: guarantee.description?.trim() || null,
      }));

      const { error: insertError } = await supabase
        .from('debt_guarantees')
        .insert(payload);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt_guarantees'] });
    },
  });

  return {
    guarantees,
    isLoading,
    isLoadingMetrics,
    error,
    guaranteeMetrics,
    saveGuarantees: saveGuaranteesMutation.mutateAsync,
    isSaving: saveGuaranteesMutation.isPending,
  };
}
