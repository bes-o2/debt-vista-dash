import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';

export interface Debt {
  id: string;
  company_id: string;
  created_by: string;
  title?: string;
  description?: string;
  financed_amount: number;
  first_due_date: string;
  last_due_date: string;
  calculation_table: 'SAC' | 'PRICE';
  interest_base: string;
  interest_rate: number;
  interest_type: 'monthly' | 'annual';
  iof_rate?: number;
  additional_fees?: number;
  created_at: string;
  updated_at: string;
}

export interface DebtInput {
  title?: string;
  description?: string;
  financed_amount: number;
  first_due_date: string;
  last_due_date: string;
  calculation_table: 'SAC' | 'PRICE';
  interest_base: string;
  interest_rate: number;
  interest_type: 'monthly' | 'annual';
  iof_rate?: number;
  additional_fees?: number;
}

// Legacy interface for backward compatibility
export interface LegacyDebt {
  id: string;
  financedAmount: number;
  releaseDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  indexer?: string;
  interestRate: number;
  interestType: 'monthly' | 'annual';
  iofAmount?: number;
  tacAmount?: number;
  bank: string;
  contractNumber?: string;
}

export function useDebts() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { user } = useAuth();

  // Fetch debts for the selected company
  const { data: debts = [], isLoading, error } = useQuery({
    queryKey: ['debts', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Debt[];
    },
    enabled: !!selectedCompany?.id,
  });

  // Create debt mutation
  const createDebtMutation = useMutation({
    mutationFn: async (debtData: DebtInput) => {
      if (!selectedCompany?.id) {
        throw new Error('Nenhuma empresa selecionada');
      }

      if (!user?.id) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('debts')
        .insert([{
          ...debtData,
          company_id: selectedCompany.id,
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts', selectedCompany?.id] });
      toast({
        title: "Dívida criada",
        description: "A dívida foi cadastrada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar dívida",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update debt mutation
  const updateDebtMutation = useMutation({
    mutationFn: async ({ id, ...debtData }: DebtInput & { id: string }) => {
      const { data, error } = await supabase
        .from('debts')
        .update(debtData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts', selectedCompany?.id] });
      toast({
        title: "Dívida atualizada",
        description: "As informações da dívida foram atualizadas com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar dívida",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete debt mutation
  const deleteDebtMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('debts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts', selectedCompany?.id] });
      toast({
        title: "Dívida removida",
        description: "A dívida foi removida com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover dívida",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Convert legacy debt format to new format
  const convertLegacyDebt = (legacyDebt: LegacyDebt): DebtInput => {
    return {
      title: legacyDebt.contractNumber || `Contrato ${legacyDebt.bank}`,
      description: `Contrato do ${legacyDebt.bank}`,
      financed_amount: legacyDebt.financedAmount,
      first_due_date: legacyDebt.releaseDate,
      last_due_date: legacyDebt.dueDate,
      calculation_table: legacyDebt.calculationTable,
      interest_base: legacyDebt.indexer || 'Pré-fixado',
      interest_rate: legacyDebt.interestRate,
      interest_type: legacyDebt.interestType,
      iof_rate: legacyDebt.iofAmount || 0,
      additional_fees: legacyDebt.tacAmount || 0,
    };
  };

  // Convert new debt format to legacy format for backward compatibility
  const convertToLegacyFormat = (debt: Debt): LegacyDebt => {
    return {
      id: debt.id,
      financedAmount: debt.financed_amount,
      releaseDate: debt.first_due_date,
      dueDate: debt.last_due_date,
      calculationTable: debt.calculation_table,
      indexer: debt.interest_base,
      interestRate: debt.interest_rate,
      interestType: debt.interest_type,
      iofAmount: debt.iof_rate || 0,
      tacAmount: debt.additional_fees || 0,
      bank: debt.title || 'Banco do Brasil',
      contractNumber: debt.title,
    };
  };

  // Migrate legacy data from localStorage
  const migrateLegacyData = async () => {
    try {
      const legacyData = localStorage.getItem('debts');
      if (!legacyData) return;

      const legacyDebts: LegacyDebt[] = JSON.parse(legacyData);
      
      for (const legacyDebt of legacyDebts) {
        const debtData = convertLegacyDebt(legacyDebt);
        await createDebtMutation.mutateAsync(debtData);
      }

      // Remove from localStorage after successful migration
      localStorage.removeItem('debts');
      
      toast({
        title: "Migração concluída",
        description: `${legacyDebts.length} dívidas foram migradas para o banco de dados.`,
      });
    } catch (error) {
      console.error('Erro na migração:', error);
      toast({
        title: "Erro na migração",
        description: "Houve um erro ao migrar os dados do localStorage.",
        variant: "destructive",
      });
    }
  };

  return {
    debts,
    isLoading,
    error,
    createDebt: createDebtMutation.mutate,
    updateDebt: updateDebtMutation.mutate,
    deleteDebt: deleteDebtMutation.mutate,
    isCreating: createDebtMutation.isPending,
    isUpdating: updateDebtMutation.isPending,
    isDeleting: deleteDebtMutation.isPending,
    convertToLegacyFormat,
    migrateLegacyData,
  };
}