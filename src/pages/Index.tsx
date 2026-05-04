import { useState, useEffect, useMemo, useRef, useCallback, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, PieChart, BarChart3, Calculator, LogOut, Filter, X, CalendarIcon, Upload, Eye, RotateCcw } from "lucide-react";
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
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { CompanySelector } from "@/components/CompanySelector";
import { useCompany } from "@/hooks/useCompany";
import { useDebts, type LegacyDebt } from "@/hooks/useDebts";
import { useDebtGuarantees, type DebtGuaranteeInput } from "@/hooks/useDebtGuarantees";
import { Logo } from "@/components/Logo";
import { useDataInitialization } from "@/hooks/useDataInitialization";
import { normalizeDebtForCalculation } from "@/lib/debtUtils";
import { getLowConfidenceFields, parseContractImportJson, type ContractImportDraft } from "@/lib/contractImport";
import { supabase } from "@/integrations/supabase/client";
import { DashboardWidgetShell } from "@/components/dashboard/DashboardWidgetShell";
import { CardFeedbackMenu, type FeedbackTarget } from "@/components/CardFeedbackMenu";
import type {
  DashboardWidgetConfig,
  DashboardWidgetDefinition,
  DashboardWidgetHorizon,
  DashboardWidgetViewMode,
} from "@/components/dashboard/dashboardWidgetTypes";
import { dashboardWidgetSizeClass } from "@/components/dashboard/dashboardWidgetTypes";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";

const getWidgetHorizon = (config: DashboardWidgetConfig): DashboardWidgetHorizon =>
  config.horizon === "24m" || config.horizon === "total" ? config.horizon : "12m";

const getWidgetViewMode = (config: DashboardWidgetConfig): DashboardWidgetViewMode =>
  config.viewMode === "atual" ? "atual" : "total";

const Index = () => {
  const {
    signOut,
    user
  } = useAuth();
  const {
    selectedCompany
  } = useCompany();
  const {
    debts: dbDebts,
    isLoading: isLoadingDebts,
    createDebtAsync,
    updateDebtAsync,
    deleteDebtAsync,
    convertToLegacyFormat,
    migrateLegacyData
  } = useDebts();
  const { saveGuarantees } = useDebtGuarantees();
  
  const {
    isInitialized,
    initializeHistoricalData,
    initializeProjections
  } = useDataInitialization();
  
  // Initialize economic data and projections once
  // DISABLED: Caused infinite 401 errors due to dependency array re-creating functions
  // Re-enable when: (1) useDataInitialization returns stable function refs, or (2) move to manual trigger
  // useEffect(() => {
  //   if (!isInitialized) {
  //     initializeHistoricalData();
  //     initializeProjections();
  //   }
  // }, [isInitialized, initializeHistoricalData, initializeProjections]);

  // Convert database debts to legacy format for backward compatibility - memoized to prevent infinite recalculation
  const debts: LegacyDebt[] = useMemo(() => dbDebts.map(convertToLegacyFormat), [dbDebts, convertToLegacyFormat]);

  const normalizedDebts = useMemo(() => debts.map(normalizeDebtForCalculation), [debts]);

  // Check for localStorage data and offer migration
  useEffect(() => {
    const legacyData = localStorage.getItem('debts');
    if (legacyData && selectedCompany && debts.length === 0) {
      // Show migration prompt
      const shouldMigrate = window.confirm('Detectamos dados de dívidas salvos localmente. Deseja migrar estes dados para o banco de dados da empresa selecionada?');
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
  const [draftDebtId, setDraftDebtId] = useState<string | null>(null);
  const [importDrafts, setImportDrafts] = useState<ContractImportDraft[]>([]);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const currentImportDraft = importDrafts[currentImportIndex];

  // Global filters state
  const [globalSelectedBank, setGlobalSelectedBank] = useState<string>("all");
  const [globalSelectedCalculationType, setGlobalSelectedCalculationType] = useState<string>("all");
  const [globalSelectedDebts, setGlobalSelectedDebts] = useState<string[]>([]);
  const [globalStartDate, setGlobalStartDate] = useState<Date | undefined>(undefined);
  const [globalEndDate, setGlobalEndDate] = useState<Date | undefined>(undefined);

  // Filter debts by selected bank
  const filteredDebts = useMemo(() => selectedBank === "all" ? debts : debts.filter(debt => debt.bank === selectedBank), [debts, selectedBank]);

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
  const selectedDebtsObjects = useMemo(() => selectedDebtsForTable.map(debtId => filteredDebts.find(d => d.id === debtId)).filter(Boolean) as LegacyDebt[], [selectedDebtsForTable, filteredDebts]);
  const {
    toast
  } = useToast();
  const sanitizeGuarantees = (guarantees: DebtGuaranteeInput[]) => {
    return guarantees
      .map((guarantee) => ({
        type: guarantee.type,
        value: guarantee.value,
        description: guarantee.description?.trim() || undefined,
      }))
      .filter((guarantee) => guarantee.value > 0);
  };
  const syncDebtInstallments = async (debtId: string, debtData: DebtInput, companyId: string) => {
    const iofAmount = debtData.iof_rate != null
      ? (debtData.financed_amount * debtData.iof_rate) / 100
      : 0;

    const { error } = await supabase.functions.invoke("calculate-amortization", {
      body: {
        debtId,
        companyId,
        financedAmount: debtData.financed_amount,
        firstDueDate: debtData.first_due_date,
        lastDueDate: debtData.last_due_date,
        calculationTable: debtData.calculation_table,
        interestRate: debtData.interest_rate,
        interestType: debtData.interest_type,
        indexer: debtData.interest_base,
        spreadRate: debtData.spread_rate,
        indexerStartDate: debtData.indexer_start_date,
        iofAmount,
        tacAmount: debtData.additional_fees || 0,
        persist: true,
      }
    });

    if (error) {
      throw error;
    }
  };
  const handleSaveDebt = async (debtData: DebtInput, guarantees: DebtGuaranteeInput[]) => {
    if (!selectedCompany) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa antes de cadastrar dívidas.",
        variant: "destructive"
      });
      throw new Error("Selecione uma empresa antes de cadastrar dividas.");
    }

    const sanitizedGuarantees = sanitizeGuarantees(guarantees);
    const targetDebtId = editingDebt?.id || draftDebtId;
    const savedDebt = targetDebtId
      ? await updateDebtAsync({
          id: targetDebtId,
          ...debtData
        })
      : await createDebtAsync(debtData);

    try {
      await syncDebtInstallments(savedDebt.id, debtData, selectedCompany.id);
      await saveGuarantees({
        debtId: savedDebt.id,
        companyId: savedDebt.company_id,
        guarantees: sanitizedGuarantees,
      });
    } catch (error) {
      if (!targetDebtId) {
        setDraftDebtId(savedDebt.id);
      }

      throw new Error(
        error instanceof Error
          ? `A divida foi salva, mas houve um erro ao sincronizar parcelas ou garantias: ${error.message}`
          : "A divida foi salva, mas houve um erro ao sincronizar parcelas ou garantias."
      );
    }

    setDraftDebtId(null);
    setEditingDebt(undefined);

    const isImportReview = importDrafts.length > 0 && !editingDebt;
    if (isImportReview && currentImportIndex < importDrafts.length - 1) {
      setCurrentImportIndex((index) => index + 1);
      setIsFormOpen(true);
      toast({
        title: "Contrato salvo",
        description: "O próximo contrato importado foi carregado para revisão.",
      });
      return;
    }

    if (isImportReview) {
      setImportDrafts([]);
      setCurrentImportIndex(0);
    }

    setIsFormOpen(false);
  };
  const handleEditDebt = (legacyDebt: LegacyDebt) => {
    // Convert from legacy to database format
    const dbDebt = dbDebts.find(d => d.id === legacyDebt.id);
    if (dbDebt) {
      setImportDrafts([]);
      setCurrentImportIndex(0);
      setDraftDebtId(null);
      setEditingDebt(dbDebt);
      setIsFormOpen(true);
    }
  };
  const handleViewTable = (debt: LegacyDebt) => {
    setSelectedDebt(debt);
    setSelectedDebtsForTable([debt.id]);
    setSelectedBank(debt.bank);
    setActiveTab("table");
  };
  const handleViewAnalysis = (debt: LegacyDebt) => {
    setPreSelectedDebtForAnalysis(debt);
    setActiveTab("analysis");
  };
  const handleDeleteDebt = async (legacyDebt: LegacyDebt) => {
    try {
      await deleteDebtAsync(legacyDebt.id);
      toast({
        title: "Sucesso",
        description: "Contrato excluído com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o contrato.",
        variant: "destructive",
      });
    }
  };
  const handleNewDebt = () => {
    setImportDrafts([]);
    setCurrentImportIndex(0);
    setEditingDebt(undefined);
    setDraftDebtId(null);
    setIsFormOpen(true);
  };
  const handleCloseDebtForm = () => {
    setIsFormOpen(false);
    setEditingDebt(undefined);
    setDraftDebtId(null);
    setImportDrafts([]);
    setCurrentImportIndex(0);
  };
  const handleImportJsonClick = () => {
    if (!selectedCompany) {
      toast({
        title: "Selecione uma empresa",
        description: "Escolha a empresa ativa antes de importar contratos.",
        variant: "destructive",
      });
      return;
    }

    importFileInputRef.current?.click();
  };
  const handleImportJsonChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const drafts = parseContractImportJson(await file.text());
      setImportDrafts(drafts);
      setCurrentImportIndex(0);
      setEditingDebt(undefined);
      setDraftDebtId(null);
      setActiveTab("debts");
      setIsFormOpen(true);
      toast({
        title: "JSON importado",
        description: `${drafts.length} contrato${drafts.length !== 1 ? "s" : ""} carregado${drafts.length !== 1 ? "s" : ""} para revisão.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao importar JSON",
        description: error instanceof Error ? error.message : "Verifique o arquivo e tente novamente.",
        variant: "destructive",
      });
    }
  };
  const handleClearGlobalFilters = useCallback(() => {
    setGlobalSelectedBank("all");
    setGlobalSelectedCalculationType("all");
    setGlobalSelectedDebts([]);
  }, []);

  const dashboardBankOptions = useMemo(
    () =>
      Array.from(new Set(debts.map((debt) => debt.bank).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [debts],
  );

  const applyDashboardWidgetFilters = useCallback(
    (sourceDebts: LegacyDebt[], config: DashboardWidgetConfig) => {
      const bankFilter = config.bankFilter ?? "all";
      const calculationTypeFilter = config.calculationTypeFilter ?? "all";

      return sourceDebts.filter((debt) => {
        const globalBankMatch =
          globalSelectedBank === "all" || debt.bank === globalSelectedBank;
        const globalCalculationTypeMatch =
          globalSelectedCalculationType === "all" ||
          debt.calculationTable === globalSelectedCalculationType;
        const globalDebtMatch =
          globalSelectedDebts.length === 0 ||
          globalSelectedDebts.includes(debt.id);
        const localBankMatch =
          bankFilter === "all" || debt.bank === bankFilter;
        const localCalculationTypeMatch =
          calculationTypeFilter === "all" ||
          debt.calculationTable === calculationTypeFilter;

        return (
          globalBankMatch &&
          globalCalculationTypeMatch &&
          globalDebtMatch &&
          localBankMatch &&
          localCalculationTypeMatch
        );
      });
    },
    [globalSelectedBank, globalSelectedCalculationType, globalSelectedDebts],
  );

  const getWidgetNormalizedDebts = useCallback(
    (config: DashboardWidgetConfig) => {
      const visibleDebtIds = new Set(
        applyDashboardWidgetFilters(debts, config).map((debt) => debt.id),
      );

      return normalizedDebts.filter((debt) => visibleDebtIds.has(debt.id));
    },
    [applyDashboardWidgetFilters, debts, normalizedDebts],
  );

  const dashboardWidgetDefinitions = useMemo<DashboardWidgetDefinition[]>(
    () => [
      {
        id: "resumo-executivo",
        title: "Resumo executivo",
        description: "KPIs principais da carteira e composição financeira.",
        defaultOrder: 10,
        defaultSize: "full",
        canCollapse: true,
        canHide: true,
        settingsSchema: ["title", "density", "filters"],
        allowedConfigs: ["title", "density", "filters"],
        component: (state) => (
          <DashboardStats
            startDate={globalStartDate}
            endDate={globalEndDate}
            periodMode="vigencia"
            selectedBank={state.config.bankFilter ?? globalSelectedBank}
            selectedCalculationType={state.config.calculationTypeFilter ?? globalSelectedCalculationType}
            selectedDebtIds={globalSelectedDebts.length > 0 ? globalSelectedDebts : undefined}
            onClearFilters={handleClearGlobalFilters}
            density={state.config.density ?? "default"}
          />
        ),
      },
      {
        id: "saldo-devedor-banco",
        title: "Saldo devedor por banco",
        description: "Evolução do saldo, PMT e alívio de caixa por credor.",
        defaultOrder: 20,
        defaultSize: "full",
        canCollapse: true,
        canHide: true,
        settingsSchema: ["title", "horizon", "density", "filters"],
        allowedConfigs: ["title", "horizon", "density", "filters"],
        defaultConfig: { horizon: "12m" },
        component: (state, context) => (
          <OutstandingBalanceChart
            debts={getWidgetNormalizedDebts(state.config)}
            startDate={globalStartDate}
            endDate={globalEndDate}
            horizon={getWidgetHorizon(state.config)}
            density={state.config.density ?? "default"}
            unstyled
            hideTitle
            onHorizonChange={(horizon) => context.updateConfig({ horizon })}
          />
        ),
      },
      {
        id: "perfil-divida",
        title: "Perfil da dívida",
        description: "Distribuição de amortização em curto e longo prazo.",
        defaultOrder: 30,
        defaultSize: "full",
        canCollapse: true,
        canHide: true,
        settingsSchema: ["title", "density", "filters"],
        allowedConfigs: ["title", "density", "filters"],
        component: (state) => (
          <DebtProfileChart
            debts={getWidgetNormalizedDebts(state.config)}
            startDate={globalStartDate}
            endDate={globalEndDate}
            density={state.config.density ?? "default"}
            unstyled
            hideTitle
          />
        ),
      },
      {
        id: "comparativo-bancos",
        title: "Comparativo por banco",
        description: "Saldo, juros financiados e CET por instituição.",
        defaultOrder: 40,
        defaultSize: "full",
        canCollapse: true,
        canHide: true,
        settingsSchema: ["title", "viewMode", "density", "filters"],
        allowedConfigs: ["title", "viewMode", "density", "filters"],
        defaultConfig: { viewMode: "total" },
        component: (state, context) => (
          <DebtChart
            debts={getWidgetNormalizedDebts(state.config)}
            selectedBank="all"
            startDate={globalStartDate}
            endDate={globalEndDate}
            viewType={getWidgetViewMode(state.config)}
            density={state.config.density ?? "default"}
            unstyled
            hideTitle
            onViewTypeChange={(viewMode) => context.updateConfig({ viewMode })}
          />
        ),
      },
    ],
    [
      applyDashboardWidgetFilters,
      debts,
      getWidgetNormalizedDebts,
      globalEndDate,
      globalStartDate,
      handleClearGlobalFilters,
    ],
  );

  const {
    widgets: dashboardWidgets,
    moveWidget: moveDashboardWidget,
    updateWidget: updateDashboardWidget,
    resetWidgetConfig,
    resetLayout: resetDashboardLayout,
  } = useDashboardWidgets(
    dashboardWidgetDefinitions,
    user?.id,
    selectedCompany?.id,
  );

  const visibleDashboardWidgets = dashboardWidgets.filter(
    (widget) => widget.state.visible,
  );
  const hiddenDashboardWidgets = dashboardWidgets.filter(
    (widget) => !widget.state.visible,
  );
  const feedbackTargets = useMemo<FeedbackTarget[]>(
    () => [
      ...dashboardWidgets.map((widget) => ({
        id: `dashboard:${widget.definition.id}`,
        title: widget.state.config.title?.trim() || widget.definition.title,
        area: "Dashboard",
        description: widget.definition.description,
        metadata: {
          source: "dashboard_widget",
          widget_id: widget.definition.id,
          visible: widget.state.visible,
          collapsed: widget.state.collapsed,
          global_bank_filter: globalSelectedBank,
          global_calculation_type_filter: globalSelectedCalculationType,
          global_selected_debts_count: globalSelectedDebts.length,
        },
      })),
      {
        id: "dashboard:filtros-globais",
        title: "Filtros globais",
        area: "Dashboard",
        metadata: {
          source: "dashboard_filter",
          global_bank_filter: globalSelectedBank,
          global_calculation_type_filter: globalSelectedCalculationType,
          global_selected_debts_count: globalSelectedDebts.length,
        },
      },
      {
        id: "cadastros:contratos",
        title: "Cards de dívidas cadastradas",
        area: "Cadastros",
        metadata: { source: "debt_cards" },
      },
      {
        id: "tabela:amortizacao",
        title: "Tabela de amortização",
        area: "Tabela",
        metadata: { source: "amortization_table" },
      },
      {
        id: "analise:fluxo-pagamento",
        title: "Fluxo de pagamento",
        area: "Fluxo de Pagamento",
        metadata: { source: "cash_flow_analysis" },
      },
    ],
    [
      dashboardWidgets,
      globalSelectedBank,
      globalSelectedCalculationType,
      globalSelectedDebts.length,
    ],
  );
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
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
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo size="md" />
              <h1 className="text-lg font-semibold text-foreground">
                Análise de Endividamento
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <CompanySelector />
              <SettingsButton />
              <ThemeToggle />
              <ChangePasswordDialog />
              <Button onClick={signOut} variant="outline" className="hover:bg-accent">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
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

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 transition-transform active:scale-[0.96]"
                  onClick={resetDashboardLayout}
                >
                  <RotateCcw className="h-4 w-4" />
                  Restaurar layout
                </Button>
              </div>

              {hiddenDashboardWidgets.length > 0 && (
                <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Widgets ocultos
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reative cards escondidos neste layout da empresa.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hiddenDashboardWidgets.map((widget) => (
                      <Button
                        key={widget.definition.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 transition-transform active:scale-[0.96]"
                        onClick={() =>
                          updateDashboardWidget(widget.state.id, { visible: true })
                        }
                      >
                        <Eye className="h-4 w-4" />
                        {widget.state.config.title?.trim() || widget.definition.title}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {visibleDashboardWidgets.map((widget, index) => (
                  <div
                    key={widget.definition.id}
                    className={dashboardWidgetSizeClass[widget.definition.defaultSize]}
                  >
                    <DashboardWidgetShell
                      widget={widget}
                      canMoveUp={index > 0}
                      canMoveDown={index < visibleDashboardWidgets.length - 1}
                      unstyled={widget.definition.id === "resumo-executivo"}
                      bankOptions={dashboardBankOptions}
                      onMoveUp={() => moveDashboardWidget(widget.state.id, "up")}
                      onMoveDown={() => moveDashboardWidget(widget.state.id, "down")}
                      onToggleCollapsed={() =>
                        updateDashboardWidget(widget.state.id, {
                          collapsed: !widget.state.collapsed,
                        })
                      }
                      onHide={() =>
                        updateDashboardWidget(widget.state.id, { visible: false })
                      }
                      onConfigChange={(config) =>
                        updateDashboardWidget(widget.state.id, { config })
                      }
                      onResetConfig={() => resetWidgetConfig(widget.state.id)}
                    >
                      {widget.definition.component(widget.state, {
                        updateConfig: (config) =>
                          updateDashboardWidget(widget.state.id, { config }),
                      })}
                    </DashboardWidgetShell>
                  </div>
                ))}
              </div>
            </TabsContent>

          <TabsContent value="debts" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl text-foreground font-bold">Dívidas Cadastradas</h2>
                <p className="text-muted-foreground">
                  {debts.length} dívida{debts.length !== 1 ? 's' : ''} cadastrada{debts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImportJsonChange}
                />
                <Button
                  onClick={handleImportJsonClick}
                  variant="outline"
                  className="h-11 rounded-xl border-border/70 bg-card px-5 text-foreground shadow-sm hover:bg-accent/60 hover:text-foreground"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Importar JSON
                </Button>
                <Button
                  onClick={handleNewDebt}
                  variant="outline"
                  className="h-11 rounded-xl border-border/70 bg-card px-5 text-foreground shadow-sm hover:bg-accent/60 hover:text-foreground"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Dívida
                </Button>
              </div>
            </div>

            {isLoadingDebts ? <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Calculator className="h-12 w-12 text-muted-foreground animate-pulse" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Carregando dívidas...
                </h3>
                <p className="text-muted-foreground">
                  Aguarde enquanto buscamos suas dívidas cadastradas
                </p>
              </div> : debts.length === 0 ? <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Calculator className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Nenhuma dívida cadastrada
                </h3>
                <p className="text-muted-foreground mb-6">
                  {selectedCompany ? "Comece adicionando suas primeiras dívidas para análise" : "Selecione uma empresa e comece adicionando dívidas"}
                </p>
                {selectedCompany && <Button
                    onClick={handleNewDebt}
                    variant="outline"
                    className="h-11 rounded-xl border-border/70 bg-card px-5 text-foreground shadow-sm hover:bg-accent/60 hover:text-foreground"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Primeira Dívida
                  </Button>}
              </div> : <div className="space-y-6">
                {/* Group debts by bank */}
                {Object.entries(debts.reduce((groups, debt) => {
              const bankName = debt.bank || 'Sem Banco';
              if (!groups[bankName]) {
                groups[bankName] = [];
              }
              groups[bankName].push(debt);
              return groups;
            }, {} as Record<string, typeof debts>)).map(([bankName, bankDebts]) => <div key={bankName} className="space-y-3">
                    <div className="pb-2 border-b border-border/50">
                      <h3 className="text-lg font-semibold text-foreground">
                        {bankName} <span className="text-sm text-muted-foreground font-normal">
                          {bankDebts.length} dívida{bankDebts.length !== 1 ? 's' : ''} • Total: {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(bankDebts.reduce((sum, debt) => sum + debt.financedAmount, 0))}
                        </span>
                      </h3>
                    </div>
                    <div className="grid gap-3">
                      {bankDebts.map(debt => <CompactDebtCard key={debt.id} debt={debt} onEdit={debtData => handleEditDebt(debt)} onDelete={debtData => handleDeleteDebt(debt)} onViewTable={debtData => handleViewTable(debt)} onViewAnalysis={debtData => handleViewAnalysis(debt)} />)}
                    </div>
                  </div>)}
              </div>}
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
                  <Label className="text-sm font-medium">Selecionar Dívidas</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between" disabled={filteredDebts.length === 0}>
                        {selectedDebtsForTable.length === 0 ? filteredDebts.length > 0 ? "Selecione dívidas..." : "Nenhuma dívida disponível" : selectedDebtsForTable.length === filteredDebts.length ? "Todas selecionadas" : `${selectedDebtsForTable.length} selecionada${selectedDebtsForTable.length !== 1 ? 's' : ''}`}
                        <Filter className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 bg-background border border-border shadow-lg z-50">
                      <Command>
                        <CommandInput placeholder="Buscar dívida..." />
                        <CommandEmpty>Nenhuma dívida encontrada.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={handleSelectAllDebtsForTable}>
                            <Checkbox checked={selectedDebtsForTable.length === filteredDebts.length} className="mr-2" />
                            <span className="font-medium">
                              {selectedDebtsForTable.length === filteredDebts.length ? "Desmarcar todas" : "Selecionar todas"}
                            </span>
                          </CommandItem>
                        </CommandGroup>
                        {Object.entries(debtsByBank).map(([bankName, bankDebts]) => <CommandGroup key={bankName} heading={bankName}>
                            {bankDebts.map(debt => {
                          const contractDisplay = debt.contractNumber || `CT${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
                          const monthlyRate = debt.interestType === 'monthly' ? debt.interestRate : (Math.pow(1 + debt.interestRate / 100, 1 / 12) - 1) * 100;
                          const annualRate = debt.interestType === 'annual' ? debt.interestRate : (Math.pow(1 + debt.interestRate / 100, 12) - 1) * 100;
                          return <CommandItem key={debt.id} onSelect={() => handleDebtToggleForTable(debt.id, !selectedDebtsForTable.includes(debt.id))}>
                                  <Checkbox checked={selectedDebtsForTable.includes(debt.id)} className="mr-2" />
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      Contrato {contractDisplay}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      {formatCurrency(debt.financedAmount)} • {monthlyRate.toFixed(3)}% a.m
                                    </span>
                                  </div>
                                </CommandItem>;
                        })}
                          </CommandGroup>)}
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Clear Dates Button */}
                <div className="flex items-end">
                  <Button variant="outline" onClick={() => {
                  setGlobalStartDate(undefined);
                  setGlobalEndDate(undefined);
                }} className="w-full" disabled={!globalStartDate && !globalEndDate}>
                    <X className="h-4 w-4 mr-2" />
                    Zerar Datas
                  </Button>
                </div>
              </div>
            </div>
            {selectedDebtsForTable.length > 0 ? <ConsolidatedAmortizationTable debts={selectedDebtsObjects} startDate={globalStartDate} endDate={globalEndDate} /> : <Card>
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
            <CashFlowAnalysis debts={debts} preSelectedDebt={preSelectedDebtForAnalysis} onClearPreSelection={() => setPreSelectedDebtForAnalysis(null)} periodMode="vigencia" globalStartDate={globalStartDate} globalEndDate={globalEndDate} />
          </TabsContent>
        </Tabs>
      </main>

      <DebtForm
        isOpen={isFormOpen}
        onClose={handleCloseDebtForm}
        onSave={handleSaveDebt}
        debt={editingDebt}
        initialDebt={!editingDebt ? currentImportDraft?.debt : undefined}
        initialGuarantees={!editingDebt ? currentImportDraft?.guarantees : undefined}
        importReview={
          !editingDebt && currentImportDraft
            ? {
                current: currentImportIndex + 1,
                total: importDrafts.length,
                lowConfidenceFields: getLowConfidenceFields(currentImportDraft.confidence),
                notes: currentImportDraft.notes,
                sourceName: currentImportDraft.sourceName,
              }
            : undefined
        }
      />
      <CardFeedbackMenu
        activeTab={activeTab}
        companyId={selectedCompany?.id}
        companyName={selectedCompany?.name}
        targets={feedbackTargets}
        userId={user?.id}
      />
    </div>;
};
export default Index;
