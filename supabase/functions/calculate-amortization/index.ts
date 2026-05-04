import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveIndexerRate, type RateResolution, type TemporaryOverride } from './getEffectiveRate.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DebtData {
  debtId: string;
  companyId: string;
  financedAmount: number;
  firstDueDate: string;
  lastDueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  interestRate: number;
  interestType: 'monthly' | 'annual';
  indexer?: string;
  indexerRate?: number;
  spreadRate?: number;
  indexerStartDate?: string;
  reprogrammingRules?: Record<string, unknown>;
  iofAmount?: number;
  tacAmount?: number;
  temporaryOverrides?: TemporaryOverride[];
  persist?: boolean;
}

interface Installment {
  installment_number: number;
  due_date: string;
  principal_balance: number;
  amortization: number;
  interest_amount: number;
  indexer_rate: number;
  installment_amount: number;
  days_in_period: number;
  effective_rate?: number;
}

interface RateRefRecord {
  company_id: string;
  debt_id: string;
  installment_number: number;
  index_type: string;
  period_start: string;
  period_end: string;
  rate: number;
  rate_type: string;
  source: string;
  scenario_label: string;
  source_reference_date: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      debtId,
      companyId,
      financedAmount,
      firstDueDate,
      lastDueDate,
      calculationTable,
      interestRate,
      interestType = 'monthly',
      indexer,
      spreadRate = 0,
      indexerStartDate,
      reprogrammingRules = {},
      iofAmount = 0,
      tacAmount = 0,
      temporaryOverrides = [],
      persist
    }: DebtData = await req.json();

    if (!companyId) {
      throw new Error('companyId is required');
    }

    const shouldPersist = persist ?? temporaryOverrides.length === 0;

    console.log('Calculating amortization for debt:', debtId, 'company:', companyId);
    console.log('Debt parameters:', {
      indexer,
      spreadRate,
      indexerStartDate,
      temporaryOverrides: temporaryOverrides.length,
      shouldPersist,
      hasReprogrammingRules: Object.keys(reprogrammingRules).length > 0
    });

    // Calculate installments
    const { installments, rateRefs } = await calculateAmortizationJS({
      debtId,
      financedAmount,
      firstDueDate,
      lastDueDate,
      calculationTable,
      interestRate,
      interestType,
      indexer,
      spreadRate,
      indexerStartDate,
      reprogrammingRules,
      iofAmount,
      tacAmount,
      companyId,
      temporaryOverrides
    }, supabaseClient);

    if (shouldPersist) {
      // Try to save installments and rate refs to database
      try {
        // First delete rate refs, then installments. The refs depend on the debt,
        // but keeping this order avoids transient unique conflicts on recalculation.
        await supabaseClient
          .from('debt_installment_rate_refs')
          .delete()
          .eq('debt_id', debtId);

        await supabaseClient
          .from('debt_installments')
          .delete()
          .eq('debt_id', debtId);

        // Insert new installments
        const installmentsToInsert = installments.map(inst => ({
          debt_id: debtId,
          installment_number: inst.installment_number,
          due_date: inst.due_date,
          principal_amount: inst.amortization,
          interest_amount: inst.interest_amount,
          total_amount: inst.installment_amount,
          remaining_balance: inst.principal_balance
        }));

        const { error: insertError } = await supabaseClient
          .from('debt_installments')
          .insert(installmentsToInsert);

        if (insertError) {
          console.error('Error saving installments:', insertError);
        }

        // Insert rate refs
        if (rateRefs.length > 0) {
          const { error: rateRefError } = await supabaseClient
            .from('debt_installment_rate_refs')
            .insert(rateRefs);

          if (rateRefError) {
            console.error('Error saving rate refs:', rateRefError);
          }
        }
      } catch (dbError) {
        console.error('Database operation failed:', dbError);
      }
    }

    const releaseDate = shiftMonthISO(firstDueDate, -1);

    // Calculate CET
    const cet = calculateCET({
      initialAmount: financedAmount,
      iofAmount,
      tacAmount,
      installments,
      startDate: releaseDate
    });

    if (shouldPersist) {
      // Persist CET
      try {
        const { error: cetUpdateError } = await supabaseClient
          .from('debts')
          .update({
            cet_monthly_rate: cet.monthlyRate,
            cet_annual_rate: cet.annualRate
          })
          .eq('id', debtId);

        if (cetUpdateError) {
          console.error('Error updating CET in database:', cetUpdateError);
        }
      } catch (cetError) {
        console.error('Failed to persist CET:', cetError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      installments,
      cet,
      persisted: shouldPersist
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calculate-amortization function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function shiftMonthISO(dateString: string, months: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;

  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDayOfTargetMonth));

  return target.toISOString().split('T')[0];
}

interface CalculationParams {
  debtId: string;
  financedAmount: number;
  firstDueDate: string;
  lastDueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  interestRate: number;
  interestType: 'monthly' | 'annual';
  indexer?: string;
  spreadRate: number;
  indexerStartDate?: string;
  reprogrammingRules?: Record<string, unknown>;
  iofAmount: number;
  tacAmount: number;
  companyId: string;
  temporaryOverrides: TemporaryOverride[];
}

async function calculateAmortizationJS(
  params: CalculationParams,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any
): Promise<{ installments: Installment[]; rateRefs: RateRefRecord[] }> {
  const {
    debtId,
    financedAmount,
    firstDueDate,
    lastDueDate,
    calculationTable,
    interestRate,
    interestType,
    indexer,
    spreadRate = 0,
    companyId,
    temporaryOverrides = [],
    iofAmount = 0,
    tacAmount = 0
  } = params;

  const isPostFixed = indexer && indexer !== 'Pré-fixado' && indexer !== 'PRE_FIXADO' && indexer !== 'prefixado';

  console.log('Debt type:', {
    isPostFixed,
    indexer,
    spreadRate,
    interestRate
  });

  // For pre-fixed, use the static rate
  const staticRate = spreadRate + interestRate;
  console.log('Static rate composition:', {
    nominalRate: interestRate,
    spreadRate,
    staticRate
  });

  const firstDueDateObj = new Date(firstDueDate);
  const lastDueDateObj = new Date(lastDueDate);

  const totalMonths = (lastDueDateObj.getFullYear() - firstDueDateObj.getFullYear()) * 12 +
                     (lastDueDateObj.getMonth() - firstDueDateObj.getMonth()) + 1;

  console.log('Period calculation:', {
    firstDueDate,
    lastDueDate,
    totalMonths
  });

  // For pre-fixed, calculate static monthly rate
  let staticMonthlyRate: number;
  if (interestType === 'annual') {
    staticMonthlyRate = Math.pow(1 + staticRate / 100, 1/12) - 1;
  } else {
    staticMonthlyRate = staticRate / 100;
  }

  console.log('Static monthly rate:', staticMonthlyRate * 100 + '%');

  let remainingBalance = financedAmount;
  const installments: Installment[] = [];
  const rateRefs: RateRefRecord[] = [];

  let fixedAmortization = 0;
  let fixedInstallment = 0;

  if (calculationTable === 'SAC') {
    fixedAmortization = financedAmount / totalMonths;
  } else if (calculationTable === 'PRICE' && !isPostFixed) {
    if (staticMonthlyRate > 0) {
      fixedInstallment = financedAmount * (staticMonthlyRate * Math.pow(1 + staticMonthlyRate, totalMonths)) /
                        (Math.pow(1 + staticMonthlyRate, totalMonths) - 1);
    } else {
      fixedInstallment = financedAmount / totalMonths;
    }
  }

  const releaseDate = shiftMonthISO(firstDueDate, -1);

  for (let i = 1; i <= totalMonths; i++) {
    const installmentDate = new Date(firstDueDateObj);
    installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
    const dueDateStr = installmentDate.toISOString().split('T')[0];

    // Determine period for rate resolution
    const prevDueDateStr = i === 1 ? releaseDate : shiftMonthISO(dueDateStr, -1);

    // Get effective rate for this installment
    let effectiveMonthlyRate = staticMonthlyRate;
    let effectiveRatePercent = staticRate;
    let rateResolution: RateResolution | null = null;

    if (isPostFixed) {
      rateResolution = await resolveIndexerRate({
        supabaseClient,
        companyId,
        indexer,
        periodStart: prevDueDateStr,
        periodEnd: dueDateStr,
        spreadRate: spreadRate || 0,
        temporaryOverrides
      });

      effectiveRatePercent = rateResolution.effectiveMonthlyRate;
      effectiveMonthlyRate = effectiveRatePercent / 100;

      if (i === 1 || i === totalMonths || i % 12 === 0) {
        console.log(`Installment ${i} (${dueDateStr}): effective rate = ${effectiveRatePercent.toFixed(4)}%, source = ${rateResolution.source}`);
      }
    }

    // Calculate interest for this period
    const interestAmount = remainingBalance * effectiveMonthlyRate;

    // Calculate amortization and installment based on table type
    let amortizationAmount: number;
    let installmentAmount: number;

    if (calculationTable === 'SAC') {
      amortizationAmount = fixedAmortization;
      installmentAmount = amortizationAmount + interestAmount;

      if (i === totalMonths) {
        amortizationAmount = remainingBalance;
        installmentAmount = amortizationAmount + interestAmount;
      }
    } else {
      // PRICE
      if (isPostFixed) {
        const nRest = totalMonths - i + 1;
        if (effectiveMonthlyRate > 0) {
          installmentAmount = remainingBalance * (effectiveMonthlyRate * Math.pow(1 + effectiveMonthlyRate, nRest)) /
                             (Math.pow(1 + effectiveMonthlyRate, nRest) - 1);
        } else {
          installmentAmount = remainingBalance / nRest;
        }
        amortizationAmount = installmentAmount - interestAmount;
        amortizationAmount = Math.max(amortizationAmount, 0);

        if (i === 1 || i === 12 || i === totalMonths || i % 12 === 0) {
          console.log(`PRICE post-fixed installment ${i}: rate=${(effectiveMonthlyRate * 100).toFixed(4)}%, installment=${installmentAmount.toFixed(2)}, amortization=${amortizationAmount.toFixed(2)}, balance=${remainingBalance.toFixed(2)}`);
        }
      } else {
        installmentAmount = fixedInstallment;
        amortizationAmount = installmentAmount - interestAmount;
      }

      if (i === totalMonths || amortizationAmount >= remainingBalance) {
        amortizationAmount = remainingBalance;
        installmentAmount = amortizationAmount + interestAmount;
      }
    }

    if (amortizationAmount > remainingBalance) {
      amortizationAmount = remainingBalance;
      installmentAmount = amortizationAmount + interestAmount;
    }

    installments.push({
      installment_number: i,
      due_date: dueDateStr,
      principal_balance: Number(remainingBalance.toFixed(2)),
      amortization: Number(amortizationAmount.toFixed(2)),
      interest_amount: Number(interestAmount.toFixed(2)),
      indexer_rate: Number((rateResolution?.indexerRate ?? 0).toFixed(4)),
      installment_amount: Number(installmentAmount.toFixed(2)),
      days_in_period: 30,
      effective_rate: isPostFixed ? Number(effectiveRatePercent.toFixed(4)) : undefined
    });

    // Save rate ref for post-fixed debts
    if (isPostFixed && rateResolution) {
      const mappedIndexer = indexer!.toUpperCase().includes('CDI') ? 'CDI' :
                           indexer!.toUpperCase().includes('SELIC') ? 'SELIC' :
                           indexer!.toUpperCase().includes('IPCA') ? 'IPCA' : indexer!;

      rateRefs.push({
        company_id: companyId,
        debt_id: debtId,
        installment_number: i,
        index_type: mappedIndexer,
        period_start: prevDueDateStr,
        period_end: dueDateStr,
        rate: Number(rateResolution.indexerRate.toFixed(6)),
        rate_type: rateResolution.rateType,
        source: rateResolution.source,
        scenario_label: rateResolution.source === 'cenario_temporario' ? 'Temporário' : 'Base',
        source_reference_date: rateResolution.sourceReferenceDate
      });
    }

    remainingBalance -= amortizationAmount;

    if (remainingBalance <= 0.01) {
      break;
    }
  }

  console.log('Final calculation result:', {
    totalInstallments: installments.length,
    finalBalance: remainingBalance.toFixed(2),
    rateRefsCount: rateRefs.length
  });

  return { installments, rateRefs };
}

/**
 * Calculate CET (Custo Efetivo Total) using IRR method
 */
function calculateCET(params: {
  initialAmount: number;
  iofAmount: number;
  tacAmount: number;
  installments: Installment[];
  startDate: string;
}): { monthlyRate: number; annualRate: number; converged: boolean } {
  const { initialAmount, iofAmount, tacAmount, installments, startDate } = params;

  const netAmount = initialAmount - iofAmount - tacAmount;

  const cashFlows = [
    { date: new Date(startDate), amount: -netAmount },
    ...installments.map(inst => ({
      date: new Date(inst.due_date),
      amount: inst.installment_amount
    }))
  ];

  console.log('🔍 CET Calculation:', {
    initialAmount: initialAmount.toFixed(2),
    iofAmount: iofAmount.toFixed(2),
    tacAmount: tacAmount.toFixed(2),
    netAmount: netAmount.toFixed(2),
    totalPayments: installments.reduce((sum, inst) => sum + inst.installment_amount, 0).toFixed(2),
    installmentsCount: installments.length
  });

  const start = new Date(startDate);
  let annualRate = 0.10;
  const tolerance = 0.000001;
  const maxIterations = 1000;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let npvDerivative = 0;

    cashFlows.forEach(cf => {
      const days = (cf.date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      const years = days / 365.25;
      const discountFactor = Math.pow(1 + annualRate, years);

      npv += cf.amount / discountFactor;
      npvDerivative -= cf.amount * years / (discountFactor * (1 + annualRate));
    });

    if (Math.abs(npv) < tolerance) {
      const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;

      console.log('✅ CET Converged:', {
        iterations: i,
        annualRate: (annualRate * 100).toFixed(4) + '%',
        monthlyRate: (monthlyRate * 100).toFixed(4) + '%',
        finalNPV: npv.toFixed(8)
      });

      return {
        monthlyRate: monthlyRate * 100,
        annualRate: annualRate * 100,
        converged: true
      };
    }

    if (Math.abs(npvDerivative) < tolerance) {
      console.warn('⚠️ CET calculation: derivative too small');
      break;
    }

    const newRate = annualRate - npv / npvDerivative;

    const maxChange = Math.abs(annualRate) * 0.1 + 0.01;
    if (Math.abs(newRate - annualRate) > maxChange) {
      annualRate = annualRate + Math.sign(newRate - annualRate) * maxChange;
    } else {
      annualRate = newRate;
    }

    annualRate = Math.max(-0.5, Math.min(5.0, annualRate));
  }

  const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;

  console.error('❌ CET did not converge:', {
    finalAnnualRate: (annualRate * 100).toFixed(4) + '%',
    finalMonthlyRate: (monthlyRate * 100).toFixed(4) + '%'
  });

  return {
    monthlyRate: monthlyRate * 100,
    annualRate: annualRate * 100,
    converged: false
  };
}
