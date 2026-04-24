import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

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

const mapGuaranteeRow = (row: DebtGuaranteeRow): DebtGuarantee => ({
  ...row,
  type: row.type as GuaranteeType,
  description: row.description ?? undefined,
});

export function useDebtGuarantees(debtId?: string) {
  const queryClient = useQueryClient();

  const { data: guarantees = [], isLoading } = useQuery({
    queryKey: ['debt_guarantees', debtId],
    queryFn: async () => {
      if (!debtId) return [];

      const { data, error } = await supabase
        .from('debt_guarantees')
        .select('*')
        .eq('debt_id', debtId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data.map(mapGuaranteeRow);
    },
    enabled: !!debtId,
  });

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
        .eq('debt_id', targetDebtId);

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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['debt_guarantees', variables.debtId] });
    },
  });

  return {
    guarantees,
    isLoading,
    saveGuarantees: saveGuaranteesMutation.mutateAsync,
    isSaving: saveGuaranteesMutation.isPending,
  };
}
