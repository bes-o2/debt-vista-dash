export type CetStatus = "calculado" | "nao_convergiu" | "pendente";

export const CET_NOT_CONVERGED_TOOLTIP =
  "CET não pôde ser calculado para este contrato";

type DebtWithCetStatus = {
  cet_status?: CetStatus | null;
  cet_monthly_rate?: number | null;
  cet_annual_rate?: number | null;
};

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const hasCalculatedCet = (debt: DebtWithCetStatus) =>
  isFiniteNumber(debt.cet_monthly_rate) && isFiniteNumber(debt.cet_annual_rate);

export const resolveCetStatus = (debt: DebtWithCetStatus): CetStatus => {
  if (debt.cet_status) return debt.cet_status;
  return hasCalculatedCet(debt) ? "calculado" : "pendente";
};

export const getAggregateCetStatus = (debts: DebtWithCetStatus[]): CetStatus => {
  if (debts.length === 0) return "calculado";

  const statuses = debts.map(resolveCetStatus);
  if (statuses.includes("nao_convergiu")) return "nao_convergiu";
  if (statuses.includes("pendente")) return "pendente";
  return "calculado";
};
