import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DebtData {
  debtId: string;
  financedAmount: number;
  releaseDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  interestRate: number;
  interestType: 'monthly' | 'annual';
  indexer?: string;
  indexerRate?: number;
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
      releaseDate, 
      dueDate, 
      calculationTable, 
      interestRate, 
      interestType = 'monthly',
      indexer,
      iofAmount = 0,
      tacAmount = 0
    }: DebtData = await req.json();

    console.log('Calculating amortization for debt:', debtId);

    // Get indexer rate if applicable
    const indexerRate = await getIndexerRate(supabaseClient, indexer);
    console.log('Indexer rate found:', { indexer, indexerRate });

    // Calculate installments using JavaScript (fallback when DB function isn't available)
    const installments = calculateAmortizationJS({
      financedAmount,
      releaseDate,
      dueDate,
      calculationTable,
      interestRate,
      interestType,
      indexer,
      indexerRate,
      iofAmount,
      tacAmount
    });

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

    return new Response(JSON.stringify({ 
      success: true, 
      installments 
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

async function getIndexerRate(supabaseClient: any, indexer?: string): Promise<number> {
  try {
    const mappedIndexer = mapIndexerName(indexer);
    
    if (!mappedIndexer) {
      console.log('No indexer specified or pre-fixed debt, using indexer rate = 0');
      return 0;
    }

    console.log('Fetching latest rate for indexer:', mappedIndexer);

    // Get the latest rate for this indexer
    const { data, error } = await supabaseClient
      .from('economic_indices')
      .select('rate, reference_date')
      .eq('index_type', mappedIndexer)
      .order('reference_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching indexer rate:', error);
      return 0;
    }

    if (!data) {
      console.log('No data found for indexer, using fallback rate = 0');
      return 0;
    }

    console.log('Indexer rate found:', { rate: data.rate, date: data.reference_date });
    return data.rate || 0;

  } catch (error) {
    console.error('Error in getIndexerRate:', error);
    return 0;
  }
}

function calculateAmortizationJS(params: Omit<DebtData, 'debtId'>): Installment[] {
  const {
    financedAmount,
    releaseDate,
    dueDate,
    calculationTable,
    interestRate,
    interestType,
    indexerRate = 0,
    iofAmount = 0,
    tacAmount = 0
  } = params;

  // Calculate final rate: indexer + nominal interest rate
  const finalRate = indexerRate + interestRate;
  console.log('Rate composition:', { 
    indexerRate, 
    nominalRate: interestRate, 
    finalRate 
  });

  const releaseDateTime = new Date(releaseDate);
  const dueDateTime = new Date(dueDate);
  
  // Calculate total months
  const totalMonths = (dueDateTime.getFullYear() - releaseDateTime.getFullYear()) * 12 + 
                     (dueDateTime.getMonth() - releaseDateTime.getMonth());

  // Convert final rate (indexer + nominal) to daily equivalent
  let dailyRate: number;
  if (interestType === 'annual') {
    // Convert annual to daily: (1 + annual)^(1/365) - 1
    dailyRate = Math.pow(1 + finalRate / 100, 1/365) - 1;
  } else {
    // Convert monthly to daily: (1 + monthly)^(1/30) - 1
    dailyRate = Math.pow(1 + finalRate / 100, 1/30) - 1;
  }

  // Initialize remaining balance - SAC uses only financedAmount for amortization
  let remainingBalance = financedAmount;
  const installments: Installment[] = [];

  // Calculate PRICE factor if needed (uses total financed amount including fees)
  let priceFactor = 0;
  if (calculationTable === 'PRICE') {
    const totalFinancedAmount = financedAmount + iofAmount + tacAmount;
    const monthlyRate = interestType === 'annual' 
      ? Math.pow(1 + finalRate / 100, 1/12) - 1
      : finalRate / 100;
    priceFactor = monthlyRate * Math.pow(1 + monthlyRate, totalMonths) / 
                  (Math.pow(1 + monthlyRate, totalMonths) - 1);
    remainingBalance = totalFinancedAmount;
  }

  // Helper function to calculate days between dates
  function getDaysBetween(startDate: Date, endDate: Date): number {
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  let previousDate = releaseDateTime;

  for (let i = 1; i <= totalMonths; i++) {
    // Calculate due date for this installment
    const installmentDate = new Date(releaseDateTime);
    installmentDate.setMonth(installmentDate.getMonth() + i);

    // Calculate actual days in this period
    const daysInPeriod = getDaysBetween(previousDate, installmentDate);

    // Calculate interest for this period based on actual days
    const interestAmount = remainingBalance * dailyRate * daysInPeriod;

    // Calculate amortization based on table type
    let amortizationAmount: number;
    let installmentAmount: number;

    if (calculationTable === 'SAC') {
      // SAC: Fixed amortization on financedAmount only (excluding TAC/IOF)
      amortizationAmount = financedAmount / totalMonths;
      installmentAmount = amortizationAmount + interestAmount;
    } else {
      // PRICE: Fixed installment
      const monthlyRate = interestType === 'annual' 
        ? Math.pow(1 + finalRate / 100, 1/12) - 1
        : finalRate / 100;
      installmentAmount = remainingBalance * priceFactor;
      amortizationAmount = installmentAmount - interestAmount;
    }

    // Final installment rounding adjustment to avoid residual balance
    if (amortizationAmount > remainingBalance - 1e-6 || i === totalMonths) {
      amortizationAmount = Math.min(remainingBalance, amortizationAmount);
      installmentAmount = amortizationAmount + interestAmount;
    }

    installments.push({
      installment_number: i,
      due_date: installmentDate.toISOString().split('T')[0],
      principal_balance: Number(remainingBalance.toFixed(2)),
      amortization: Number(amortizationAmount.toFixed(2)),
      interest_amount: Number(interestAmount.toFixed(2)),
      indexer_rate: Number(indexerRate.toFixed(4)),
      installment_amount: Number(installmentAmount.toFixed(2)),
      days_in_period: daysInPeriod
    });

    // Update remaining balance
    remainingBalance -= amortizationAmount;
    previousDate = installmentDate;

    // Stop if balance is paid off
    if (remainingBalance <= 0.01) {
      break;
    }
  }

  return installments;
}