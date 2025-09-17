import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface EconomicIndex {
  id: string;
  index_type: 'CDI' | 'SELIC' | 'IPCA';
  date: string;
  value: number;
  created_at: string;
  updated_at: string;
}

export interface IndexProjection {
  id: string;
  index_type: 'CDI' | 'SELIC' | 'IPCA';
  year: number;
  projected_value: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LatestRates {
  CDI?: { value: number; date: string };
  SELIC?: { value: number; date: string };
  IPCA?: { value: number; date: string };
}

export function useEconomicIndices() {
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  // Fetch latest rates for each index - temporarily disabled until migration is confirmed
  const today = new Date();
  const lastBusinessDay = new Date(today);
  // If today is weekend, go back to last Friday
  if (today.getDay() === 0) lastBusinessDay.setDate(today.getDate() - 2); // Sunday -> Friday
  if (today.getDay() === 6) lastBusinessDay.setDate(today.getDate() - 1); // Saturday -> Friday
  
  const latestRates: LatestRates = {
    CDI: { value: 10.65, date: lastBusinessDay.toISOString().split('T')[0] },
    SELIC: { value: 12.25, date: lastBusinessDay.toISOString().split('T')[0] },
    IPCA: { value: 4.87, date: new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0] } // IPCA is monthly, so last month
  };
  const isLoadingRates = false;
  const ratesError = null;

  // Fetch projections - temporarily disabled until migration is confirmed
  const projections: IndexProjection[] = [];
  const isLoadingProjections = false;

  // Mutation to update rates from BCB
  const updateRatesMutation = useMutation({
    mutationFn: async (forceUpdate: boolean = false) => {
      const response = await supabase.functions.invoke('fetch-bcb-rates', {
        body: { forceUpdate }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch rates');
      }

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['economic-indices'] });
      
      const updatedCount = Object.keys(data.updatedRates || {}).length;
      const errorCount = data.errors?.length || 0;
      
      if (updatedCount > 0) {
        toast({
          title: "Taxas atualizadas",
          description: `${updatedCount} taxas foram atualizadas com sucesso.`,
        });
      } else if (errorCount === 0) {
        toast({
          title: "Taxas já atualizadas", 
          description: "As taxas já estão atualizadas.",
        });
      }

      if (errorCount > 0) {
        toast({
          title: "Alguns erros ocorreram",
          description: `${errorCount} erros durante a atualização.`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar taxas",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUpdating(false);
    }
  });

  // Mutation to save projections - temporarily disabled until migration is confirmed
  const saveProjectionMutation = {
    isPending: false,
    mutate: (projection: any) => {
      toast({
        title: "Aguardando migração",
        description: "Execute a migração do banco de dados primeiro.",
        variant: "destructive",
      });
    }
  };

  const updateRates = async (forceUpdate: boolean = false) => {
    setIsUpdating(true);
    updateRatesMutation.mutate(forceUpdate);
  };

  const saveProjection = (projection: Omit<IndexProjection, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    saveProjectionMutation.mutate(projection);
  };

  return {
    latestRates,
    projections,
    isLoading: isLoadingRates || isLoadingProjections,
    isUpdating: isUpdating || updateRatesMutation.isPending,
    error: ratesError,
    updateRates,
    saveProjection,
    isSavingProjection: saveProjectionMutation.isPending,
  };
}