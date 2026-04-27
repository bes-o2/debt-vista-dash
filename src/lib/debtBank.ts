const DEFAULT_BACKFILLED_BANK = "Banco do Brasil";

const BANK_NAME_HINTS = [
  "banco",
  "bank",
  "bb",
  "bradesco",
  "btg",
  "bv",
  "caixa",
  "c6",
  "daycoval",
  "inter",
  "itau",
  "itaú",
  "mercantil",
  "modal",
  "nubank",
  "pan",
  "safra",
  "santander",
  "sicredi",
  "sicoob",
  "xp",
];

const normalizeText = (value?: string | null) => value?.trim() ?? "";

export const isLikelyBankName = (value?: string | null) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;

  return BANK_NAME_HINTS.some((hint) => normalized.includes(hint));
};

export const resolveDebtBankName = (debt: {
  bank?: string | null;
  title?: string | null;
  description?: string | null;
}) => {
  const bank = normalizeText(debt.bank);
  const title = normalizeText(debt.title);
  const description = normalizeText(debt.description);

  if (bank && bank !== DEFAULT_BACKFILLED_BANK) {
    return bank;
  }

  if (title && (!bank || (bank === DEFAULT_BACKFILLED_BANK && title !== bank && isLikelyBankName(title)))) {
    return title;
  }

  if (description && !bank && isLikelyBankName(description)) {
    return description;
  }

  return bank || DEFAULT_BACKFILLED_BANK;
};
