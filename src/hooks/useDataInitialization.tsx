import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useDataInitialization() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const checkInitialization = async () => {
    try {
      // Check if we have recent economic data
      const { data: recentData, error } = await supabase
        .from('economic_indices')
        .select('reference_date')
        .order('reference_date', { ascending: false })
        .limit(1);

      if (error) throw error;

      // Check if we have data from the last 7 days
      if (recentData && recentData.length > 0) {
        const lastDate = new Date(recentData[0].reference_date);
        const daysSinceUpdate = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        
        setIsInitialized(daysSinceUpdate < 7);
      } else {
        setIsInitialized(false);
      }
    } catch (error) {
      console.error('Error checking initialization:', error);
      setIsInitialized(false);
    }
  };

  const initializeHistoricalData = async () => {
    setIsInitializing(true);
    try {
      // Fetch 2 years of historical data
      const { data, error } = await supabase.functions.invoke('fetch-bcb-rates', {
        body: {
          forceUpdate: true,
          daysBack: 730, // 2 years
        },
      });

      if (error) throw error;

      toast({
        title: 'Dados históricos carregados',
        description: 'Os últimos 2 anos de dados econômicos foram importados com sucesso.',
      });

      setIsInitialized(true);
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados históricos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const initializeProjections = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if we already have projections
      const { data: existingProjections } = await supabase
        .from('index_projections')
        .select('id')
        .eq('created_by', user.id)
        .limit(1);

      if (existingProjections && existingProjections.length > 0) {
        return; // Already have projections
      }

      // Create initial projections for 12 months
      const projections = [
        {
          index_type: 'CDI',
          projected_rate: 10.50,
          annual_projection: 10.50,
          monthly_projection: 10.50 / 12,
          projection_date: new Date().toISOString().split('T')[0],
          horizon_months: 12,
          created_by: user.id,
        },
        {
          index_type: 'SELIC',
          projected_rate: 10.75,
          annual_projection: 10.75,
          monthly_projection: 10.75 / 12,
          projection_date: new Date().toISOString().split('T')[0],
          horizon_months: 12,
          created_by: user.id,
        },
        {
          index_type: 'IPCA',
          projected_rate: 4.50,
          annual_projection: 4.50,
          monthly_projection: 4.50 / 12,
          projection_date: new Date().toISOString().split('T')[0],
          horizon_months: 12,
          created_by: user.id,
        },
      ];

      const { error } = await supabase
        .from('index_projections')
        .insert(projections);

      if (error) throw error;

      toast({
        title: 'Projeções inicializadas',
        description: 'Projeções iniciais criadas para CDI, SELIC e IPCA.',
      });
    } catch (error) {
      console.error('Error initializing projections:', error);
    }
  };

  useEffect(() => {
    checkInitialization();
  }, []);

  return {
    isInitializing,
    isInitialized,
    initializeHistoricalData,
    initializeProjections,
  };
}