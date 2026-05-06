/**
 * Calculate IRR (Internal Rate of Return) from cash flows with dates
 * Uses Newton-Raphson method to find the rate that makes NPV = 0
 */

interface CashFlow {
  date: Date;
  amount: number;
}

/**
 * Calculate the number of days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diff = date2.getTime() - date1.getTime();
  return diff / (1000 * 60 * 60 * 24);
}

/**
 * Calculate NPV (Net Present Value) for given cash flows and annual rate
 */
function calculateNPV(cashFlows: CashFlow[], annualRate: number, startDate: Date): number {
  return cashFlows.reduce((npv, cf) => {
    const days = daysBetween(startDate, cf.date);
    const years = days / 365.25;
    return npv + cf.amount / Math.pow(1 + annualRate, years);
  }, 0);
}

/**
 * Calculate NPV derivative for Newton-Raphson
 */
function calculateNPVDerivative(cashFlows: CashFlow[], annualRate: number, startDate: Date): number {
  return cashFlows.reduce((derivative, cf) => {
    const days = daysBetween(startDate, cf.date);
    const years = days / 365.25;
    const discountFactor = Math.pow(1 + annualRate, years);

    return derivative - (cf.amount * years) / (discountFactor * (1 + annualRate));
  }, 0);
}

/**
 * Calculate IRR from actual cash flows with dates
 * @param initialAmount - The initial cash outflow (will be made negative)
 * @param payments - Array of payment objects with date and amount
 * @param startDate - The date of the initial cash flow
 * @returns Object with monthly and annual IRR rates
 */
export function calculateIRRFromCashFlows(
  initialAmount: number,
  payments: Array<{ date: string | Date; amount: number }>,
  startDate: string | Date
): { monthlyRate: number; annualRate: number; converged: boolean; iterations: number } {
  
  const start = new Date(startDate);
  
  // Build cash flows array
  const cashFlows: CashFlow[] = [
    { date: start, amount: -initialAmount }, // Initial cash outflow (negative)
    ...payments.map(p => ({ date: new Date(p.date), amount: p.amount }))
  ];

  // Start with a reasonable initial guess (10% annual)
  let annualRate = 0.10;
  const tolerance = 0.000001;
  const maxIterations = 1000;

  for (let i = 0; i < maxIterations; i++) {
    const npv = calculateNPV(cashFlows, annualRate, start);

    if (Math.abs(npv) < tolerance) {
      const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;

      return {
        annualRate: annualRate * 100,
        monthlyRate: monthlyRate * 100,
        converged: true,
        iterations: i
      };
    }
    
    const derivative = calculateNPVDerivative(cashFlows, annualRate, start);
    
    if (Math.abs(derivative) < tolerance) {
      console.warn('⚠️ Derivative too small, stopping');
      break;
    }
    
    const newRate = annualRate - npv / derivative;
    
    // Limit rate change to prevent divergence
    const maxChange = Math.abs(annualRate) * 0.1 + 0.01;
    if (Math.abs(newRate - annualRate) > maxChange) {
      annualRate = annualRate + Math.sign(newRate - annualRate) * maxChange;
    } else {
      annualRate = newRate;
    }
    
    // Keep rate in reasonable range (-50% to 500%)
    annualRate = Math.max(-0.5, Math.min(5.0, annualRate));
  }
  
  const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
  
  console.error('❌ IRR did not converge:', {
    finalAnnualRate: (annualRate * 100).toFixed(6) + '%',
    finalMonthlyRate: (monthlyRate * 100).toFixed(6) + '%',
    finalNPV: calculateNPV(cashFlows, annualRate, start).toFixed(2)
  });
  
  return {
    annualRate: annualRate * 100,
    monthlyRate: monthlyRate * 100,
    converged: false,
    iterations: maxIterations
  };
}
