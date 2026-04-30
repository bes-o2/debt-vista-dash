import {
  ChevronDown,
  ChevronUp,
  EyeOff,
  RotateCcw,
  Settings2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  DashboardWidgetConfigKey,
  DashboardWidgetConfig,
  DashboardWidgetModel,
} from "@/components/dashboard/dashboardWidgetTypes";

interface DashboardWidgetShellProps {
  widget: DashboardWidgetModel;
  children: ReactNode;
  canMoveUp: boolean;
  canMoveDown: boolean;
  unstyled?: boolean;
  bankOptions?: string[];
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleCollapsed: () => void;
  onHide: () => void;
  onConfigChange: (config: DashboardWidgetConfig) => void;
  onResetConfig: () => void;
}

const hasConfig = (widget: DashboardWidgetModel, key: DashboardWidgetConfigKey) =>
  widget.definition.settingsSchema.includes(key);

export function DashboardWidgetShell({
  widget,
  children,
  canMoveUp,
  canMoveDown,
  unstyled = false,
  bankOptions = [],
  onMoveUp,
  onMoveDown,
  onToggleCollapsed,
  onHide,
  onConfigChange,
  onResetConfig,
}: DashboardWidgetShellProps) {
  const { definition, state } = widget;
  const title = state.config.title?.trim() || definition.title;
  const density = state.config.density ?? "default";
  const contentId = `dashboard-widget-${definition.id}`;

  return (
    <section
      className={cn(
        "group/widget",
        !unstyled &&
          "rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-[box-shadow] duration-200 hover:shadow-md",
      )}
      aria-labelledby={`${contentId}-title`}
    >
      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
          unstyled ? "pb-1" : "border-b border-border/60 px-5 py-4",
        )}
      >
        <div className="min-w-0">
          <h2
            id={`${contentId}-title`}
            className="text-base font-semibold leading-tight text-foreground"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {definition.description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 transition-transform active:scale-[0.96]"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Mover ${title} para cima`}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 transition-transform active:scale-[0.96]"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Mover ${title} para baixo`}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          {definition.canCollapse && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 transition-transform active:scale-[0.96]"
              onClick={onToggleCollapsed}
              aria-expanded={!state.collapsed}
              aria-controls={contentId}
              aria-label={state.collapsed ? `Expandir ${title}` : `Recolher ${title}`}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  !state.collapsed && "rotate-180",
                )}
              />
            </Button>
          )}
          <WidgetSettingsPopover
            widget={widget}
            bankOptions={bankOptions}
            onConfigChange={onConfigChange}
            onResetConfig={onResetConfig}
          />
          {definition.canHide && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground transition-transform hover:text-foreground active:scale-[0.96]"
              onClick={onHide}
              aria-label={`Ocultar ${title}`}
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!state.collapsed && (
        <div
          id={contentId}
          className={cn(
            unstyled ? "pt-3" : density === "compact" ? "p-4" : "p-5",
          )}
        >
          {children}
        </div>
      )}
    </section>
  );
}

interface WidgetSettingsPopoverProps {
  widget: DashboardWidgetModel;
  bankOptions: string[];
  onConfigChange: (config: DashboardWidgetConfig) => void;
  onResetConfig: () => void;
}

function WidgetSettingsPopover({
  widget,
  bankOptions,
  onConfigChange,
  onResetConfig,
}: WidgetSettingsPopoverProps) {
  const { definition, state } = widget;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 transition-transform active:scale-[0.96]"
          aria-label={`Configurar ${state.config.title?.trim() || definition.title}`}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 border border-border bg-popover p-4 shadow-lg"
      >
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Configurações do card
            </h3>
            <p className="text-xs text-muted-foreground">
              Ajustes locais salvos para esta empresa.
            </p>
          </div>

          {hasConfig(widget, "title") && (
            <div className="space-y-2">
              <Label htmlFor={`${definition.id}-title`} className="text-xs">
                Título local
              </Label>
              <Input
                id={`${definition.id}-title`}
                value={state.config.title ?? ""}
                placeholder={definition.title}
                onChange={(event) =>
                  onConfigChange({ title: event.target.value })
                }
              />
            </div>
          )}

          {hasConfig(widget, "density") && (
            <div className="space-y-2">
              <Label className="text-xs">Densidade</Label>
              <Select
                value={state.config.density ?? "default"}
                onValueChange={(value) =>
                  onConfigChange({
                    density: value as DashboardWidgetConfig["density"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Densidade" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="default">Padrão</SelectItem>
                  <SelectItem value="compact">Compacta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {hasConfig(widget, "horizon") && (
            <div className="space-y-2">
              <Label className="text-xs">Horizonte</Label>
              <Select
                value={state.config.horizon ?? "12m"}
                onValueChange={(value) =>
                  onConfigChange({
                    horizon: value as DashboardWidgetConfig["horizon"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Horizonte" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="12m">12 meses</SelectItem>
                  <SelectItem value="24m">24 meses</SelectItem>
                  <SelectItem value="total">Total</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {hasConfig(widget, "viewMode") && (
            <div className="space-y-2">
              <Label className="text-xs">Visão</Label>
              <Select
                value={state.config.viewMode ?? "total"}
                onValueChange={(value) =>
                  onConfigChange({
                    viewMode: value as DashboardWidgetConfig["viewMode"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Visão" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="atual">Atual</SelectItem>
                  <SelectItem value="total">Total</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {hasConfig(widget, "filters") && (
            <div className="space-y-3">
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs">Banco do card</Label>
                <Select
                  value={state.config.bankFilter ?? "all"}
                  onValueChange={(value) => onConfigChange({ bankFilter: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Banco" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todos os bancos</SelectItem>
                    {bankOptions.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Sistema de amortização</Label>
                <Select
                  value={state.config.calculationTypeFilter ?? "all"}
                  onValueChange={(value) =>
                    onConfigChange({ calculationTypeFilter: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sistema" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todos os sistemas</SelectItem>
                    <SelectItem value="SAC">SAC</SelectItem>
                    <SelectItem value="PRICE">PRICE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2 transition-transform active:scale-[0.96]"
            onClick={onResetConfig}
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar padrões
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
