/**
 * Central tooltip registry for the application
 * This file enforces documentation of all components and features
 */

export enum TooltipKeys {
  // Dashboard Stats
  TOTAL_FINANCED = "dashboard.stats.totalFinanced",
  CURRENT_PAYMENT = "dashboard.stats.currentPayment", 
  AVERAGE_RATE = "dashboard.stats.averageRate",
  UPCOMING_DUE = "dashboard.stats.upcomingDue",
  AVERAGE_SPREAD = "dashboard.stats.averageSpread",
  
  // Debt Management
  DEBT_ADD = "debt.actions.add",
  DEBT_EDIT = "debt.actions.edit",
  DEBT_DELETE = "debt.actions.delete",
  DEBT_VIEW = "debt.actions.view",
  
  // Filters
  FILTER_BANK = "filters.bank",
  FILTER_DATE = "filters.date",
  FILTER_TYPE = "filters.type",
  
  // Charts
  CHART_DEBT_PROFILE = "charts.debtProfile",
  CHART_OUTSTANDING_BALANCE = "charts.outstandingBalance",
  CHART_CASH_FLOW = "charts.cashFlow",
  
  // Settings
  SETTINGS_THEME = "settings.theme",
  SETTINGS_LANGUAGE = "settings.language",
  SETTINGS_NOTIFICATIONS = "settings.notifications",
}

export const TOOLTIP_REGISTRY: Record<TooltipKeys, string> = {
  // Dashboard Stats
  [TooltipKeys.TOTAL_FINANCED]: "Soma de todos os valores financiados dos contratos selecionados",
  [TooltipKeys.CURRENT_PAYMENT]: "Valor total das parcelas mensais (PMT) dos contratos ativos no período atual",
  [TooltipKeys.AVERAGE_RATE]: "Taxa de juros média mensal ponderada dos contratos selecionados",
  [TooltipKeys.UPCOMING_DUE]: "Quantidade de contratos com vencimento nos próximos 30 dias",
  [TooltipKeys.AVERAGE_SPREAD]: "Diferença média entre o CET dos contratos e a taxa CDI atual",
  
  // Debt Management
  [TooltipKeys.DEBT_ADD]: "Adicionar novo contrato de dívida ao sistema",
  [TooltipKeys.DEBT_EDIT]: "Editar informações do contrato selecionado",
  [TooltipKeys.DEBT_DELETE]: "Remover permanentemente o contrato do sistema",
  [TooltipKeys.DEBT_VIEW]: "Visualizar detalhes completos do contrato",
  
  // Filters
  [TooltipKeys.FILTER_BANK]: "Filtrar contratos por instituição financeira",
  [TooltipKeys.FILTER_DATE]: "Filtrar contratos por período de vencimento",
  [TooltipKeys.FILTER_TYPE]: "Filtrar por tipo de sistema de amortização (SAC/PRICE)",
  
  // Charts
  [TooltipKeys.CHART_DEBT_PROFILE]: "Visualização do perfil de vencimento das dívidas ao longo do tempo",
  [TooltipKeys.CHART_OUTSTANDING_BALANCE]: "Evolução do saldo devedor total dos contratos",
  [TooltipKeys.CHART_CASH_FLOW]: "Análise de fluxo de caixa projetado dos pagamentos",
  
  // Settings
  [TooltipKeys.SETTINGS_THEME]: "Alternar entre tema claro e escuro",
  [TooltipKeys.SETTINGS_LANGUAGE]: "Configurar idioma da interface",
  [TooltipKeys.SETTINGS_NOTIFICATIONS]: "Configurar alertas e notificações do sistema",
};

/**
 * Hook to get tooltip text by key
 * Forces developers to register tooltips before using them
 */
export const useTooltip = (key: TooltipKeys): string => {
  const tooltip = TOOLTIP_REGISTRY[key];
  
  if (!tooltip) {
    throw new Error(`Tooltip não registrado para a chave: ${key}. Registre no TOOLTIP_REGISTRY primeiro.`);
  }
  
  return tooltip;
};

/**
 * Type for components that require tooltip documentation
 * Use this interface to enforce tooltip props
 */
export interface RequiresTooltip {
  tooltipKey: TooltipKeys;
}

/**
 * Higher-order component type that enforces tooltip documentation
 */
export type WithTooltip<T = {}> = T & RequiresTooltip;

/**
 * Utility to validate tooltip registration at build time
 * Add this to your component props to enforce documentation
 */
export const validateTooltip = (key: TooltipKeys): void => {
  if (!(key in TOOLTIP_REGISTRY)) {
    throw new Error(`Tooltip obrigatório não registrado: ${key}`);
  }
};