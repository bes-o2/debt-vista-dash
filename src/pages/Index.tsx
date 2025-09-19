import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, PieChart, BarChart3, Calculator, ArrowLeft, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { DebtCard } from "@/components/DebtCard";
import { DebtForm } from "@/components/DebtForm";
import { DashboardStats } from "@/components/DashboardStats";
import { DebtChart } from "@/components/DebtChart";
import { OutstandingBalanceChart } from "@/components/OutstandingBalanceChart";
import { DebtProfileChart } from "@/components/DebtProfileChart";
import { NetDebtCard } from "@/components/NetDebtCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AmortizationTable } from "@/components/AmortizationTable";
import { Card, CardContent } from "@/components/ui/card";
import { CashFlowAnalysis } from "@/components/CashFlowAnalysis";
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

  // Convert database debts to legacy format for backward compatibility
  const debts: LegacyDebt[] = dbDebts.map(convertToLegacyFormat);

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
  const [editingDebt, setEditingDebt] = useState<LegacyDebt | undefined>(undefined);
  const [selectedDebt, setSelectedDebt] = useState<LegacyDebt | null>(null);
  const [selectedBank, setSelectedBank] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [preSelectedDebtForAnalysis, setPreSelectedDebtForAnalysis] = useState<LegacyDebt | null>(null);

  // Global filters state
  const [globalSelectedBank, setGlobalSelectedBank] = useState<string>("all");
  const [globalSelectedCalculationType, setGlobalSelectedCalculationType] = useState<string>("all");
  const [globalSelectedDebts, setGlobalSelectedDebts] = useState<string[]>([]);

  // Filter debts by selected bank
  const filteredDebts = selectedBank === "all" ? debts : debts.filter(debt => debt.bank === selectedBank);
  const { toast } = useToast();
  
  const handleSaveDebt = (debtData: Omit<LegacyDebt, 'id'>) => {
    if (!selectedCompany) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa antes de cadastrar dívidas.",
        variant: "destructive",
      });
      return;
    }

    // Convert legacy format to new format
    const newDebtData = {
      title: debtData.contractNumber || `Contrato ${debtData.bank}`,
      description: `Contrato do ${debtData.bank}`,
      financed_amount: debtData.financedAmount,
      first_due_date: debtData.releaseDate,
      last_due_date: debtData.dueDate,
      calculation_table: debtData.calculationTable,
      interest_base: debtData.indexer || 'Pré-fixado',
      interest_rate: debtData.interestRate,
      interest_type: debtData.interestType,
      iof_rate: debtData.iofAmount || 0,
      additional_fees: debtData.tacAmount || 0,
    };

    if (editingDebt) {
      updateDebt({ id: editingDebt.id, ...newDebtData });
    } else {
      createDebt(newDebtData);
    }
    
    setEditingDebt(undefined);
    setIsFormOpen(false);
  };
  const handleEditDebt = (debt: LegacyDebt) => {
    setEditingDebt(debt);
    setIsFormOpen(true);
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
              <GlobalFilters debts={debts} selectedBank={globalSelectedBank} selectedCalculationType={globalSelectedCalculationType} selectedDebts={globalSelectedDebts} onBankChange={setGlobalSelectedBank} onCalculationTypeChange={setGlobalSelectedCalculationType} onDebtsChange={setGlobalSelectedDebts} onClearFilters={handleClearGlobalFilters} />
              
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
              <div className="space-y-4">
                {debts.map(debt => <DebtCard key={debt.id} debt={debt} onEdit={handleEditDebt} onViewTable={handleViewTable} onViewAnalysis={handleViewAnalysis} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="table" className="space-y-6">
            <div className="flex flex-col gap-4">
              <h2 className="text-3xl font-bold tracking-tight">Tabela de Amortização</h2>
              
              {/* Filters Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {/* Debt Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Selecionar Dívida</Label>
                  <Select value={selectedDebt?.id || ""} onValueChange={debtId => {
                  const debt = filteredDebts.find(d => d.id === debtId);
                  if (debt) setSelectedDebt(debt);
                }} disabled={filteredDebts.length === 0}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={filteredDebts.length > 0 ? "Selecione uma dívida..." : "Nenhuma dívida disponível"} />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border shadow-lg z-50">
                      {filteredDebts.map(debt => {
                      const contractDisplay = debt.contractNumber || `CT${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
                      const monthlyRate = debt.interestType === 'monthly' ? debt.interestRate : (Math.pow(1 + debt.interestRate / 100, 1 / 12) - 1) * 100;
                      const annualRate = debt.interestType === 'annual' ? debt.interestRate : (Math.pow(1 + debt.interestRate / 100, 12) - 1) * 100;
                      return <SelectItem key={debt.id} value={debt.id} className="hover:bg-accent">
                            <div className="text-left">
                              <div className="font-medium">
                                Contrato {contractDisplay} | {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(debt.financedAmount)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {monthlyRate.toFixed(3)}% a.m // {annualRate.toFixed(2)}% a.a
                              </div>
                            </div>
                          </SelectItem>;
                    })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {selectedDebt ? <AmortizationTable debt={selectedDebt} /> : <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Selecione uma dívida para visualizar sua tabela de amortização.
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