import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { ProjectionRefreshControl } from "@/components/ProjectionRefreshControl";

interface Debt {
  id: string;
  financedAmount: number;
  releaseDate: string;
  dueDate: string;
  calculationTable: 'SAC' | 'PRICE';
  indexer?: string;
  interestRate: number;
  interestType: 'monthly' | 'annual';
  iofAmount?: number;
  tacAmount?: number;
  bank: string;
  contractNumber?: string;
}

interface GlobalFiltersProps {
  debts: Debt[];
  selectedBank: string;
  selectedCalculationType: string;
  selectedDebts: string[];
  onBankChange: (bank: string) => void;
  onCalculationTypeChange: (type: string) => void;
  onDebtsChange: (debtIds: string[]) => void;
  onClearFilters: () => void;
}

export const GlobalFilters = ({
  debts,
  selectedBank,
  selectedCalculationType,
  selectedDebts,
  onBankChange,
  onCalculationTypeChange,
  onDebtsChange,
  onClearFilters,
}: GlobalFiltersProps) => {
  const [debtSelectorOpen, setDebtSelectorOpen] = useState(false);

  const availableBanks = useMemo(() => {
    return [...new Set(debts.map(debt => debt.bank))];
  }, [debts]);

  const debtsByBank = useMemo(() => {
    return debts.reduce((acc, debt) => {
      if (!acc[debt.bank]) acc[debt.bank] = [];
      acc[debt.bank].push(debt);
      return acc;
    }, {} as Record<string, typeof debts>);
  }, [debts]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleDebtToggle = (debtId: string, checked: boolean) => {
    if (checked) {
      onDebtsChange([...selectedDebts, debtId]);
    } else {
      onDebtsChange(selectedDebts.filter(id => id !== debtId));
    }
  };

  const handleSelectAllDebts = () => {
    if (selectedDebts.length === debts.length) {
      onDebtsChange([]);
    } else {
      onDebtsChange(debts.map(debt => debt.id));
    }
  };

  const hasActiveFilters = selectedBank !== "all" || selectedCalculationType !== "all" || selectedDebts.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="px-5 py-4">
        <div className="mb-4 flex justify-end">
          <ProjectionRefreshControl />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

          {/* Banco */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Banco</label>
            <Select value={selectedBank} onValueChange={onBankChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os bancos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os bancos</SelectItem>
                {availableBanks.map((bank) => (
                  <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sistema de Amortização */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Sistema de Amortização</label>
            <Select value={selectedCalculationType} onValueChange={onCalculationTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os sistemas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os sistemas</SelectItem>
                <SelectItem value="SAC">SAC</SelectItem>
                <SelectItem value="PRICE">PRICE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dívidas Específicas */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Dívidas Específicas</label>
            <Popover open={debtSelectorOpen} onOpenChange={setDebtSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={debtSelectorOpen}
                  className="w-full justify-between transition-transform active:scale-[0.96]"
                >
                  <span className="tabular-nums">
                    {selectedDebts.length === 0
                      ? "Todas as dívidas"
                      : selectedDebts.length === debts.length
                      ? "Todas selecionadas"
                      : `${selectedDebts.length} selecionada${selectedDebts.length !== 1 ? 's' : ''}`}
                  </span>
                  <Filter className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Buscar dívida..." />
                  <CommandEmpty>Nenhuma dívida encontrada.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={handleSelectAllDebts}>
                      <Checkbox
                        checked={selectedDebts.length === debts.length}
                        className="mr-2"
                      />
                      <span className="font-medium">
                        {selectedDebts.length === debts.length ? "Desmarcar todas" : "Selecionar todas"}
                      </span>
                    </CommandItem>
                    {Object.entries(debtsByBank).map(([bankName, bankDebts]) => (
                      <CommandGroup key={bankName} heading={bankName}>
                        {bankDebts.map((debt) => (
                          <CommandItem
                            key={debt.id}
                            onSelect={() => handleDebtToggle(debt.id, !selectedDebts.includes(debt.id))}
                          >
                            <Checkbox
                              checked={selectedDebts.includes(debt.id)}
                              className="mr-2"
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{debt.calculationTable}</span>
                              <span className="text-sm text-muted-foreground tabular-nums">
                                {formatCurrency(debt.financedAmount)}
                                {debt.contractNumber && ` • ${debt.contractNumber}`}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 px-5 py-3">
          <span className="text-xs font-medium text-muted-foreground">Ativos:</span>

          {selectedBank !== "all" && (
            <Badge variant="secondary" className="gap-1 pl-2.5 pr-1">
              Banco: {selectedBank}
              <button
                type="button"
                onClick={() => onBankChange("all")}
                aria-label="Remover filtro de banco"
                className="-mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:text-destructive active:scale-[0.96]"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {selectedCalculationType !== "all" && (
            <Badge variant="secondary" className="gap-1 pl-2.5 pr-1">
              Sistema: {selectedCalculationType}
              <button
                type="button"
                onClick={() => onCalculationTypeChange("all")}
                aria-label="Remover filtro de sistema"
                className="-mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:text-destructive active:scale-[0.96]"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {selectedDebts.length > 0 && selectedDebts.length < debts.length && (
            <Badge variant="secondary" className="gap-1 pl-2.5 pr-1 tabular-nums">
              <span className="tabular-nums">{selectedDebts.length}</span> dívida{selectedDebts.length !== 1 ? 's' : ''}
              <button
                type="button"
                onClick={() => onDebtsChange([])}
                aria-label="Remover filtro de dívidas"
                className="-mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:text-destructive active:scale-[0.96]"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-7 px-2 text-xs text-muted-foreground transition-transform hover:text-foreground active:scale-[0.96]"
          >
            Limpar tudo
          </Button>
        </div>
      )}
    </div>
  );
};
