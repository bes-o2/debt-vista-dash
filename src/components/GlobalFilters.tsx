import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { DateInput } from "@/components/ui/date-input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  startDate: Date | undefined;
  endDate: Date | undefined;
  onBankChange: (bank: string) => void;
  onCalculationTypeChange: (type: string) => void;
  onDebtsChange: (debtIds: string[]) => void;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onClearFilters: () => void;
  hideDateFilters?: boolean;
  periodMode?: "vigencia" | "vencimento";
  onPeriodModeChange?: (mode: "vigencia" | "vencimento") => void;
}

export const GlobalFilters = ({
  debts,
  selectedBank,
  selectedCalculationType,
  selectedDebts,
  startDate,
  endDate,
  onBankChange,
  onCalculationTypeChange,
  onDebtsChange,
  onStartDateChange,
  onEndDateChange,
  onClearFilters,
  hideDateFilters = false,
  periodMode,
  onPeriodModeChange,
}: GlobalFiltersProps) => {
  const [debtSelectorOpen, setDebtSelectorOpen] = useState(false);

  // Get unique banks
  const availableBanks = useMemo(() => {
    return [...new Set(debts.map(debt => debt.bank))];
  }, [debts]);

  // Group debts by bank
  const debtsByBank = useMemo(() => {
    return debts.reduce((acc, debt) => {
      if (!acc[debt.bank]) {
        acc[debt.bank] = [];
      }
      acc[debt.bank].push(debt);
      return acc;
    }, {} as Record<string, typeof debts>);
  }, [debts]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);

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

  const hasActiveFilters = selectedBank !== "all" || selectedCalculationType !== "all" || selectedDebts.length > 0 || (!hideDateFilters && (startDate || endDate));

  return (
    <div className="rounded-xl bg-card px-5 py-4 border border-border">
      {/* Filters Grid */}
      <div className={cn("grid grid-cols-1 gap-3", hideDateFilters ? "md:grid-cols-3" : "md:grid-cols-6")}>
        {/* Bank Filter */}
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

        {/* Calculation Type Filter */}
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

        {/* Debt Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Dívidas Específicas</label>
          <Popover open={debtSelectorOpen} onOpenChange={setDebtSelectorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={debtSelectorOpen}
                className="w-full justify-between"
              >
                {selectedDebts.length === 0
                  ? "Todas as dívidas"
                  : selectedDebts.length === debts.length
                  ? "Todas selecionadas"
                  : `${selectedDebts.length} selecionada${selectedDebts.length !== 1 ? 's' : ''}`}
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
                            <span className="font-medium">
                              {debt.calculationTable}
                            </span>
                            <span className="text-sm text-muted-foreground">
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

        {!hideDateFilters && (
          <>
            {/* Start Date Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Data Inicial</label>
              <DateInput
                value={startDate}
                onChange={onStartDateChange}
                placeholder="dd/mm/aaaa"
              />
            </div>

            {/* End Date Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Data Final</label>
              <DateInput
                value={endDate}
                onChange={onEndDateChange}
                minDate={startDate}
                placeholder="dd/mm/aaaa"
              />
            </div>

            {/* Clear Dates Button */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  onStartDateChange(undefined);
                  onEndDateChange(undefined);
                }}
                className="w-full"
                disabled={!startDate && !endDate}
              >
                <X className="h-4 w-4 mr-2" />
                Zerar Datas
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Period Mode Toggle */}
      {!hideDateFilters && onPeriodModeChange && (
        <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
          <label className="text-sm font-medium text-foreground">Semântica do período</label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={periodMode === "vigencia" ? "default" : "outline"}
              onClick={() => onPeriodModeChange("vigencia")}
            >
              Vigência do contrato
            </Button>
            <Button
              type="button"
              size="sm"
              variant={periodMode === "vencimento" ? "default" : "outline"}
              onClick={() => onPeriodModeChange("vencimento")}
            >
              Vencimento de parcelas
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {periodMode === "vigencia"
              ? "Contratos com vigência que inclui o período"
              : "Contratos com parcelas vencendo no período"}
          </p>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-border/40">
          <span className="text-xs font-medium text-muted-foreground">Ativos:</span>
          {selectedBank !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Banco: {selectedBank}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => onBankChange("all")}
              />
            </Badge>
          )}
          {selectedCalculationType !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Sistema: {selectedCalculationType}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => onCalculationTypeChange("all")}
              />
            </Badge>
          )}
          {selectedDebts.length > 0 && selectedDebts.length < debts.length && (
            <Badge variant="secondary" className="gap-1">
              {selectedDebts.length} dívida{selectedDebts.length !== 1 ? 's' : ''}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => onDebtsChange([])}
              />
            </Badge>
          )}
          {!hideDateFilters && startDate && (
            <Badge variant="secondary" className="gap-1">
              Data Inicial: {format(startDate, "dd/MM/yyyy")}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => onStartDateChange(undefined)}
              />
            </Badge>
          )}
          {!hideDateFilters && endDate && (
            <Badge variant="secondary" className="gap-1">
              Data Final: {format(endDate, "dd/MM/yyyy")}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => onEndDateChange(undefined)}
              />
            </Badge>
          )}
        </div>
      )}

    </div>
  );
};