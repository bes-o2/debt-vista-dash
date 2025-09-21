import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter, X, CalendarIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
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
  onClearFilters
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

  const hasActiveFilters = selectedBank !== "all" || selectedCalculationType !== "all" || selectedDebts.length > 0 || startDate || endDate;

  return (
    <div className="rounded-3xl bg-card p-6 border border-border mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-2xl bg-primary/10">
          <Filter className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Filtros Globais</h3>
          <p className="text-muted-foreground">
            Configure os filtros para personalizar sua análise
          </p>
        </div>
      </div>

      {/* Filters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
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

        {/* Start Date Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Data Inicial</label>
          <input
            type="date"
            value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
            onChange={(e) => onStartDateChange(e.target.value ? new Date(e.target.value) : undefined)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="dd/mm/aaaa"
          />
        </div>

        {/* End Date Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Data Final</label>
          <input
            type="date"
            value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
            onChange={(e) => onEndDateChange(e.target.value ? new Date(e.target.value) : undefined)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Filtros ativos:</span>
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
          {startDate && (
            <Badge variant="secondary" className="gap-1">
              Data Inicial: {format(startDate, "dd/MM/yyyy")}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => onStartDateChange(undefined)}
              />
            </Badge>
          )}
          {endDate && (
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

      {/* Filter Summary */}
      <div className="text-sm text-muted-foreground">
        Exibindo {selectedDebts.length > 0 ? selectedDebts.length : debts.length} de {debts.length} dívida{debts.length !== 1 ? 's' : ''} cadastrada{debts.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};