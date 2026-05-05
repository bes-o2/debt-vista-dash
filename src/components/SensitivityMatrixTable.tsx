import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { SensitivityMatrix } from "@/lib/sensitivityMatrix";

interface SensitivityMatrixTableProps {
  matrix: SensitivityMatrix;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const deltaFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
  signDisplay: "always",
});

function getHeatmapClass(deltaRatio: number): string {
  const abs = Math.abs(deltaRatio);
  if (abs < 0.001) return "";

  if (deltaRatio > 0) {
    if (abs >= 0.05) return "bg-red-500/[0.18] dark:bg-red-400/[0.26]";
    if (abs >= 0.025) return "bg-red-500/[0.12] dark:bg-red-400/[0.20]";
    if (abs >= 0.01) return "bg-red-500/[0.08] dark:bg-red-400/[0.14]";
    return "bg-red-500/[0.04] dark:bg-red-400/[0.08]";
  }

  if (abs >= 0.05) return "bg-emerald-500/[0.18] dark:bg-emerald-400/[0.26]";
  if (abs >= 0.025) return "bg-emerald-500/[0.12] dark:bg-emerald-400/[0.20]";
  if (abs >= 0.01) return "bg-emerald-500/[0.08] dark:bg-emerald-400/[0.14]";
  return "bg-emerald-500/[0.04] dark:bg-emerald-400/[0.08]";
}

const STICKY_LEFT_SHADOW =
  "shadow-[2px_0_4px_-2px_hsl(var(--border)/0.6)]";
const STICKY_TOP_SHADOW =
  "shadow-[0_2px_4px_-2px_hsl(var(--border)/0.6)]";

export const SensitivityMatrixTable = ({ matrix }: SensitivityMatrixTableProps) => {
  const baseRow = matrix.rows[matrix.baseRowIndex];

  const baseByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    if (baseRow) {
      baseRow.cells.forEach((cell) => {
        map[cell.monthKey] = cell.totalPMT;
      });
    }
    return map;
  }, [baseRow]);

  return (
    <div className="relative max-h-[640px] overflow-auto rounded-lg border border-border/60 bg-card">
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead>
          <tr>
            <th
              scope="col"
              className={cn(
                "sticky left-0 top-0 z-30 border-b border-r border-border/60 bg-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                STICKY_LEFT_SHADOW,
              )}
            >
              Choque
            </th>
            {matrix.columns.map((column) => (
              <th
                key={column.monthKey}
                scope="col"
                className={cn(
                  "sticky top-0 z-20 border-b border-border/60 bg-muted px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap",
                  STICKY_TOP_SHADOW,
                )}
              >
                {column.monthLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row, rowIndex) => {
            const isBase = rowIndex === matrix.baseRowIndex;

            return (
              <tr
                key={`${row.shockValue}-${rowIndex}`}
                className="group transition-colors"
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 border-b border-r border-border/60 px-3 py-2 text-left text-xs font-medium whitespace-nowrap",
                    STICKY_LEFT_SHADOW,
                    isBase
                      ? "bg-primary/[0.08] text-foreground"
                      : "bg-card text-muted-foreground group-hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(isBase && "font-semibold text-foreground")}>
                      {row.shockLabel}
                    </span>
                    {isBase && (
                      <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                        Base
                      </span>
                    )}
                  </div>
                </th>
                {row.cells.map((cell) => {
                  const baseValue = baseByMonth[cell.monthKey] ?? 0;
                  const delta = cell.totalPMT - baseValue;
                  const deltaRatio = baseValue > 0 ? delta / baseValue : 0;
                  const heatmap = isBase ? "" : getHeatmapClass(deltaRatio);

                  return (
                    <td
                      key={cell.monthKey}
                      className={cn(
                        "border-b border-border/30 px-3 py-2 text-right whitespace-nowrap transition-colors",
                        isBase && "bg-primary/[0.04]",
                        heatmap,
                        !isBase && "group-hover:bg-muted/30",
                      )}
                    >
                      <div className="flex flex-col items-end gap-0.5 leading-tight">
                        <span
                          className={cn(
                            "text-foreground",
                            isBase && "font-semibold",
                          )}
                        >
                          {currencyFormatter.format(cell.totalPMT)}
                        </span>
                        {!isBase && Math.abs(delta) >= 0.5 && (
                          <span
                            className={cn(
                              "text-[10px] font-medium tabular-nums",
                              delta > 0
                                ? "text-red-700/80 dark:text-red-400/90"
                                : "text-emerald-700/80 dark:text-emerald-400/90",
                              )}
                          >
                            {deltaFormatter.format(delta)}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
