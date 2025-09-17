import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { SettingsButton } from "@/components/SettingsButton";
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
const Index = () => {
  const { signOut } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([
  // Dados de teste
  {
    id: "1",
    bank: "Banco do Brasil",
    financedAmount: 350000,
    releaseDate: "2024-01-15",
    dueDate: "2044-01-15",
    calculationTable: "SAC",
    indexer: "TR",
    interestRate: 9.5,
    interestType: "annual",
    iofAmount: 2500,
    tacAmount: 800,
    contractNumber: "BB240115001"
  }, {
    id: "2",
    bank: "Caixa Econômica Federal",
    financedAmount: 450000,
    releaseDate: "2023-06-10",
    dueDate: "2053-06-10",
    calculationTable: "PRICE",
    indexer: "IPCA",
    interestRate: 8.75,
    interestType: "annual",
    iofAmount: 3200,
    tacAmount: 950,
    contractNumber: "CEF230610002"
  }, {
    id: "3",
    bank: "Itaú",
    financedAmount: 280000,
    releaseDate: "2024-03-20",
    dueDate: "2039-03-20",
    calculationTable: "SAC",
    indexer: "CDI",
    interestRate: 1.2,
    interestType: "monthly",
    iofAmount: 1800,
    tacAmount: 600,
    contractNumber: "ITAU240320003"
  }, {
    id: "4",
    bank: "Santander",
    financedAmount: 520000,
    releaseDate: "2023-11-05",
    dueDate: "2048-11-05",
    calculationTable: "PRICE",
    interestRate: 10.25,
    interestType: "annual",
    iofAmount: 4100,
    tacAmount: 1200,
    contractNumber: "SAN231105004"
  }, {
    id: "5",
    bank: "Bradesco",
    financedAmount: 180000,
    releaseDate: "2024-07-12",
    dueDate: "2034-07-12",
    calculationTable: "SAC",
    indexer: "SELIC",
    interestRate: 11.5,
    interestType: "annual",
    iofAmount: 1200,
    tacAmount: 450,
    contractNumber: "BRAD240712005"
  }]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | undefined>(undefined);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [selectedBank, setSelectedBank] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [preSelectedDebtForAnalysis, setPreSelectedDebtForAnalysis] = useState<Debt | null>(null);

  // Filter debts by selected bank
  const filteredDebts = selectedBank === "all" ? debts : debts.filter(debt => debt.bank === selectedBank);
  const {
    toast
  } = useToast();
  const handleSaveDebt = (debtData: Omit<Debt, 'id'>) => {
    if (editingDebt) {
      setDebts(prev => prev.map(debt => debt.id === editingDebt.id ? {
        ...debtData,
        id: editingDebt.id
      } : debt));
      toast({
        title: "Dívida atualizada",
        description: "As informações da dívida foram atualizadas com sucesso."
      });
    } else {
      const newDebt: Debt = {
        ...debtData,
        id: Date.now().toString()
      };
      setDebts(prev => [...prev, newDebt]);
      toast({
        title: "Nova dívida adicionada",
        description: "A dívida foi cadastrada com sucesso."
      });
    }
    setEditingDebt(undefined);
  };
  const handleEditDebt = (debt: Debt) => {
    setEditingDebt(debt);
    setIsFormOpen(true);
  };
  const handleViewTable = (debt: Debt) => {
    setSelectedDebt(debt);
    setActiveTab("table");
  };

  const handleViewAnalysis = (debt: Debt) => {
    setPreSelectedDebtForAnalysis(debt);
    setActiveTab("analysis");
  };

  const handleNewDebt = () => {
    setEditingDebt(undefined);
    setIsFormOpen(true);
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
              <DashboardStats debts={debts} />
              
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
                <h2 className="text-2xl font-semibold text-foreground">Seus Cadastros</h2>
                <p className="text-muted-foreground">
                  {debts.length} dívida{debts.length !== 1 ? 's' : ''} cadastrada{debts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button onClick={handleNewDebt} className="bg-gradient-primary hover:opacity-90 shadow-elegant">
                <Plus className="mr-2 h-4 w-4" />
                Nova Dívida
              </Button>
            </div>

            {debts.length === 0 ? <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Calculator className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Nenhuma dívida cadastrada
                </h3>
                <p className="text-muted-foreground mb-6">
                  Comece adicionando suas primeiras dívidas para análise
                </p>
                <Button onClick={handleNewDebt} className="bg-gradient-primary hover:opacity-90">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeira Dívida
                </Button>
              </div> : <div className="space-y-4">
                {debts.map(debt => <DebtCard key={debt.id} debt={debt} onEdit={handleEditDebt} onViewTable={handleViewTable} onViewAnalysis={handleViewAnalysis} />)}
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
            <CashFlowAnalysis 
              debts={debts} 
              preSelectedDebt={preSelectedDebtForAnalysis} 
              onClearPreSelection={() => setPreSelectedDebtForAnalysis(null)} 
            />
          </TabsContent>
        </Tabs>
      </main>

      <DebtForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSave={handleSaveDebt} debt={editingDebt} />
    </div>;
};
export default Index;