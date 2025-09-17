import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BCBRate {
  data: string;
  valor: string;
}

interface EconomicIndex {
  index_type: string;
  date: string;
  value: number;
}

const RATE_MAPPINGS = {
  'SELIC': { code: '11', name: 'SELIC' },
  'CDI': { code: '12', name: 'CDI' }, 
  'IPCA': { code: '433', name: 'IPCA' }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting BCB rates fetch...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { forceUpdate = false } = await req.json().catch(() => ({}));
    
    const results: { [key: string]: number } = {};
    const errors: string[] = [];

    // Calculate date range (last 30 days for historical data)
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);
    
    const formatDate = (date: Date): string => {
      return date.toISOString().split('T')[0].replace(/-/g, '/');
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    for (const [rateType, config] of Object.entries(RATE_MAPPINGS)) {
      try {
        console.log(`Fetching ${rateType} rates...`);
        
        // Check if we need to update (only if forceUpdate or no recent data)
        if (!forceUpdate) {
          const { data: recentData } = await supabase
            .from('economic_indices')
            .select('date')
            .eq('index_type', rateType)
            .gte('date', startDate.toISOString().split('T')[0])
            .order('date', { ascending: false })
            .limit(1);
            
          if (recentData && recentData.length > 0) {
            console.log(`Recent ${rateType} data found, skipping...`);
            continue;
          }
        }

        // Fetch from BCB API
        const bcbUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${config.code}/dados?formato=json&dataInicial=${startDateStr}&dataFinal=${endDateStr}`;
        
        console.log(`Fetching from: ${bcbUrl}`);
        
        const response = await fetch(bcbUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'DebtAnalysisApp/1.0'
          }
        });

        if (!response.ok) {
          throw new Error(`BCB API error for ${rateType}: ${response.status} ${response.statusText}`);
        }

        const bcbData: BCBRate[] = await response.json();
        console.log(`Received ${bcbData.length} records for ${rateType}`);

        if (!bcbData || bcbData.length === 0) {
          console.log(`No data received for ${rateType}`);
          continue;
        }

        // Transform and prepare data for insertion
        const indices: EconomicIndex[] = bcbData.map(item => ({
          index_type: rateType,
          date: item.data.split('/').reverse().join('-'), // Convert DD/MM/YYYY to YYYY-MM-DD
          value: parseFloat(item.valor)
        })).filter(item => !isNaN(item.value));

        console.log(`Prepared ${indices.length} valid records for ${rateType}`);

        if (indices.length === 0) {
          console.log(`No valid records for ${rateType}`);
          continue;
        }

        // Insert data with upsert (ON CONFLICT DO UPDATE)
        const { error: insertError } = await supabase
          .from('economic_indices')
          .upsert(indices, { 
            onConflict: 'index_type,date',
            ignoreDuplicates: false 
          });

        if (insertError) {
          console.error(`Error inserting ${rateType} data:`, insertError);
          errors.push(`Failed to save ${rateType}: ${insertError.message}`);
        } else {
          // Get the latest rate for this index
          const latestRate = indices.reduce((latest, current) => 
            current.date > latest.date ? current : latest
          );
          
          results[rateType] = latestRate.value;
          console.log(`Successfully saved ${indices.length} records for ${rateType}. Latest: ${latestRate.value}%`);
        }

      } catch (error) {
        console.error(`Error processing ${rateType}:`, error);
        errors.push(`Failed to fetch ${rateType}: ${error.message}`);
      }
    }

    // Get current rates from database
    const { data: currentRates } = await supabase
      .from('economic_indices')
      .select('index_type, value, date')
      .in('index_type', ['SELIC', 'CDI', 'IPCA'])
      .order('date', { ascending: false });

    const latestRates: { [key: string]: { value: number; date: string } } = {};
    
    if (currentRates) {
      for (const rate of currentRates) {
        if (!latestRates[rate.index_type]) {
          latestRates[rate.index_type] = {
            value: parseFloat(rate.value),
            date: rate.date
          };
        }
      }
    }

    const response = {
      success: true,
      message: `Successfully processed rates. Updated: ${Object.keys(results).join(', ')}`,
      updatedRates: results,
      currentRates: latestRates,
      errors: errors.length > 0 ? errors : null,
      timestamp: new Date().toISOString()
    };

    console.log('BCB rates fetch completed:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-bcb-rates function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});