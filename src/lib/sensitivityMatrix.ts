import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface SensitivityDebtInstallments {
  debtId: string;
  installments: Array<{
    due_date: string;
    installment_amount: number;
  }>;
}

export interface SensitivityScenarioInput {
  shockValue: number;
  shockLabel: string;
  debtInstallments: SensitivityDebtInstallments[];
}

export interface SensitivityMatrixColumn {
  monthKey: string; // "2024-05"
  monthLabel: string; // "mai/2024"
}

export interface SensitivityMatrixCell {
  monthKey: string;
  totalPMT: number;
}

export interface SensitivityMatrixRow {
  shockLabel: string;
  shockValue: number;
  cells: SensitivityMatrixCell[];
}

export interface SensitivityMatrix {
  columns: SensitivityMatrixColumn[];
  rows: SensitivityMatrixRow[];
  baseRowIndex: number;
}

/**
 * Monta a matriz de sensibilidade a partir de parcelas simuladas por cenário.
 * Apenas parcelas dentro do horizonte de meses são consideradas.
 */
export function buildSensitivityMatrix(
  scenarios: SensitivityScenarioInput[],
  horizonMonths: number,
  referenceDate: Date = new Date()
): SensitivityMatrix {
  const columns: SensitivityMatrixColumn[] = [];
  const monthKeys: string[] = [];

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();

  for (let i = 0; i < horizonMonths; i++) {
    const d = new Date(refYear, refMonth + i, 1);
    const monthKey = format(d, 'yyyy-MM');
    const monthLabel = format(d, 'MMM/yyyy', { locale: ptBR });
    columns.push({ monthKey, monthLabel });
    monthKeys.push(monthKey);
  }

  const rows: SensitivityMatrixRow[] = scenarios.map((scenario) => {
    const pmtByMonth: Record<string, number> = {};
    monthKeys.forEach((mk) => {
      pmtByMonth[mk] = 0;
    });

    for (const debt of scenario.debtInstallments) {
      for (const inst of debt.installments) {
        const dueDate = inst.due_date;
        if (!dueDate || dueDate.length < 7) continue;
        const monthKey = dueDate.slice(0, 7); // "yyyy-MM"
        if (monthKey in pmtByMonth) {
          pmtByMonth[monthKey] += inst.installment_amount || 0;
        }
      }
    }

    const cells: SensitivityMatrixCell[] = monthKeys.map((mk) => ({
      monthKey: mk,
      totalPMT: Number((pmtByMonth[mk] ?? 0).toFixed(2)),
    }));

    return {
      shockLabel: scenario.shockLabel,
      shockValue: scenario.shockValue,
      cells,
    };
  });

  const baseRowIndex = rows.findIndex((r) => r.shockValue === 0);

  return {
    columns,
    rows,
    baseRowIndex: baseRowIndex >= 0 ? baseRowIndex : 0,
  };
}
