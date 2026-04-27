import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DashboardWidgetConfig,
  DashboardWidgetDefinition,
  DashboardWidgetModel,
  DashboardWidgetState,
} from "@/components/dashboard/dashboardWidgetTypes";

const STORAGE_VERSION = 1;

interface StoredDashboardWidgets {
  version: number;
  widgets: DashboardWidgetState[];
}

const buildDefaultState = (
  definition: DashboardWidgetDefinition,
): DashboardWidgetState => ({
  id: definition.id,
  collapsed: false,
  visible: true,
  config: {
    density: "default",
    bankFilter: "all",
    calculationTypeFilter: "all",
    ...definition.defaultConfig,
  },
});

const mergeConfig = (
  definition: DashboardWidgetDefinition,
  savedConfig?: DashboardWidgetConfig,
) => ({
  density: "default" as const,
  bankFilter: "all",
  calculationTypeFilter: "all",
  ...definition.defaultConfig,
  ...savedConfig,
});

const buildLayout = (
  definitions: DashboardWidgetDefinition[],
  storedWidgets?: DashboardWidgetState[],
) => {
  if (!storedWidgets) {
    return definitions.map(buildDefaultState);
  }

  const definitionsById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const storedById = new Map(storedWidgets.map((widget) => [widget.id, widget]));
  const orderedIds = [
    ...storedWidgets.map((widget) => widget.id),
    ...definitions
      .map((definition) => definition.id)
      .filter((id) => !storedById.has(id)),
  ];

  return orderedIds.flatMap((id) => {
    const definition = definitionsById.get(id);
    if (!definition) return [];

    const saved = storedById.get(id);
    return {
      id,
      collapsed: saved?.collapsed ?? false,
      visible: saved?.visible ?? true,
      config: mergeConfig(definition, saved?.config),
    };
  });
};

const readStoredLayout = (
  storageKey: string,
  definitions: DashboardWidgetDefinition[],
) => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return buildLayout(definitions);

    const parsed = JSON.parse(raw) as StoredDashboardWidgets;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.widgets)) {
      return buildLayout(definitions);
    }

    return buildLayout(definitions, parsed.widgets);
  } catch (error) {
    console.error("Error reading dashboard widgets layout:", error);
    return buildLayout(definitions);
  }
};

const writeStoredLayout = (storageKey: string, widgets: DashboardWidgetState[]) => {
  const payload: StoredDashboardWidgets = {
    version: STORAGE_VERSION,
    widgets,
  };

  window.localStorage.setItem(storageKey, JSON.stringify(payload));
};

export function useDashboardWidgets(
  definitions: DashboardWidgetDefinition[],
  userId?: string,
  companyId?: string,
) {
  const definitionsSignature = useMemo(
    () => definitions.map((definition) => definition.id).join("|"),
    [definitions],
  );
  const defaultConfigSignature = useMemo(
    () =>
      definitions
        .map((definition) => `${definition.id}:${JSON.stringify(definition.defaultConfig ?? {})}`)
        .join("|"),
    [definitions],
  );
  const definitionsRef = useRef(definitions);
  const storageKey = userId && companyId
    ? `debt-vista-dashboard-widgets:v${STORAGE_VERSION}:${userId}:${companyId}`
    : null;
  const skipNextPersist = useRef(false);
  const [layout, setLayout] = useState<DashboardWidgetState[]>(() =>
    buildLayout(definitions),
  );

  useEffect(() => {
    definitionsRef.current = definitions;
  }, [definitions]);

  useEffect(() => {
    const currentDefinitions = definitionsRef.current;
    skipNextPersist.current = true;
    setLayout(
      storageKey
        ? readStoredLayout(storageKey, currentDefinitions)
        : buildLayout(currentDefinitions),
    );
  }, [storageKey, definitionsSignature, defaultConfigSignature]);

  useEffect(() => {
    if (!storageKey) return;

    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }

    try {
      writeStoredLayout(storageKey, layout);
    } catch (error) {
      console.error("Error saving dashboard widgets layout:", error);
    }
  }, [storageKey, layout]);

  const widgets = useMemo<DashboardWidgetModel[]>(() => {
    const definitionsById = new Map(
      definitions.map((definition) => [definition.id, definition]),
    );

    return layout.flatMap((state) => {
      const definition = definitionsById.get(state.id);
      return definition ? [{ definition, state }] : [];
    });
  }, [definitions, layout]);

  const moveWidget = (id: string, direction: "up" | "down") => {
    setLayout((current) => {
      const visibleIndexes = current
        .map((widget, index) => ({ widget, index }))
        .filter(({ widget }) => widget.visible)
        .map(({ index }) => index);
      const visiblePosition = visibleIndexes.findIndex(
        (index) => current[index].id === id,
      );
      const targetPosition =
        direction === "up" ? visiblePosition - 1 : visiblePosition + 1;

      if (
        visiblePosition === -1 ||
        targetPosition < 0 ||
        targetPosition >= visibleIndexes.length
      ) {
        return current;
      }

      const next = [...current];
      const fromIndex = visibleIndexes[visiblePosition];
      const toIndex = visibleIndexes[targetPosition];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  };

  const updateWidget = (
    id: string,
    patch: Partial<Omit<DashboardWidgetState, "id" | "config">> & {
      config?: DashboardWidgetConfig;
    },
  ) => {
    setLayout((current) =>
      current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              ...patch,
              config: patch.config
                ? { ...widget.config, ...patch.config }
                : widget.config,
            }
          : widget,
      ),
    );
  };

  const resetWidgetConfig = (id: string) => {
    const definition = definitions.find((item) => item.id === id);
    if (!definition) return;

    updateWidget(id, {
      config: mergeConfig(definition),
    });
  };

  const resetLayout = () => {
    setLayout(buildLayout(definitions));
  };

  return {
    widgets,
    moveWidget,
    updateWidget,
    resetWidgetConfig,
    resetLayout,
  };
}
