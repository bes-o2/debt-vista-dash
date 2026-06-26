import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface EconomicIndex {
  id: string;
  index_type: 'CDI' | 'SELIC' | 'IPCA' | 'IGPM';
  date: string;
  value: number;
  created_at: string;
  updated_at: string;
}

export interface IndexProjection {
  id: string;
  index_type: 'CDI' | 'SELIC' | 'IPCA' | 'IGPM';
  projected_rate: number;
  projection_date: string;
  horizon_months: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LatestRateEntry {
  value: number;
  date: string;
  // 'daily' (CDI/SELIC), 'monthly' (IPCA/IGPM) or 'annual' — needed to convert
  // the stored value to an effective annual rate for display.
  rate_type?: string;
}

export interface LatestRates {
  CDI?: LatestRateEntry;
  SELIC?: LatestRateEntry;
  IPCA?: LatestRateEntry;
  IGPM?: LatestRateEntry;
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
        .in('index_type', ['CDI', 'SELIC', 'IPCA', 'IGPM'])
        .order('reference_date', { ascending: false });

      if (error) throw error;

      // Group by index_type and get the latest value for each
      const grouped = data.reduce((acc, item) => {
        if (!acc[item.index_type] || item.reference_date > acc[item.index_type].date) {
          acc[item.index_type] = { value: item.rate, date: item.reference_date, rate_type: item.rate_type };
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
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  // Mutation to create/update projections
  const saveProjectionMutation = useMutation({
    mutationFn: async (projection: Omit<IndexProjection, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('index_projections')
        .upsert({
          ...projection,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['index-projections'] });
      toast({
        title: 'Projeção salva',
        description: 'A projeção foi salva com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar projeção',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation to fetch historical data
  const fetchHistoricalDataMutation = useMutation({
    mutationFn: async ({ startDate, endDate, daysBack }: { startDate?: string; endDate?: string; daysBack?: number }) => {
      const { data, error } = await supabase.functions.invoke('fetch-bcb-rates', {
        body: { 
          forceUpdate: true,
          startDate,
          endDate,
          daysBack: daysBack || 365, // Default to 1 year
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['economic-indices'] });
      toast({
        title: 'Dados históricos atualizados',
        description: 'Os dados históricos foram importados com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao buscar dados históricos',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const saveProjection = (projection: Omit<IndexProjection, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    saveProjectionMutation.mutate(projection);
  };

  const fetchHistoricalData = (params: { startDate?: string; endDate?: string; daysBack?: number }) => {
    fetchHistoricalDataMutation.mutate(params);
  };

  return {
    latestRates,
    projections,
    isLoading: isLoadingRatesValue,
    isLoadingProjections,
    error: ratesError,
    saveProjection,
    isSavingProjection: saveProjectionMutation.isPending,
    fetchHistoricalData,
    isFetchingHistorical: fetchHistoricalDataMutation.isPending,
  };
}
