import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InstallmentRateRef {
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

const SOURCE_LABELS: Record<string, string> = {
  bcb_realizado: 'BCB realizado',
  projecao_base: 'Projeção base',
  cenario_temporario: 'Cenário temporário',
};

export function formatRateRefSource(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function useInstallmentRateRefs(debtId: string | undefined) {
  const [refsByInstallment, setRefsByInstallment] = useState<Map<number, InstallmentRateRef>>(new Map());

  useEffect(() => {
    if (!debtId) return;

    supabase
      .from('debt_installment_rate_refs')
      .select('installment_number, index_type, period_start, period_end, rate, rate_type, source, scenario_label, source_reference_date')
      .eq('debt_id', debtId)
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<number, InstallmentRateRef>();
        for (const ref of data) {
          map.set(ref.installment_number, ref as InstallmentRateRef);
        }
        setRefsByInstallment(map);
      });
  }, [debtId]);

  return refsByInstallment;
}
