import type { ReactNode } from "react";

export type DashboardWidgetSize = "full" | "wide" | "half";
export type DashboardWidgetDensity = "default" | "compact";
export type DashboardWidgetHorizon = "12m" | "24m" | "total";
export type DashboardWidgetViewMode = "atual" | "total";

export type DashboardWidgetConfigKey =
  | "title"
  | "horizon"
  | "viewMode"
  | "density"
  | "filters";

export interface DashboardWidgetConfig {
  title?: string;
  horizon?: DashboardWidgetHorizon;
  viewMode?: DashboardWidgetViewMode;
  density?: DashboardWidgetDensity;
  bankFilter?: string;
  calculationTypeFilter?: string;
}

export interface DashboardWidgetDefinition {
  id: string;
  title: string;
  description: string;
  defaultSize: DashboardWidgetSize;
  allowedConfigs: DashboardWidgetConfigKey[];
  defaultConfig?: DashboardWidgetConfig;
  component: (
    state: DashboardWidgetState,
    context: DashboardWidgetRenderContext,
  ) => ReactNode;
}

export interface DashboardWidgetState {
  id: string;
  collapsed: boolean;
  visible: boolean;
  config: DashboardWidgetConfig;
}

export interface DashboardWidgetModel {
  definition: DashboardWidgetDefinition;
  state: DashboardWidgetState;
}

export interface DashboardWidgetRenderContext {
  updateConfig: (config: DashboardWidgetConfig) => void;
}

export const dashboardWidgetSizeClass: Record<DashboardWidgetSize, string> = {
  full: "lg:col-span-12",
  wide: "lg:col-span-8",
  half: "lg:col-span-6",
};
