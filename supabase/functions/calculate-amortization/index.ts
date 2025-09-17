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

    // Calculate installments using JavaScript (fallback when DB function isn't available)
    const installments = calculateAmortizationJS({
      financedAmount,
      releaseDate,
      dueDate,
      calculationTable,
      interestRate,
      interestType,
      indexer,
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

      // Insert new installments
      const installmentsToInsert = installments.map(inst => ({
        debt_id: debtId,
        ...inst
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

function calculateAmortizationJS(params: Omit<DebtData, 'debtId'>): Installment[] {
  const {
    financedAmount,
    releaseDate,
    dueDate,
    calculationTable,
    interestRate,
    interestType,
    iofAmount = 0,
    tacAmount = 0
  } = params;

  const releaseDateTime = new Date(releaseDate);
  const dueDateTime = new Date(dueDate);
  
  // Calculate total months
  const totalMonths = (dueDateTime.getFullYear() - releaseDateTime.getFullYear()) * 12 + 
                     (dueDateTime.getMonth() - releaseDateTime.getMonth());

  // Convert interest rate to monthly
  let monthlyRate: number;
  if (interestType === 'annual') {
    monthlyRate = Math.pow(1 + interestRate / 100, 1/12) - 1;
  } else {
    monthlyRate = interestRate / 100;
  }

  // Initialize remaining balance
  let remainingBalance = financedAmount + iofAmount + tacAmount;
  const installments: Installment[] = [];

  // Calculate PRICE factor if needed
  let priceFactor = 0;
  if (calculationTable === 'PRICE') {
    priceFactor = monthlyRate * Math.pow(1 + monthlyRate, totalMonths) / 
                  (Math.pow(1 + monthlyRate, totalMonths) - 1);
  }

  for (let i = 1; i <= totalMonths; i++) {
    // Calculate due date for this installment
    const installmentDate = new Date(releaseDateTime);
    installmentDate.setMonth(installmentDate.getMonth() + i);

    // Calculate interest for this period
    const interestAmount = remainingBalance * monthlyRate;

    // Calculate amortization based on table type
    let amortizationAmount: number;
    let installmentAmount: number;

    if (calculationTable === 'SAC') {
      // SAC: Fixed amortization
      amortizationAmount = financedAmount / totalMonths;
      installmentAmount = amortizationAmount + interestAmount;
    } else {
      // PRICE: Fixed installment
      installmentAmount = remainingBalance * priceFactor;
      amortizationAmount = installmentAmount - interestAmount;
    }

    installments.push({
      installment_number: i,
      due_date: installmentDate.toISOString().split('T')[0],
      principal_balance: Number(remainingBalance.toFixed(2)),
      amortization: Number(amortizationAmount.toFixed(2)),
      interest_amount: Number(interestAmount.toFixed(2)),
      indexer_rate: 0,
      installment_amount: Number(installmentAmount.toFixed(2)),
      days_in_period: 30
    });

    // Update remaining balance
    remainingBalance -= amortizationAmount;

    // Stop if balance is paid off
    if (remainingBalance <= 0.01) {
      break;
    }
  }

  return installments;
}