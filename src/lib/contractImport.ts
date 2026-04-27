import type { DebtInput } from "@/hooks/useDebts";
import type { DebtGuaranteeInput, GuaranteeType } from "@/hooks/useDebtGuarantees";

export type ContractImportConfidence = "high" | "medium" | "low" | "unknown";

export interface ContractImportDraft {
  debt: DebtInput;
  guarantees: DebtGuaranteeInput[];
  confidence: Record<string, ContractImportConfidence>;
  notes?: string;
  sourceName?: string;
}

export const CONTRACT_IMPORT_CONFIDENCE_LABELS: Record<string, string> = {
  bank: "Banco",
  financed_amount: "Valor financiado",
  dates: "Datas",
  calculation_table: "Tabela de cálculo",
  interest_rate: "Taxa de juros",
  indexer: "Indexador",
  fees: "IOF/TAC",
  guarantees: "Garantias",
};

type JsonRecord = Record<string, unknown>;

const KNOWN_INDEXERS = ["CDI", "SELIC", "IPCA", "TJLP", "TR"];

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unwrapValue = (value: unknown): unknown => {
  if (isRecord(value) && "value" in value) {
    return value.value;
  }

  return value;
};

const getRawValue = (record: JsonRecord, keys: string[]) => {
  for (const key of keys) {
    if (key in record) {
      return { key, value: unwrapValue(record[key]) };
    }
  }

  return undefined;
};

const parseNumber = (value: unknown): number | undefined => {
  const unwrapped = unwrapValue(value);

  if (typeof unwrapped === "number" && Number.isFinite(unwrapped)) {
    return unwrapped;
  }

  if (typeof unwrapped !== "string") {
    return undefined;
  }

  const trimmed = unwrapped.trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = trimmed.replace(/[^\d,.-]/g, "");
  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");
  const normalized =
    lastComma > lastDot
      ? numeric.replace(/\./g, "").replace(",", ".")
      : numeric.replace(/,/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readNumber = (record: JsonRecord, keys: string[]): number | undefined => {
  const raw = getRawValue(record, keys);
  return raw ? parseNumber(raw.value) : undefined;
};

const readString = (record: JsonRecord, keys: string[]): string | undefined => {
  const raw = getRawValue(record, keys);
  const value = raw?.value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
};

const parseDate = (value: unknown): string | undefined => {
  const unwrapped = unwrapValue(value);
  if (typeof unwrapped !== "string") {
    return undefined;
  }

  const trimmed = unwrapped.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmed;
  }

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  return undefined;
};

const readDate = (record: JsonRecord, keys: string[]): string | undefined => {
  const raw = getRawValue(record, keys);
  return raw ? parseDate(raw.value) : undefined;
};

const normalizeCalculationTable = (value?: string): "SAC" | "PRICE" => {
  const normalized = value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() ?? "";

  if (normalized.includes("SAC")) {
    return "SAC";
  }

  return "PRICE";
};

const normalizeInterestBase = (value?: string): string => {
  const cleaned = value?.trim();
  const normalized = cleaned?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() ?? "";

  if (!normalized || normalized === "PRE" || normalized.includes("PRE FIX") || normalized.includes("PREFIX")) {
    return "Pré-fixado";
  }

  const knownIndexer = KNOWN_INDEXERS.find((indexer) => normalized.includes(indexer));
  return knownIndexer ?? cleaned ?? "Pré-fixado";
};

const normalizeInterestType = (record: JsonRecord): "monthly" | "annual" => {
  const rateType = readString(record, ["interest_type", "interest_rate_type", "rate_period"]);
  const normalized = rateType?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ?? "";

  if (normalized.includes("month") || normalized.includes("mensal") || normalized.includes("a.m")) {
    return "monthly";
  }

  if ("interest_rate_monthly_pct" in record || "interest_rate_monthly" in record) {
    return "monthly";
  }

  return "annual";
};

const normalizeConfidenceLevel = (value: unknown): ContractImportConfidence => {
  const raw = typeof value === "string" ? value.toLowerCase().trim() : "";

  if (raw === "high" || raw === "medium" || raw === "low") {
    return raw;
  }

  return "unknown";
};

const readFieldConfidence = (record: JsonRecord, key: string): ContractImportConfidence | undefined => {
  const wrapped = record[key];

  if (isRecord(wrapped) && "confidence" in wrapped) {
    return normalizeConfidenceLevel(wrapped.confidence);
  }

  return undefined;
};

const normalizeConfidence = (record: JsonRecord): Record<string, ContractImportConfidence> => {
  const confidenceRecord = isRecord(record.confidence) ? record.confidence : {};
  const confidence: Record<string, ContractImportConfidence> = {};

  for (const key of Object.keys(CONTRACT_IMPORT_CONFIDENCE_LABELS)) {
    const level = normalizeConfidenceLevel(confidenceRecord[key]);
    confidence[key] = level !== "unknown" ? level : readFieldConfidence(record, key) ?? "unknown";
  }

  return confidence;
};

const normalizeGuaranteeType = (value?: string): GuaranteeType => {
  const normalized = value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ?? "";

  if (normalized.includes("imovel") || normalized.includes("hipotec")) return "imovel";
  if (normalized.includes("veicul")) return "veiculo";
  if (normalized.includes("equip")) return "equipamento";
  if (normalized.includes("fianca")) return "fianca";
  if (normalized.includes("aval")) return "aval";
  if (normalized.includes("receb")) return "recebiveis";

  return "outros";
};

const normalizeGuarantees = (value: unknown): DebtGuaranteeInput[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): DebtGuaranteeInput | undefined => {
      if (typeof item === "string") {
        return { type: "outros", value: 0, description: item.trim() || undefined };
      }

      if (!isRecord(item)) {
        return undefined;
      }

      const description = readString(item, ["description", "descricao", "name", "title"]);
      const type = normalizeGuaranteeType(readString(item, ["type", "tipo"]));
      const valueAmount = readNumber(item, ["value_brl", "valor_brl", "value", "valor", "amount"]);

      return {
        type,
        value: valueAmount ?? 0,
        description: type === "outros" ? description : undefined,
      };
    })
    .filter((guarantee): guarantee is DebtGuaranteeInput => Boolean(guarantee));
};

const getContractRecords = (payload: unknown): JsonRecord[] => {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const contracts = Array.isArray(payload.contracts) ? payload.contracts.filter(isRecord) : [];
  const rawContracts = Array.isArray(payload._raw) ? payload._raw.filter(isRecord) : [];

  if (contracts.length === 0) {
    return [];
  }

  return contracts.map((contract, index) => ({
    ...contract,
    ...(rawContracts[index] ?? {}),
  }));
};

const normalizeContract = (record: JsonRecord, index: number): ContractImportDraft => {
  const bank = readString(record, ["bank", "bank_name", "institution", "instituicao"]);
  const financedAmount = readNumber(record, ["financed_amount_brl", "valor_financiado_brl", "financed_amount"]);
  const firstDueDate = readDate(record, ["first_due_date", "primeiro_vencimento", "first_installment_date"]);
  const lastDueDate = readDate(record, ["last_due_date", "ultimo_vencimento", "maturity_date", "due_date"]);
  const interestBase = normalizeInterestBase(readString(record, ["interest_base", "indexer", "indexador"]));
  const rawInterestRate = getRawValue(record, [
    "interest_rate_annual_pct",
    "interest_rate_monthly_pct",
    "interest_rate",
    "taxa_juros",
  ]);
  const interestRate = rawInterestRate ? parseNumber(rawInterestRate.value) : undefined;

  if (!bank) {
    throw new Error(`Contrato ${index + 1}: banco não informado no JSON.`);
  }

  if (!financedAmount || financedAmount <= 0) {
    throw new Error(`Contrato ${index + 1}: valor financiado inválido ou ausente.`);
  }

  if (!firstDueDate || !lastDueDate) {
    throw new Error(`Contrato ${index + 1}: datas de vencimento inválidas ou ausentes.`);
  }

  const iofAmount = readNumber(record, ["iof_total_brl", "iof_amount_brl", "iof_amount"]);
  const iofRate = readNumber(record, ["iof_rate", "iof_rate_pct"]);
  const additionalFees = readNumber(record, ["tac_brl", "additional_fees_brl", "additional_fees"]);
  const title = readString(record, ["title", "contract_title"]) ?? bank;
  const description = readString(record, ["description", "contract_number", "numero_contrato"]);
  const interestType = normalizeInterestType(record);

  return {
    debt: {
      bank,
      title,
      description,
      financed_amount: financedAmount,
      first_due_date: firstDueDate,
      last_due_date: lastDueDate,
      calculation_table: normalizeCalculationTable(readString(record, ["calculation_table", "tabela_calculo"])),
      interest_base: interestBase,
      interest_rate: interestRate ?? 0,
      interest_type: interestType,
      spread_rate: readNumber(record, ["spread_rate_annual_pct", "spread_rate", "spread_pct"]),
      iof_rate:
        iofAmount != null && financedAmount > 0
          ? Number(((iofAmount / financedAmount) * 100).toFixed(6))
          : iofRate,
      additional_fees: additionalFees,
      indexer_start_date: readDate(record, ["indexer_start_date", "data_inicio_indexador"]),
    },
    guarantees: normalizeGuarantees(record.guarantees),
    confidence: normalizeConfidence(record),
    notes: readString(record, ["notes", "observations", "observacoes"]),
    sourceName: readString(record, ["source_name", "file_name", "arquivo"]),
  };
};

export const parseContractImportJson = (jsonText: string): ContractImportDraft[] => {
  let payload: unknown;

  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new Error("O arquivo selecionado não é um JSON válido.");
  }

  const records = getContractRecords(payload);
  if (records.length === 0) {
    throw new Error("Nenhum contrato foi encontrado no JSON. Use um array ou um objeto com a chave contracts.");
  }

  return records.map(normalizeContract);
};

export const getLowConfidenceFields = (confidence: Record<string, ContractImportConfidence>): string[] =>
  Object.entries(confidence)
    .filter(([, level]) => level === "low")
    .map(([key]) => CONTRACT_IMPORT_CONFIDENCE_LABELS[key] ?? key);
