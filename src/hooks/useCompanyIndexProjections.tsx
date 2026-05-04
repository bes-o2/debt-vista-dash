import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useCompany } from '@/hooks/useCompany';

export interface CompanyIndexProjection {
  id: string;
  company_id: string;
  index_type: string;
  projected_rate: number;
  rate_type: string;
  reference_date: string;
  source_reference_date: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface LatestBCBRate {
  index_type: string;
  rate: number;
  reference_date: string;
  rate_type: string;
}

export function useCompanyIndexProjections() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const companyId = selectedCompany?.id;

  // Fetch latest BCB rates
  const { data: latestBCBRates = [], isLoading: isLoadingBCB } = useQuery({
    queryKey: ['economic-indices', 'latest-detailed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('economic_indices')
        .select('index_type, rate, reference_date, rate_type')
        .in('index_type', ['CDI', 'SELIC', 'IPCA'])
        .order('reference_date', { ascending: false });

      if (error) throw error;

      // Get latest per index type
      const latestMap = new Map<string, LatestBCBRate>();
      for (const row of (data ?? [])) {
        if (!latestMap.has(row.index_type)) {
          latestMap.set(row.index_type, {
            index_type: row.index_type,
            rate: row.rate,
            reference_date: row.reference_date,
            rate_type: row.rate_type || 'daily',
          });
        }
      }

      return Array.from(latestMap.values());
    },
    staleTime: 1000 * 60 * 10,
  });

  // Fetch company projections
  const { data: companyProjections = [], isLoading: isLoadingProjections } = useQuery({
    queryKey: ['company-index-projections', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_index_projections')
        .select('*')
        .eq('company_id', companyId)
        .order('index_type', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CompanyIndexProjection[];
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });

  // Sync projections from latest BCB rates
  const syncProjectionsMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Empresa não selecionada');
      if (latestBCBRates.length === 0) throw new Error('Dados do BCB não disponíveis');

      setIsSyncing(true);

      try {
        for (const rate of latestBCBRates) {
          let projectedRate = rate.rate;
          let rateType = rate.rate_type;

          // Convert daily rates to effective monthly for consistency
          if (rate.rate_type === 'daily') {
            projectedRate = (Math.pow(1 + rate.rate / 100, 21) - 1) * 100;
            rateType = 'monthly';
          } else if (rate.rate_type === 'annual') {
            projectedRate = (Math.pow(1 + rate.rate / 100, 1 / 12) - 1) * 100;
            rateType = 'monthly';
          }

          const { error } = await supabase
            .from('company_index_projections')
            .upsert({
              company_id: companyId,
              index_type: rate.index_type,
              projected_rate: projectedRate,
              rate_type: rateType,
              reference_date: new Date().toISOString().split('T')[0],
              source_reference_date: rate.reference_date,
              source: 'BCB',
            }, {
              onConflict: 'company_id,index_type'
            });

          if (error) throw error;
        }
      } finally {
        setIsSyncing(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-index-projections', companyId] });
      toast({
        title: 'Projeção base atualizada',
        description: 'As projeções base foram sincronizadas com os últimos dados do BCB.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao sincronizar projeções',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const syncProjections = useCallback(() => {
    syncProjectionsMutation.mutate();
  }, [syncProjectionsMutation]);

  const projectionsMap = new Map(companyProjections.map(p => [p.index_type, p]));

  return {
    latestBCBRates,
    companyProjections,
    projectionsMap,
    isLoading: isLoadingBCB || isLoadingProjections,
    isSyncing: isSyncing || syncProjectionsMutation.isPending,
    syncProjections,
  };
}
