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
  reference_date: string;
  rate: number;
  rate_type: 'daily' | 'monthly' | 'annual';
  source: string;
}

const RATE_MAPPINGS = {
  'SELIC': { code: '11', name: 'SELIC' },
  'CDI': { code: '12', name: 'CDI' },
  'IPCA': { code: '433', name: 'IPCA' }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 BCB Rates Fetch Function called');

    const {
      forceUpdate = false,
      startDate = null,
      endDate = null,
      daysBack = 30
    } = await req.json().catch(() => ({ forceUpdate: false, daysBack: 30 }));

    console.log(`Force update: ${forceUpdate}, Days back: ${daysBack}, Date range: ${startDate} to ${endDate}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let fetchStartDate: Date;
    let fetchEndDate: Date;

    if (startDate && endDate) {
      fetchStartDate = new Date(startDate);
      fetchEndDate = new Date(endDate);
      console.log(`Using custom date range: ${startDate} to ${endDate}`);
    } else {
      const now = new Date();
      fetchEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      fetchStartDate = new Date(fetchEndDate);
      fetchStartDate.setDate(fetchStartDate.getDate() - daysBack);
      console.log(`Using ${daysBack} days back from yesterday`);
    }

    // Check for recent data unless force update is requested (only for default 30-day fetch)
    if (!forceUpdate && daysBack === 30 && !startDate && !endDate) {
      const { data: recentData, error: checkError } = await supabase
        .from('economic_indices')
        .select('reference_date, index_type')
        .gte('reference_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('reference_date', { ascending: false });

      if (checkError) {
        console.error('Error checking recent data:', checkError);
      } else {
        // Check if we have at least one record for each index type
        const hasAllIndices = ['SELIC', 'CDI', 'IPCA'].every(
          idx => recentData?.some(r => r.index_type === idx)
        );

        if (hasAllIndices) {
          console.log('Recent data found for all indices, skipping BCB fetch');

          const latestRates = await getLatestRatesByIndex(supabase);

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Using recent data from database',
              rates: latestRates,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const formatDateForBCB = (date: Date): string => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const startDateStr = formatDateForBCB(fetchStartDate);
    const endDateStr = formatDateForBCB(fetchEndDate);

    console.log(`Date range: ${startDateStr} to ${endDateStr}`);

    const results: { [key: string]: number } = {};
    const errors: string[] = [];
    const allIndices: EconomicIndex[] = [];

    for (const [rateType, config] of Object.entries(RATE_MAPPINGS)) {
      try {
        console.log(`Fetching ${rateType} from BCB (${startDateStr} to ${endDateStr})...`);

        const bcbUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${config.code}/dados?formato=json&dataInicial=${startDateStr}&dataFinal=${endDateStr}`;

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

        const rateTypeValue = (config.name === 'CDI' || config.name === 'SELIC') ? 'daily' : 'monthly';

        const indices: EconomicIndex[] = bcbData
          .filter((item: BCBRate) => {
            const value = parseFloat(item.valor);
            return item.valor && !isNaN(value) && isFinite(value);
          })
          .map((item: BCBRate) => {
            const [day, month, year] = item.data.split('/');
            const referenceDate = `${year}-${month}-${day}`;

            return {
              index_type: config.name,
              reference_date: referenceDate,
              rate: parseFloat(item.valor),
              rate_type: rateTypeValue,
              source: 'BCB'
            };
          });

        console.log(`Processed ${indices.length} ${config.name} records. Rate type: ${rateTypeValue}`);

        allIndices.push(...indices);

        if (indices.length > 0) {
          const latestRate = indices[indices.length - 1];
          results[config.name] = latestRate.rate;
        }

        console.log(`✅ Successfully fetched and validated ${indices.length} records for ${rateType}`);
      } catch (error) {
        console.error(`Error fetching ${rateType}:`, error);
        errors.push(`${rateType}: ${error.message}`);
      }
    }

    // Upsert data in batches
    if (allIndices.length > 0) {
      console.log(`Upserting ${allIndices.length} records to database...`);

      const BATCH_SIZE = 1000;
      for (let i = 0; i < allIndices.length; i += BATCH_SIZE) {
        const batch = allIndices.slice(i, i + BATCH_SIZE);

        const { error: upsertError } = await supabase
          .from('economic_indices')
          .upsert(batch, {
            onConflict: 'index_type,reference_date',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error(`Error upserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, upsertError);
          errors.push(`Database upsert batch ${Math.floor(i / BATCH_SIZE) + 1}: ${upsertError.message}`);
        } else {
          console.log(`✅ Successfully upserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} records)`);
        }
      }
    }

    const latestRates = await getLatestRatesByIndex(supabase);

    const response = {
      success: true,
      message: `Successfully processed rates. Updated: ${Object.keys(results).join(', ') || 'none'}`,
      updatedRates: results,
      currentRates: latestRates,
      recordsProcessed: allIndices.length,
      errors: errors.length > 0 ? errors : null,
      dateRange: { start: fetchStartDate.toISOString().split('T')[0], end: fetchEndDate.toISOString().split('T')[0] },
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

async function getLatestRatesByIndex(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ [key: string]: { value: number; date: string } }> {
  const { data: currentRates, error } = await supabase
    .from('economic_indices')
    .select('index_type, rate, reference_date')
    .in('index_type', ['SELIC', 'CDI', 'IPCA'])
    .order('reference_date', { ascending: false });

  if (error) {
    console.error('Error fetching latest rates:', error);
    return {};
  }

  const latestRates: { [key: string]: { value: number; date: string } } = {};

  if (currentRates) {
    for (const rate of currentRates) {
      if (!latestRates[rate.index_type]) {
        latestRates[rate.index_type] = {
          value: parseFloat(rate.rate),
          date: rate.reference_date
        };
      }
    }
  }

  return latestRates;
}
