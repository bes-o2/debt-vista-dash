import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getEffectiveRateForDate } from './getEffectiveRate.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DebtData {
  debtId: string;
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
  reprogrammingRules?: Record<string, any>;
  iofAmount?: number;
  tacAmount?: number;
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
  effective_rate?: number; // Taxa efetiva mensal usada nesta parcela (%)
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
      tacAmount = 0
    }: DebtData = await req.json();

    console.log('Calculating amortization for debt:', debtId);
    console.log('Debt parameters:', { 
      indexer, 
      spreadRate, 
      indexerStartDate,
      hasReprogrammingRules: Object.keys(reprogrammingRules).length > 0
    });

    // Get indexer rate if applicable (legacy support - now we fetch per installment)
    const indexerRate = await getIndexerRate(supabaseClient, indexer, indexerStartDate);
    console.log('Indexer rate found:', { indexer, indexerRate, spreadRate });

    // Calculate installments using JavaScript
    const installments = await calculateAmortizationJS({
      financedAmount,
      firstDueDate,
      lastDueDate,
      calculationTable,
      interestRate,
      interestType,
      indexer,
      indexerRate,
      spreadRate,
      indexerStartDate,
      reprogrammingRules,
      iofAmount,
      tacAmount
    }, supabaseClient);

    // Try to save installments to database
    try {
      // First delete existing installments
      await supabaseClient
        .from('debt_installments')
        .delete()
        .eq('debt_id', debtId);

      // Insert new installments with correct field mapping
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
        // Continue without saving to DB
      }
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      // Continue with calculated data
    }

    // Calculate CET (Custo Efetivo Total)
    const cet = calculateCET({
      initialAmount: financedAmount,
      iofAmount,
      tacAmount,
      installments,
      startDate: firstDueDate
    });

    return new Response(JSON.stringify({ 
      success: true, 
      installments,
      cet
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

// Function to map indexer names and get the latest rate
function mapIndexerName(indexer?: string): string | null {
  if (!indexer) return null;
  
  const indexerMap: { [key: string]: string } = {
    'CDI': 'CDI',
    'SELIC': 'SELIC', 
    'IPCA': 'IPCA',
    'cdi': 'CDI',
    'selic': 'SELIC',
    'ipca': 'IPCA',
    'pré-fixado': null,
    'PRE_FIXADO': null,
    'prefixado': null
  };
  
  return indexerMap[indexer] || null;
}

async function getIndexerRate(
  supabaseClient: any, 
  indexer?: string,
  targetDate?: string
): Promise<number> {
  try {
    const mappedIndexer = mapIndexerName(indexer);
    
    if (!mappedIndexer) {
      console.log('No indexer specified or pre-fixed debt, using indexer rate = 0');
      return 0;
    }

    console.log('Fetching indexer rate:', { indexer: mappedIndexer, targetDate });

    // Build query based on whether we have a target date
    let query = supabaseClient
      .from('economic_indices')
      .select('rate, reference_date')
      .eq('index_type', mappedIndexer);

    if (targetDate) {
      // Get the rate for the closest date before or on target date
      query = query
        .lte('reference_date', targetDate)
        .order('reference_date', { ascending: false });
    } else {
      // Get the latest rate
      query = query.order('reference_date', { ascending: false });
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error) {
      console.error('Error fetching indexer rate:', error);
      return 0;
    }

    if (!data) {
      console.log('No data found for indexer, using fallback rate = 0');
      return 0;
    }

    console.log('Indexer rate found:', { 
      rate: data.rate, 
      date: data.reference_date,
      forDate: targetDate || 'latest'
    });
    
    return data.rate || 0;

  } catch (error) {
    console.error('Error in getIndexerRate:', error);
    return 0;
  }
}

async function calculateAmortizationJS(params: Omit<DebtData, 'debtId'>, supabaseClient: any): Promise<Installment[]> {
  const {
    financedAmount,
    firstDueDate,
    lastDueDate,
    calculationTable,
    interestRate,
    interestType,
    indexer,
    indexerRate = 0,
    spreadRate = 0,
    indexerStartDate,
    reprogrammingRules = {},
    iofAmount = 0,
    tacAmount = 0
  } = params;

  // Determine if this is a post-fixed debt
  const isPostFixed = indexer && indexer !== 'Pré-fixado' && indexer !== 'PRE_FIXADO' && indexer !== 'prefixado';
  
  console.log('Debt type:', {
    isPostFixed,
    indexer,
    spreadRate,
    interestRate
  });

  // For pre-fixed, use the static rate
  // For post-fixed, we'll fetch per-installment rates
  const staticRate = indexerRate + spreadRate + interestRate;
  console.log('Static rate composition:', { 
    indexerRate, 
    nominalRate: interestRate,
    spreadRate,
    staticRate 
  });

  const firstDueDateObj = new Date(firstDueDate);
  const lastDueDateObj = new Date(lastDueDate);
  
  // Calculate total months between first and last due dates
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
    // Convert annual to effective monthly: (1 + annual)^(1/12) - 1
    staticMonthlyRate = Math.pow(1 + staticRate / 100, 1/12) - 1;
  } else {
    // Monthly rate
    staticMonthlyRate = staticRate / 100;
  }
  
  console.log('Static monthly rate:', staticMonthlyRate * 100 + '%');

  // Initialize balances
  let remainingBalance = financedAmount;
  const installments: Installment[] = [];

  // Calculate fixed amortization for SAC or installment for PRICE
  let fixedAmortization = 0;
  let fixedInstallment = 0;
  
  if (calculationTable === 'SAC') {
    // SAC: Fixed amortization based on financed amount only
    fixedAmortization = financedAmount / totalMonths;
  } else {
    // PRICE: Calculate fixed installment including all fees
    const totalAmount = financedAmount + iofAmount + tacAmount;
    remainingBalance = totalAmount;
    
    if (staticMonthlyRate > 0) {
      fixedInstallment = totalAmount * (staticMonthlyRate * Math.pow(1 + staticMonthlyRate, totalMonths)) / 
                        (Math.pow(1 + staticMonthlyRate, totalMonths) - 1);
    } else {
      // Zero interest rate case
      fixedInstallment = totalAmount / totalMonths;
    }
  }

  for (let i = 1; i <= totalMonths; i++) {
    // Calculate due date for this installment
    const installmentDate = new Date(firstDueDateObj);
    installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
    const dueDateStr = installmentDate.toISOString().split('T')[0];

    // Get effective rate for this installment
    let effectiveMonthlyRate = staticMonthlyRate;
    let effectiveRatePercent = staticRate;
    
    if (isPostFixed) {
      // For post-fixed, get rate specific to this installment date
      effectiveRatePercent = await getEffectiveRateForDate(
        supabaseClient,
        indexer,
        dueDateStr,
        spreadRate || 0
      );
      effectiveMonthlyRate = effectiveRatePercent / 100;
      
      if (i === 1 || i === totalMonths || i % 12 === 0) {
        console.log(`Installment ${i} (${dueDateStr}): effective rate = ${effectiveRatePercent.toFixed(4)}%`);
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
      
      // Adjust last installment to ensure zero balance
      if (i === totalMonths) {
        amortizationAmount = remainingBalance;
        installmentAmount = amortizationAmount + interestAmount;
      }
    } else {
      // PRICE: Fixed installment
      installmentAmount = fixedInstallment;
      amortizationAmount = installmentAmount - interestAmount;
      
      // Adjust last installment to ensure zero balance
      if (i === totalMonths || amortizationAmount >= remainingBalance) {
        amortizationAmount = remainingBalance;
        installmentAmount = amortizationAmount + interestAmount;
      }
    }

    // Ensure amortization doesn't exceed remaining balance
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
      indexer_rate: Number(indexerRate.toFixed(4)),
      installment_amount: Number(installmentAmount.toFixed(2)),
      days_in_period: 30, // Standard monthly period
      effective_rate: isPostFixed ? Number(effectiveRatePercent.toFixed(4)) : undefined
    });

    // Update remaining balance
    remainingBalance -= amortizationAmount;

    // Stop if balance is paid off
    if (remainingBalance <= 0.01) {
      break;
    }
  }

  console.log('Final calculation result:', { 
    totalInstallments: installments.length, 
    finalBalance: remainingBalance.toFixed(2) 
  });

  return installments;
}

/**
 * Calculate CET (Custo Efetivo Total) using IRR method
 * CET = Internal Rate of Return considering all costs
 */
function calculateCET(params: {
  initialAmount: number;
  iofAmount: number;
  tacAmount: number;
  installments: Installment[];
  startDate: string;
}): { monthlyRate: number; annualRate: number; converged: boolean } {
  const { initialAmount, iofAmount, tacAmount, installments, startDate } = params;
  
  // Net amount received by the borrower (after IOF and TAC)
  const netAmount = initialAmount - iofAmount - tacAmount;
  
  // Build cash flows: initial inflow (negative) + installment outflows (positive)
  const cashFlows = [
    { date: new Date(startDate), amount: -netAmount }, // What the borrower actually receives
    ...installments.map(inst => ({
      date: new Date(inst.due_date),
      amount: inst.installment_amount // Total payment including interest
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
  
  // Calculate IRR using Newton-Raphson method
  const start = new Date(startDate);
  let annualRate = 0.10; // Initial guess: 10% annual
  const tolerance = 0.000001;
  const maxIterations = 1000;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let npvDerivative = 0;
    
    // Calculate NPV and its derivative
    cashFlows.forEach(cf => {
      const days = (cf.date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      const years = days / 365.25;
      const discountFactor = Math.pow(1 + annualRate, years);
      
      npv += cf.amount / discountFactor;
      npvDerivative -= cf.amount * years / (discountFactor * (1 + annualRate));
    });
    
    // Check for convergence
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
    
    // Newton-Raphson update
    if (Math.abs(npvDerivative) < tolerance) {
      console.warn('⚠️ CET calculation: derivative too small');
      break;
    }
    
    const newRate = annualRate - npv / npvDerivative;
    
    // Limit rate change to prevent divergence
    const maxChange = Math.abs(annualRate) * 0.1 + 0.01;
    if (Math.abs(newRate - annualRate) > maxChange) {
      annualRate = annualRate + Math.sign(newRate - annualRate) * maxChange;
    } else {
      annualRate = newRate;
    }
    
    // Keep rate in reasonable range
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