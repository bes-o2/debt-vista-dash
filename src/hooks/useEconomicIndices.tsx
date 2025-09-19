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
  projected_rate: number;
  projection_date: string;
  horizon_months: number;
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

  // Fetch latest rates for each index
  const { data: latestRatesData, isLoading: isLoadingRates, error: ratesError } = useQuery({
    queryKey: ['economic-indices', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('economic_indices')
        .select('*')
        .order('reference_date', { ascending: false })
        .limit(3);

      if (error) throw error;

      // Group by index_type and get the latest value for each
      const grouped = data.reduce((acc, item) => {
        if (!acc[item.index_type] || item.reference_date > acc[item.index_type].date) {
          acc[item.index_type] = { value: item.rate, date: item.reference_date };
        }
        return acc;
      }, {} as LatestRates);

      return grouped;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const latestRates = latestRatesData || {};
  const isLoadingRatesValue = isLoadingRates;

  // Fetch projections
  const { data: projections = [], isLoading: isLoadingProjections } = useQuery({
    queryKey: ['index-projections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('index_projections')
        .select('*')
        .order('projection_date', { ascending: false });

      if (error) throw error;
      return data as IndexProjection[];
    },
  });

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

  // Mutation to save projections
  const saveProjectionMutation = useMutation({
    mutationFn: async (projection: Omit<IndexProjection, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
      const user = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('index_projections')
        .insert([{
          index_type: projection.index_type,
          projected_rate: projection.projected_rate,
          projection_date: projection.projection_date,
          horizon_months: projection.horizon_months,
          created_by: user.data.user?.id || ''
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['index-projections'] });
      toast({
        title: "Projeção salva",
        description: "A projeção foi salva com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar projeção",
        description: error.message,
        variant: "destructive",
      });
    }
  });

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
    isLoading: isLoadingRatesValue || isLoadingProjections,
    isUpdating: isUpdating || updateRatesMutation.isPending,
    error: ratesError,
    updateRates,
    saveProjection,
    isSavingProjection: saveProjectionMutation.isPending,
  };
}