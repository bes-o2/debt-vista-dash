type RateType = "monthly" | "annual";

const toDecimal = (ratePercent: number) => ratePercent / 100;

/**
 * Recebe taxa anual percentual e retorna taxa mensal efetiva em decimal.
 */
export const annualToMonthly = (annualRatePercent: number): number =>
  Math.pow(1 + toDecimal(annualRatePercent), 1 / 12) - 1;

/**
 * Recebe taxa mensal percentual e retorna taxa anual efetiva em decimal.
 */
export const monthlyToAnnual = (monthlyRatePercent: number): number =>
  Math.pow(1 + toDecimal(monthlyRatePercent), 12) - 1;

/**
 * Recebe taxa anual percentual e retorna taxa diária efetiva em decimal,
 * usando base brasileira de 252 dias úteis.
 */
export const annualToDaily = (annualRatePercent: number): number =>
  Math.pow(1 + toDecimal(annualRatePercent), 1 / 252) - 1;

/**
 * Recebe taxa mensal percentual e retorna taxa diária efetiva em decimal,
 * usando base aproximada de 21 dias úteis por mês.
 */
export const monthlyToDaily = (monthlyRatePercent: number): number =>
  Math.pow(1 + toDecimal(monthlyRatePercent), 1 / 21) - 1;

/**
 * Recebe taxa-base e spread em percentual e retorna taxa mensal efetiva em decimal.
 * O spread cadastrado é sempre anual.
 */
export const getEffectiveMonthlyRate = (
  interestRatePercent: number,
  annualSpreadRatePercent = 0,
  rateType: RateType = "monthly",
): number => {
  const baseMonthlyRate =
    rateType === "annual"
      ? annualToMonthly(interestRatePercent)
      : toDecimal(interestRatePercent);

  return baseMonthlyRate + annualToMonthly(annualSpreadRatePercent);
};
