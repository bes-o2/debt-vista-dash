/**
 * Get effective monthly rate for a post-fixed debt on a specific date
 * Fetches historical rates or projections based on the target date
 * 
 * @param supabaseClient - Supabase client instance
 * @param indexer - Indexer name (CDI, IPCA, SELIC, etc.)
 * @param targetDate - Date for which to get the rate (YYYY-MM-DD)
 * @param spreadRate - Spread rate in % per year
 * @returns Effective monthly rate in % (e.g., 1.5 for 1.5% per month)
 */
export async function getEffectiveRateForDate(
  supabaseClient: any,
  indexer: string,
  targetDate: string,
  spreadRate: number
): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  
  // Map indexer name to standardized format
  const mappedIndexer = mapIndexerName(indexer);
  if (!mappedIndexer) {
    console.warn(`Unknown indexer: ${indexer}, returning 0`);
    return 0;
  }
  
  let indexerMonthlyRate = 0;
  
  try {
    if (targetDate <= today) {
      // Fetch historical rate
      console.log(`Fetching historical ${mappedIndexer} rate for ${targetDate}`);
      
      const { data, error } = await supabaseClient
        .from('economic_indices')
        .select('rate, rate_type')
        .eq('index_type', mappedIndexer)
        .lte('reference_date', targetDate)
        .order('reference_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error(`Error fetching historical rate: ${error.message}`);
      }
      
      if (data) {
        // Convert to monthly based on rate type
        if (data.rate_type === 'daily') {
          // CDI/SELIC: Daily rate to monthly
          // Formula: (1 + daily_rate/100)^21 - 1
          // Assuming ~21 business days per month
          indexerMonthlyRate = (Math.pow(1 + data.rate / 100, 21) - 1) * 100;
          console.log(`Converted daily rate ${data.rate.toFixed(4)}% to monthly ${indexerMonthlyRate.toFixed(4)}%`);
        } else if (data.rate_type === 'monthly') {
          // IPCA: Already monthly
          indexerMonthlyRate = data.rate;
          console.log(`Using monthly rate ${indexerMonthlyRate.toFixed(4)}%`);
        } else {
          // Annual: Convert to monthly
          indexerMonthlyRate = (Math.pow(1 + data.rate / 100, 1 / 12) - 1) * 100;
          console.log(`Converted annual rate ${data.rate.toFixed(4)}% to monthly ${indexerMonthlyRate.toFixed(4)}%`);
        }
      } else {
        console.warn(`No historical ${mappedIndexer} data found for ${targetDate}, using fallback`);
        // Fallback: use latest available rate
        const { data: latestData } = await supabaseClient
          .from('economic_indices')
          .select('rate, rate_type')
          .eq('index_type', mappedIndexer)
          .order('reference_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (latestData) {
          if (latestData.rate_type === 'daily') {
            indexerMonthlyRate = (Math.pow(1 + latestData.rate / 100, 21) - 1) * 100;
          } else if (latestData.rate_type === 'monthly') {
            indexerMonthlyRate = latestData.rate;
          } else {
            indexerMonthlyRate = (Math.pow(1 + latestData.rate / 100, 1 / 12) - 1) * 100;
          }
          console.log(`Using latest fallback rate: ${indexerMonthlyRate.toFixed(4)}%`);
        }
      }
    } else {
      // Fetch projected rate for future date
      console.log(`Fetching projected ${mappedIndexer} rate for ${targetDate}`);
      
      const { data, error } = await supabaseClient
        .from('index_projections')
        .select('monthly_projection')
        .eq('index_type', mappedIndexer)
        .lte('projection_date', targetDate)
        .order('projection_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error(`Error fetching projection: ${error.message}`);
      }
      
      if (data && data.monthly_projection !== null) {
        indexerMonthlyRate = data.monthly_projection;
        console.log(`Using projected rate: ${indexerMonthlyRate.toFixed(4)}%`);
      } else {
        console.warn(`No projection found for ${mappedIndexer} on ${targetDate}, using latest historical rate`);
        // Fallback: use latest historical rate
        const { data: latestData } = await supabaseClient
          .from('economic_indices')
          .select('rate, rate_type')
          .eq('index_type', mappedIndexer)
          .order('reference_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (latestData) {
          if (latestData.rate_type === 'daily') {
            indexerMonthlyRate = (Math.pow(1 + latestData.rate / 100, 21) - 1) * 100;
          } else if (latestData.rate_type === 'monthly') {
            indexerMonthlyRate = latestData.rate;
          } else {
            indexerMonthlyRate = (Math.pow(1 + latestData.rate / 100, 1 / 12) - 1) * 100;
          }
          console.log(`Using latest historical rate as fallback: ${indexerMonthlyRate.toFixed(4)}%`);
        }
      }
    }
  } catch (error) {
    console.error(`Error in getEffectiveRateForDate: ${error}`);
  }
  
  // Convert spread from annual to monthly
  // Formula: (1 + annual_spread/100)^(1/12) - 1
  const spreadMonthly = (Math.pow(1 + spreadRate / 100, 1 / 12) - 1) * 100;
  
  // Return effective monthly rate (indexer + spread)
  const effectiveRate = indexerMonthlyRate + spreadMonthly;
  
  console.log(`Effective rate for ${targetDate}: ${mappedIndexer} ${indexerMonthlyRate.toFixed(4)}% + spread ${spreadMonthly.toFixed(4)}% = ${effectiveRate.toFixed(4)}%`);
  
  return effectiveRate;
}

/**
 * Map indexer name to standardized database format
 */
function mapIndexerName(indexer?: string): string | null {
  if (!indexer) return null;
  
  const normalized = indexer.toUpperCase().trim();
  
  if (normalized.includes('CDI') || normalized.includes('DI')) return 'CDI';
  if (normalized.includes('IPCA')) return 'IPCA';
  if (normalized.includes('SELIC')) return 'SELIC';
  
  return null;
}
