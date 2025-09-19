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

  // Projections temporarily disabled - will be re-enabled for system-wide projections
  // const { data: projections = [], isLoading: isLoadingProjections } = useQuery({
  //   queryKey: ['index-projections'],
  //   queryFn: async () => {
  //     const { data, error } = await supabase
  //       .from('index_projections')
  //       .select('*')
  //       .order('projection_date', { ascending: false });

  //     if (error) throw error;
  //     return data as IndexProjection[];
  //   },
  // });

  // Mutation to update rates from BCB - removed for automatic system
  // const updateRatesMutation = useMutation({...});

  // const updateRates = async (forceUpdate: boolean = false) => {
  //   setIsUpdating(true);
  //   updateRatesMutation.mutate(forceUpdate);
  // };

  // Temporarily disabled projection functionality
  // const saveProjection = (projection: Omit<IndexProjection, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
  //   saveProjectionMutation.mutate(projection);
  // };

  return {
    latestRates,
    isLoading: isLoadingRatesValue,
    error: ratesError,
    // Temporarily disabled - manual updates removed in favor of automatic system
    // isUpdating: isUpdating || updateRatesMutation.isPending,
    // updateRates,
  };
}