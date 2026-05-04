import { useState, useEffect, useCallback } from 'react';

const CHANGE_EVENT = 'debt-vista-temporary-scenario-change';

export interface TemporaryScenario {
  cdiAdjustment: number;
  selicAdjustment: number;
  ipcaAdjustment: number;
}

let currentScenario: TemporaryScenario | null = null;

export function useTemporaryScenario() {
  const [scenario, setScenario] = useState<TemporaryScenario | null>(currentScenario);

  useEffect(() => {
    const handleScenarioChange = (event: Event) => {
      const customEvent = event as CustomEvent<TemporaryScenario | null>;
      setScenario(customEvent.detail ?? null);
    };

    window.addEventListener(CHANGE_EVENT, handleScenarioChange);

    return () => {
      window.removeEventListener(CHANGE_EVENT, handleScenarioChange);
    };
  }, []);

  const saveScenario = useCallback((newScenario: TemporaryScenario | null) => {
    currentScenario = newScenario;
    setScenario(newScenario);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: newScenario }));
  }, []);

  const toOverrides = useCallback(() => {
    if (!scenario) return [];
    const overrides = [];
    if (scenario.cdiAdjustment !== 0) {
      overrides.push({ indexType: 'CDI', adjustmentBp: scenario.cdiAdjustment });
    }
    if (scenario.selicAdjustment !== 0) {
      overrides.push({ indexType: 'SELIC', adjustmentBp: scenario.selicAdjustment });
    }
    if (scenario.ipcaAdjustment !== 0) {
      overrides.push({ indexType: 'IPCA', adjustmentBp: scenario.ipcaAdjustment });
    }
    return overrides;
  }, [scenario]);

  const scenarioSignature = scenario
    ? `${scenario.cdiAdjustment}:${scenario.selicAdjustment}:${scenario.ipcaAdjustment}`
    : 'base';

  return {
    scenario,
    scenarioSignature,
    saveScenario,
    toOverrides,
  };
}
