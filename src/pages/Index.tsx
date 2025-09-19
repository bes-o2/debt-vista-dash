import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, PieChart, BarChart3, Calculator, ArrowLeft, LogOut, Building, Filter, X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { CompactDebtCard } from "@/components/CompactDebtCard";
import { DebtForm } from "@/components/DebtForm";
import { Debt, DebtInput } from "@/hooks/useDebts";
import { DashboardStats } from "@/components/DashboardStats";
import { DebtChart } from "@/components/DebtChart";
import { OutstandingBalanceChart } from "@/components/OutstandingBalanceChart";
import { DebtProfileChart } from "@/components/DebtProfileChart";
import { NetDebtCard } from "@/components/NetDebtCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { AmortizationTable } from "@/components/AmortizationTable";
import { Card, CardContent } from "@/components/ui/card";
import { CashFlowAnalysis } from "@/components/CashFlowAnalysis";
import { ConsolidatedAmortizationTable } from "@/components/ConsolidatedAmortizationTable";
import { GlobalFilters } from "@/components/GlobalFilters";
import { useToast } from "@/hooks/use-toast";
import { SettingsButton } from "@/components/SettingsButton";
import { CompanySelector } from "@/components/CompanySelector";
import { useCompany } from "@/hooks/useCompany";
import { useDebts, type LegacyDebt } from "@/hooks/useDebts";
const Index = () => {
  const { signOut } = useAuth();
  const { selectedCompany } = useCompany();
  const { 
    debts: dbDebts, 
    isLoading: isLoadingDebts, 
    createDebt, 
    updateDebt, 
    deleteDebt,
    convertToLegacyFormat,
    migrateLegacyData
  } = useDebts();

  // Convert database debts to legacy format for backward compatibility - memoized to prevent infinite recalculation
  const debts: LegacyDebt[] = useMemo(() => dbDebts.map(convertToLegacyFormat), [dbDebts, convertToLegacyFormat]);

  // Check for localStorage data and offer migration
  useEffect(() => {
    const legacyData = localStorage.getItem('debts');
    if (legacyData && selectedCompany && debts.length === 0) {
      // Show migration prompt
      const shouldMigrate = window.confirm(
        'Detectamos dados de dívidas salvos localmente. Deseja migrar estes dados para o banco de dados da empresa selecionada?'
      );
      if (shouldMigrate) {
        migrateLegacyData();
      }
    }
  }, [selectedCompany, debts.length, migrateLegacyData]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | undefined>(undefined);
  const [selectedDebt, setSelectedDebt] = useState<LegacyDebt | null>(null);
  const [selectedDebtsForTable, setSelectedDebtsForTable] = useState<string[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [preSelectedDebtForAnalysis, setPreSelectedDebtForAnalysis] = useState<LegacyDebt | null>(null);

  // Global filters state
  const [globalSelectedBank, setGlobalSelectedBank] = useState<string>("all");
  const [globalSelectedCalculationType, setGlobalSelectedCalculationType] = useState<string>("all");
  const [globalSelectedDebts, setGlobalSelectedDebts] = useState<string[]>([]);
  const [globalStartDate, setGlobalStartDate] = useState<Date | undefined>(undefined);
  const [globalEndDate, setGlobalEndDate] = useState<Date | undefined>(undefined);

  // Filter debts by selected bank
  const filteredDebts = useMemo(() => (
    selectedBank === "all" ? debts : debts.filter(debt => debt.bank === selectedBank)
  ), [debts, selectedBank]);
  
  // Group filtered debts by bank for the multi-select
  const debtsByBank = useMemo(() => {
    return filteredDebts.reduce((acc, debt) => {
      if (!acc[debt.bank]) {
        acc[debt.bank] = [];
      }
      acc[debt.bank].push(debt);
      return acc;
    }, {} as Record<string, LegacyDebt[]>);
  }, [filteredDebts]);
  
  const selectedDebtsObjects = useMemo(() => (
    selectedDebtsForTable
      .map(debtId => filteredDebts.find(d => d.id === debtId))
      .filter(Boolean) as LegacyDebt[]
  ), [selectedDebtsForTable, filteredDebts]);
  
  const { toast } = useToast();
  
  const handleSaveDebt = (debtData: DebtInput) => {
    if (!selectedCompany) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa antes de cadastrar dívidas.",
        variant: "destructive",
      });
      return;
    }

    if (editingDebt) {
      updateDebt({ id: editingDebt.id, ...debtData });
    } else {
      createDebt(debtData);
    }
    
    setEditingDebt(undefined);
    setIsFormOpen(false);
  };
  const handleEditDebt = (legacyDebt: LegacyDebt) => {
    // Convert from legacy to database format
    const dbDebt = dbDebts.find(d => d.id === legacyDebt.id);
    if (dbDebt) {
      setEditingDebt(dbDebt);
      setIsFormOpen(true);
    }
  };
  
  const handleViewTable = (debt: LegacyDebt) => {
    setSelectedDebt(debt);
    setActiveTab("table");
  };
  
  const handleViewAnalysis = (debt: LegacyDebt) => {
    setPreSelectedDebtForAnalysis(debt);
    setActiveTab("analysis");
  };
  const handleNewDebt = () => {
    setEditingDebt(undefined);
    setIsFormOpen(true);
  };
  const handleClearGlobalFilters = () => {
    setGlobalSelectedBank("all");
    setGlobalSelectedCalculationType("all");
    setGlobalSelectedDebts([]);
    setGlobalStartDate(undefined);
    setGlobalEndDate(undefined);
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);

  const handleDebtToggleForTable = (debtId: string, checked: boolean) => {
    if (checked) {
      setSelectedDebtsForTable([...selectedDebtsForTable, debtId]);
    } else {
      setSelectedDebtsForTable(selectedDebtsForTable.filter(id => id !== debtId));
    }
  };

  const handleSelectAllDebtsForTable = () => {
    if (selectedDebtsForTable.length === filteredDebts.length) {
      setSelectedDebtsForTable([]);
    } else {
      setSelectedDebtsForTable(filteredDebts.map(debt => debt.id));
    }
  };
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-primary text-primary-foreground">
                  <Calculator className="h-6 w-6" />
                </div>
                Análise de Endividamento
              </h1>
              
            </div>
            <div className="flex items-center gap-3">
              <CompanySelector />
              <Button onClick={() => setActiveTab("dashboard")} variant="outline" className="hover:bg-accent">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Dashboard
              </Button>
              <SettingsButton />
              <ThemeToggle />
              <Button onClick={signOut} variant="outline" className="hover:bg-accent">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="debts" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Cadastros
            </TabsTrigger>
            <TabsTrigger value="table" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Tabela
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Fluxo de Pagamento
            </TabsTrigger>
          </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
              {/* Global Filters */}
              <GlobalFilters 
                debts={debts} 
                selectedBank={globalSelectedBank} 
                selectedCalculationType={globalSelectedCalculationType} 
                selectedDebts={globalSelectedDebts}
                startDate={globalStartDate}
                endDate={globalEndDate}
                onBankChange={setGlobalSelectedBank} 
                onCalculationTypeChange={setGlobalSelectedCalculationType} 
                onDebtsChange={setGlobalSelectedDebts}
                onStartDateChange={setGlobalStartDate}
                onEndDateChange={setGlobalEndDate}
                onClearFilters={handleClearGlobalFilters} 
              />
              
              <DashboardStats debts={debts} selectedBank={globalSelectedBank} selectedCalculationType={globalSelectedCalculationType} selectedDebts={globalSelectedDebts} />
              
              {/* Outstanding Balance by Bank */}
              <OutstandingBalanceChart debts={debts} />
              
              {/* Debt Profile Chart */}
              <DebtProfileChart debts={debts} />
              
              {/* Net Debt Calculation */}
              <NetDebtCard debts={debts} />
              
              <DebtChart debts={debts} />
            </TabsContent>

          <TabsContent value="debts" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl text-foreground font-bold">Dívidas Cadastradas</h2>
                <p className="text-muted-foreground">
                  {debts.length} dívida{debts.length !== 1 ? 's' : ''} cadastrada{debts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button onClick={handleNewDebt} className="bg-gradient-primary hover:opacity-90 shadow-elegant">
                <Plus className="mr-2 h-4 w-4" />
                Nova Dívida
              </Button>
            </div>

            {isLoadingDebts ? (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-between mb-4">
                  <Calculator className="h-12 w-12 text-muted-foreground animate-pulse" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Carregando dívidas...
                </h3>
                <p className="text-muted-foreground">
                  Aguarde enquanto buscamos suas dívidas cadastradas
                </p>
              </div>
            ) : debts.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Calculator className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Nenhuma dívida cadastrada
                </h3>
                <p className="text-muted-foreground mb-6">
                  {selectedCompany 
                    ? "Comece adicionando suas primeiras dívidas para análise"
                    : "Selecione uma empresa e comece adicionando dívidas"
                  }
                </p>
                {selectedCompany && (
                  <Button onClick={handleNewDebt} className="bg-gradient-primary hover:opacity-90">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Primeira Dívida
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Group debts by bank */}
                {Object.entries(
                  debts.reduce((groups, debt) => {
                    const bankName = debt.bank || 'Sem Banco';
                    if (!groups[bankName]) {
                      groups[bankName] = [];
                    }
                    groups[bankName].push(debt);
                    return groups;
                  }, {} as Record<string, typeof debts>)
                ).map(([bankName, bankDebts]) => (
                  <div key={bankName} className="space-y-3">
                    <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                      <div className="p-2 rounded-lg bg-gradient-primary text-white">
                        <Building className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {bankName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {bankDebts.length} dívida{bankDebts.length !== 1 ? 's' : ''} • Total: {
                            new Intl.NumberFormat('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL',
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            }).format(
                              bankDebts.reduce((sum, debt) => sum + debt.financedAmount, 0)
                            )
                          }
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {bankDebts.map(debt => (
                        <CompactDebtCard 
                          key={debt.id} 
                          debt={debt}
                          onEdit={(debtData) => handleEditDebt(debt)}
                          onViewTable={(debtData) => handleViewTable(debt)}
                          onViewAnalysis={(debtData) => handleViewAnalysis(debt)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="table" className="space-y-6">
            <div className="flex flex-col gap-4">
              <h2 className="text-3xl font-bold tracking-tight">Tabela de Amortização</h2>
              
              {/* Filters Section */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Bank Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Filtrar por Banco</Label>
                  <Select value={selectedBank} onValueChange={setSelectedBank}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos os bancos" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border shadow-lg z-50">
                      <SelectItem value="all">Todos os bancos</SelectItem>
                      {Array.from(new Set(debts.map(debt => debt.bank))).map(bank => <SelectItem key={bank} value={bank}>
                          {bank}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Start Date Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Data Inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {globalStartDate ? format(globalStartDate, "dd/MM/yyyy") : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={globalStartDate}
                        onSelect={setGlobalStartDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* End Date Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Data Final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {globalEndDate ? format(globalEndDate, "dd/MM/yyyy") : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={globalEndDate}
                        onSelect={setGlobalEndDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Debt Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Selecionar Dívidas</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                        disabled={filteredDebts.length === 0}
                      >
                        {selectedDebtsForTable.length === 0
                          ? filteredDebts.length > 0 ? "Selecione dívidas..." : "Nenhuma dívida disponível"
                          : selectedDebtsForTable.length === filteredDebts.length
                          ? "Todas selecionadas"
                          : `${selectedDebtsForTable.length} selecionada${selectedDebtsForTable.length !== 1 ? 's' : ''}`}
                        <Filter className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 bg-background border border-border shadow-lg z-50">
                      <Command>
                        <CommandInput placeholder="Buscar dívida..." />
                        <CommandEmpty>Nenhuma dívida encontrada.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={handleSelectAllDebtsForTable}>
                            <Checkbox 
                              checked={selectedDebtsForTable.length === filteredDebts.length}
                              className="mr-2"
                            />
                            <span className="font-medium">
                              {selectedDebtsForTable.length === filteredDebts.length ? "Desmarcar todas" : "Selecionar todas"}
                            </span>
                          </CommandItem>
                        </CommandGroup>
                        {Object.entries(debtsByBank).map(([bankName, bankDebts]) => (
                          <CommandGroup key={bankName} heading={bankName}>
                            {bankDebts.map((debt) => {
                              const contractDisplay = debt.contractNumber || `CT${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
                              const monthlyRate = debt.interestType === 'monthly' ? debt.interestRate : (Math.pow(1 + debt.interestRate / 100, 1 / 12) - 1) * 100;
                              const annualRate = debt.interestType === 'annual' ? debt.interestRate : (Math.pow(1 + debt.interestRate / 100, 12) - 1) * 100;
                              
                              return (
                                <CommandItem
                                  key={debt.id}
                                  onSelect={() => handleDebtToggleForTable(debt.id, !selectedDebtsForTable.includes(debt.id))}
                                >
                                  <Checkbox 
                                    checked={selectedDebtsForTable.includes(debt.id)}
                                    className="mr-2"
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      Contrato {contractDisplay}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      {formatCurrency(debt.financedAmount)} • {monthlyRate.toFixed(3)}% a.m
                                    </span>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        ))}
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            {selectedDebtsForTable.length > 0 ? 
              <ConsolidatedAmortizationTable 
                debts={selectedDebtsObjects}
                startDate={globalStartDate}
                endDate={globalEndDate}
              />
              : <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Selecione uma ou mais dívidas para visualizar a tabela consolidada de amortização.
                    </p>
                  </div>
                </CardContent>
              </Card>}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <CashFlowAnalysis debts={debts} preSelectedDebt={preSelectedDebtForAnalysis} onClearPreSelection={() => setPreSelectedDebtForAnalysis(null)} />
          </TabsContent>
        </Tabs>
      </main>

      <DebtForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSave={handleSaveDebt} debt={editingDebt} />
    </div>;
};
export default Index;