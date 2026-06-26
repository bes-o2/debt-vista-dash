/**
 * Resolve indexer rate for a specific period, considering historical BCB data,
 * company base projections, and temporary scenario overrides.
 */

export interface RateResolution {
  effectiveMonthlyRate: number;
  indexerRate: number;
  spreadRate: number;
  source: "bcb_realizado" | "projecao_base" | "cenario_temporario";
  rateType: "daily_accumulated" | "monthly" | "projected";
  sourceReferenceDate: string | null;
}

export interface TemporaryOverride {
  indexType: string;
  adjustmentPp?: number; // adjustment in percentage points
  adjustmentBp?: number; // legacy name; kept as a temporary fallback
}

function mapIndexerName(indexer?: string): string | null {
  if (!indexer) return null;
  const normalized = indexer.toUpperCase().trim();
  if (normalized.includes('IPCA')) return 'IPCA';
  if (normalized.includes('IGP')) return 'IGPM';
  if (normalized.includes('SELIC')) return 'SELIC';
  if (normalized.includes('CDI') || normalized.includes('DI')) return 'CDI';
  return null;
}

// Indexers published as a monthly variation (resolved via getMonthlyRate),
// as opposed to CDI/SELIC which are accumulated from daily series.
const MONTHLY_INDEXERS = ['IPCA', 'IGPM'];

/**
 * Resolve the effective rate for a given period.
 */
export async function resolveIndexerRate(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any;
  companyId: string;
  indexer: string;
  periodStart: string;
  periodEnd: string;
  spreadRate: number;
  temporaryOverrides?: TemporaryOverride[];
  applyOverridesOnlyToFuture?: boolean;
  allowProjectionUpsert?: boolean;
}): Promise<RateResolution> {
  const {
    supabaseClient,
    companyId,
    indexer,
    periodStart,
    periodEnd,
    spreadRate,
    temporaryOverrides,
    applyOverridesOnlyToFuture,
    allowProjectionUpsert = false,
  } = params;

  const mappedIndexer = mapIndexerName(indexer);
  if (!mappedIndexer) {
    // Unknown indexer: no index component, only the (annual) spread.
    // Convert it to a monthly effective rate so the caller never treats an
    // annual rate as monthly.
    const spreadMonthly = (Math.pow(1 + spreadRate / 100, 1 / 12) - 1) * 100;
    return {
      effectiveMonthlyRate: spreadMonthly,
      indexerRate: 0,
      spreadRate: spreadMonthly,
      source: "projecao_base",
      rateType: "projected",
      sourceReferenceDate: null,
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const isFuturePeriod = periodStart > today;
  const isMixedPeriod = periodStart <= today && periodEnd > today;

  let indexerRate = 0;
  let source: RateResolution["source"] = "bcb_realizado";
  let rateType: RateResolution["rateType"] = MONTHLY_INDEXERS.includes(mappedIndexer) ? 'monthly' : 'daily_accumulated';
  let sourceReferenceDate: string | null = null;

  if (isFuturePeriod || isMixedPeriod) {
    const projection = await resolveCompanyProjection(
      supabaseClient,
      companyId,
      mappedIndexer,
      allowProjectionUpsert,
    );
    indexerRate = projection.rate;
    source = "projecao_base";
    rateType = 'projected';
    sourceReferenceDate = projection.referenceDate;
  } else {
    // Historical period: use BCB realized data
    if (MONTHLY_INDEXERS.includes(mappedIndexer)) {
      const monthlyRate = await getMonthlyRate(supabaseClient, mappedIndexer, periodStart, periodEnd);
      indexerRate = monthlyRate.rate;
      sourceReferenceDate = monthlyRate.referenceDate;
      rateType = 'monthly';
    } else {
      // CDI/SELIC: accumulate daily
      const accumulated = await accumulateDailyRate(supabaseClient, mappedIndexer, periodStart, periodEnd);
      indexerRate = accumulated.rate;
      sourceReferenceDate = accumulated.referenceDate;
      rateType = 'daily_accumulated';
    }
  }

  // Apply temporary overrides
  if (temporaryOverrides) {
    const override = temporaryOverrides.find(o => mapIndexerName(o.indexType) === mappedIndexer);
    if (override) {
      const adjustmentPp = override.adjustmentPp ?? override.adjustmentBp ?? 0;
      const shouldApply = !applyOverridesOnlyToFuture || isFuturePeriod || isMixedPeriod;
      if (shouldApply) {
        indexerRate = indexerRate + adjustmentPp;
        source = "cenario_temporario";
      }
    }
  }

  // Convert spread from annual to monthly
  const spreadMonthly = (Math.pow(1 + spreadRate / 100, 1 / 12) - 1) * 100;

  // Effective monthly rate = compound the indexer rate with the spread.
  // Brazilian "indexador + spread" contracts compound the two factors
  // (B3/CETIP convention), so the effective rate is multiplicative, not the
  // sum of the two monthly rates — the sum drops the cross term and
  // systematically understates interest/CET.
  // - CDI/SELIC: accumulated rate is already an effective monthly rate
  // - IPCA/IGPM: the rate is the monthly variation
  // - projections: projected_rate is assumed to be a monthly equivalent
  const effectiveMonthlyRate =
    ((1 + indexerRate / 100) * (1 + spreadMonthly / 100) - 1) * 100;

  return {
    effectiveMonthlyRate,
    indexerRate,
    spreadRate: spreadMonthly,
    source,
    rateType,
    sourceReferenceDate,
  };
}

async function getLatestHistoricalRate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  indexType: string
): Promise<{ rate: number; rateType: string; referenceDate: string }> {
  const { data, error } = await supabaseClient
    .from('economic_indices')
    .select('rate, rate_type, reference_date')
    .eq('index_type', indexType)
    .order('reference_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { rate: 0, rateType: 'daily', referenceDate: '' };
  }

  let rate = data.rate;
  let rateType = data.rate_type || 'monthly';
  if (data.rate_type === 'daily') {
    rate = (Math.pow(1 + data.rate / 100, 21) - 1) * 100;
    rateType = 'monthly';
  } else if (data.rate_type === 'annual') {
    rate = (Math.pow(1 + data.rate / 100, 1 / 12) - 1) * 100;
    rateType = 'monthly';
  }

  return { rate, rateType, referenceDate: data.reference_date };
}

async function resolveCompanyProjection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  companyId: string,
  indexType: string,
  allowUpsert: boolean,
): Promise<{ rate: number; referenceDate: string }> {
  const { data: existingProjection, error: projectionError } = await supabaseClient
    .from('company_index_projections')
    .select('projected_rate, reference_date, source_reference_date')
    .eq('company_id', companyId)
    .eq('index_type', indexType)
    .maybeSingle();

  if (projectionError) {
    throw new Error(`Erro ao buscar projeção base de ${indexType}: ${projectionError.message}`);
  }

  if (existingProjection) {
    return {
      rate: Number(existingProjection.projected_rate),
      referenceDate: existingProjection.source_reference_date ?? existingProjection.reference_date,
    };
  }

  if (!allowUpsert) {
    throw new Error(
      `Projeção base de ${indexType} não encontrada para a empresa. Atualize a projeção base antes de simular parcelas futuras.`,
    );
  }

  const latest = await getLatestHistoricalRate(supabaseClient, indexType);

  if (!latest.referenceDate) {
    throw new Error(`Dados históricos de ${indexType} não encontrados para criar a projeção base.`);
  }

  const { error } = await supabaseClient
    .from('company_index_projections')
    .upsert({
      company_id: companyId,
      index_type: indexType,
      projected_rate: latest.rate,
      rate_type: 'monthly',
      reference_date: new Date().toISOString().split('T')[0],
      source_reference_date: latest.referenceDate,
      source: 'BCB',
    }, {
      onConflict: 'company_id,index_type',
    });

  if (error) {
    throw new Error(`Erro ao criar projeção base de ${indexType}: ${error.message}`);
  }

  return { rate: latest.rate, referenceDate: latest.referenceDate };
}

async function getMonthlyRate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  indexType: string,
  periodStart: string,
  periodEnd: string
): Promise<{ rate: number; referenceDate: string }> {
  // For IPCA, get the rate for the reference month (use periodStart month)
  const startDate = new Date(periodStart + 'T00:00:00Z');
  const yearMonth = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}`;
  
  const { data, error } = await supabaseClient
    .from('economic_indices')
    .select('rate, reference_date')
    .eq('index_type', indexType)
    .gte('reference_date', `${yearMonth}-01`)
    .lte('reference_date', `${yearMonth}-31`)
    .order('reference_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    // Fallback to latest available
    const latest = await getLatestHistoricalRate(supabaseClient, indexType);
    return { rate: latest.rate, referenceDate: latest.referenceDate };
  }

  return { rate: data.rate, referenceDate: data.reference_date };
}

async function accumulateDailyRate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  indexType: string,
  periodStart: string,
  periodEnd: string
): Promise<{ rate: number; referenceDate: string }> {
  const { data, error } = await supabaseClient
    .from('economic_indices')
    .select('rate, reference_date')
    .eq('index_type', indexType)
    .gte('reference_date', periodStart)
    .lte('reference_date', periodEnd)
    .order('reference_date', { ascending: true });

  if (error || !data || data.length === 0) {
    const latest = await getLatestHistoricalRate(supabaseClient, indexType);
    return { rate: latest.rate, referenceDate: latest.referenceDate };
  }

  // Accumulate daily: prod(1 + dailyRate/100) - 1
  let accumulated = 1;
  for (const row of data) {
    accumulated *= (1 + row.rate / 100);
  }
  const effectiveRate = (accumulated - 1) * 100;

  return {
    rate: effectiveRate,
    referenceDate: data[data.length - 1].reference_date,
  };
}
