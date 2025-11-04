import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Info } from "lucide-react";
import { useBanks } from "@/hooks/useBanks";
import { toast } from "@/hooks/use-toast";
import { Debt, DebtInput } from "@/hooks/useDebts";
import { supabase } from "@/integrations/supabase/client";
import { useEconomicIndices } from "@/hooks/useEconomicIndices";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DebtFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (debt: DebtInput) => void;
  debt?: Debt;
}

// Utility functions for currency formatting
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value / 100);
};

const parseCurrency = (value: string): number => {
  const numericValue = value.replace(/[^\d]/g, '');
  return parseInt(numericValue) || 0;
};

const formatCurrencyInput = (value: string): string => {
  const numericValue = parseCurrency(value);
  return formatCurrency(numericValue);
};

export const DebtForm = ({ isOpen, onClose, onSave, debt }: DebtFormProps) => {
  const { banks, addBank } = useBanks();
  const { latestRates, isLoading: isLoadingRates } = useEconomicIndices();
  const [newBankName, setNewBankName] = useState("");
  const [showNewBankInput, setShowNewBankInput] = useState(false);
  
  const [formData, setFormData] = useState({
    financedAmount: 0,
    releaseDate: new Date(),
    dueDate: new Date(),
    calculationTable: 'SAC' as 'SAC' | 'PRICE',
    rateType: 'pre' as 'pre' | 'post',
    indexer: "",
    spreadRate: 0,
    spreadType: 'annual' as 'annual' | 'monthly',
    interestRate: 0,
    interestType: 'monthly' as 'monthly' | 'annual',
    iofAmount: 0,
    tacAmount: 0,
    bank: banks.length > 0 ? banks[0].name : 'Banco do Brasil',
    contractNumber: ""
  });

  const [financedAmountDisplay, setFinancedAmountDisplay] = useState("R$ 0,00");
  const [iofAmountDisplay, setIofAmountDisplay] = useState("R$ 0,00");
  const [tacAmountDisplay, setTacAmountDisplay] = useState("R$ 0,00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasErrors = (
    !formData.bank?.trim() ||
    formData.financedAmount <= 0 ||
    formData.interestRate <= 0 ||
    (formData.rateType === 'post' && !formData.indexer.trim()) ||
    (formData.rateType === 'post' && formData.spreadRate < 0) ||
    formData.dueDate < formData.releaseDate
  );

  // Calculate total rate for post-fixed contracts
  const calculateTotalRate = () => {
    if (formData.rateType !== 'post' || !formData.indexer) return null;
    const indexRate = latestRates?.[formData.indexer as keyof typeof latestRates]?.value || 0;
    
    // Convert spread to annual if it's monthly
    const annualSpread = formData.spreadType === 'monthly' 
      ? (Math.pow(1 + formData.spreadRate / 100, 12) - 1) * 100
      : formData.spreadRate;
    
    const totalRate = indexRate + annualSpread;
    return { indexRate, spreadRate: annualSpread, totalRate };
  };

  // Update form data when debt prop changes
  useEffect(() => {
    if (debt) {
      // Calculate release date as first_due_date - 1 month
      // Parse date string carefully to avoid timezone issues
      const [fdYear, fdMonth, fdDay] = debt.first_due_date.split('-').map(Number);
      // fdMonth is 1-indexed (1=Jan, 4=Apr), so subtract 1 to get Date month (0-indexed), then subtract 1 more for previous month
      const releaseDate = new Date(fdYear, fdMonth - 1 - 1, fdDay);
      
      // Parse last_due_date carefully too
      const [ldYear, ldMonth, ldDay] = debt.last_due_date.split('-').map(Number);
      const lastDueDate = new Date(ldYear, ldMonth - 1, ldDay);
      
      setFormData({
        financedAmount: debt.financed_amount,
        releaseDate: releaseDate,
        dueDate: lastDueDate,
        calculationTable: debt.calculation_table,
        rateType: debt.interest_base === 'Pré-fixado' ? 'pre' : 'post',
        indexer: debt.interest_base === 'Pré-fixado' ? "" : debt.interest_base || "",
        spreadRate: debt.spread_rate || 0,
        spreadType: 'annual',
        interestRate: debt.interest_rate,
        interestType: debt.interest_type,
        iofAmount: debt.iof_rate || 0,
        tacAmount: debt.additional_fees || 0,
        bank: debt.title || "Banco do Brasil",
        contractNumber: debt.description || ""
      });
      setFinancedAmountDisplay(formatCurrency(debt.financed_amount * 100));
      setIofAmountDisplay(debt.iof_rate ? formatCurrency(debt.iof_rate * 100) : "R$ 0,00");
      setTacAmountDisplay(debt.additional_fees ? formatCurrency(debt.additional_fees * 100) : "R$ 0,00");
    } else {
      resetForm();
    }
  }, [debt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasErrors) {
      toast({
        title: "Verifique os campos obrigatórios",
        description: "Preencha os campos e valores válidos antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate CET by calling the amortization edge function
      const { data: { user } } = await supabase.auth.getUser();
      
      // Convert spread to annual for storage (always store as annual)
      const annualSpreadRate = formData.rateType === 'post' 
        ? (formData.spreadType === 'monthly' 
          ? (Math.pow(1 + formData.spreadRate / 100, 12) - 1) * 100
          : formData.spreadRate)
        : undefined;

      // Calculate first due date as release date + 1 month
      // Use local date components to avoid timezone issues
      const releaseYear = formData.releaseDate.getFullYear();
      const releaseMonth = formData.releaseDate.getMonth();
      const releaseDay = formData.releaseDate.getDate();
      const firstDueDate = new Date(releaseYear, releaseMonth + 1, releaseDay);
      
      // Format date as YYYY-MM-DD ensuring local timezone
      const firstDueDateStr = `${firstDueDate.getFullYear()}-${String(firstDueDate.getMonth() + 1).padStart(2, '0')}-${String(firstDueDate.getDate()).padStart(2, '0')}`;

      const calculationResponse = await supabase.functions.invoke('calculate-amortization', {
        body: {
          debtId: debt?.id || 'temp-id',
          financedAmount: formData.financedAmount,
          firstDueDate: firstDueDateStr,
          lastDueDate: formData.dueDate.toISOString().split('T')[0],
          calculationTable: formData.calculationTable,
          interestRate: formData.interestRate,
          interestType: formData.interestType,
          indexer: formData.rateType === 'post' ? formData.indexer : 'Pré-fixado',
          spreadRate: annualSpreadRate,
          iofAmount: formData.iofAmount || 0,
          tacAmount: formData.tacAmount || 0
        }
      });

      let cetMonthlyRate: number | undefined;
      let cetAnnualRate: number | undefined;

      if (calculationResponse.data?.cet) {
        cetMonthlyRate = calculationResponse.data.cet.monthlyRate;
        cetAnnualRate = calculationResponse.data.cet.annualRate;
        
        console.log('CET calculated:', {
          monthly: cetMonthlyRate?.toFixed(4) + '%',
          annual: cetAnnualRate?.toFixed(4) + '%'
        });
      } else {
        console.warn('CET calculation failed or not available');
      }

      // Calculate first due date as release date + 1 month for saving
      const saveYear = formData.releaseDate.getFullYear();
      const saveMonth = formData.releaseDate.getMonth();
      const saveDay = formData.releaseDate.getDate();
      const firstDueDateForSave = new Date(saveYear, saveMonth + 1, saveDay);
      const saveDateStr = `${firstDueDateForSave.getFullYear()}-${String(firstDueDateForSave.getMonth() + 1).padStart(2, '0')}-${String(firstDueDateForSave.getDate()).padStart(2, '0')}`;

      await Promise.resolve(onSave({
        title: formData.bank,
        description: formData.contractNumber || undefined,
        financed_amount: formData.financedAmount,
        first_due_date: saveDateStr,
        last_due_date: formData.dueDate.toISOString().split('T')[0],
        calculation_table: formData.calculationTable,
        interest_base: formData.rateType === 'post' ? formData.indexer : 'Pré-fixado',
        interest_rate: formData.interestRate,
        interest_type: formData.interestType,
        iof_rate: formData.iofAmount || undefined,
        additional_fees: formData.tacAmount || undefined,
        spread_rate: annualSpreadRate,
        cet_monthly_rate: cetMonthlyRate,
        cet_annual_rate: cetAnnualRate
      }));
      onClose();
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewBank = async () => {
    if (!newBankName.trim()) return;
    
    try {
      await addBank(newBankName.trim());
      setFormData(prev => ({ ...prev, bank: newBankName.trim() }));
      setNewBankName("");
      setShowNewBankInput(false);
      toast({
        title: "Banco adicionado",
        description: `${newBankName} foi adicionado com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao adicionar banco",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      financedAmount: 0,
      releaseDate: new Date(),
      dueDate: new Date(),
      calculationTable: 'SAC',
      rateType: 'pre',
      indexer: "",
      spreadRate: 0,
      spreadType: 'annual',
      interestRate: 0,
      interestType: 'monthly',
      iofAmount: 0,
      tacAmount: 0,
      bank: banks.length > 0 ? banks[0].name : 'Banco do Brasil',
      contractNumber: ""
    });
    setFinancedAmountDisplay("R$ 0,00");
    setIofAmountDisplay("R$ 0,00");
    setTacAmountDisplay("R$ 0,00");
    setNewBankName("");
    setShowNewBankInput(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-lg bg-gradient-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            {debt ? 'Editar Dívida' : 'Cadastro de Nova Dívida'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Banco */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Banco <span className="text-red-500">*</span>
            </Label>
            <div className="space-y-2">
              <Select 
                value={formData.bank} 
                onValueChange={(value) => {
                  if (value === "add_new") {
                    setShowNewBankInput(true);
                  } else {
                    setFormData(prev => ({ ...prev, bank: value }));
                  }
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.name}>
                      {bank.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="add_new" className="text-primary">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Adicionar novo banco
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {showNewBankInput && (
                <div className="flex gap-2">
                  <Input
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    placeholder="Nome do novo banco"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewBank();
                      }
                      if (e.key === 'Escape') {
                        setShowNewBankInput(false);
                        setNewBankName("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddNewBank}
                    disabled={!newBankName.trim()}
                    size="sm"
                  >
                    Adicionar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewBankInput(false);
                      setNewBankName("");
                    }}
                    size="sm"
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Valor Financiado */}
          <div className="space-y-2">
            <Label htmlFor="financedAmount" className="text-sm font-medium">
              Valor Financiado <span className="text-red-500">*</span>
            </Label>
            <Input
              id="financedAmount"
              value={financedAmountDisplay}
              onChange={(e) => {
                const formatted = formatCurrencyInput(e.target.value);
                setFinancedAmountDisplay(formatted);
                const numericValue = parseCurrency(e.target.value) / 100;
                setFormData(prev => ({ ...prev, financedAmount: numericValue }));
              }}
              placeholder="R$ 0,00"
              required
            />
          </div>

          {/* Data Liberação e Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Data Liberação <span className="text-red-500">*</span>
              </Label>
              <DateInput
                value={formData.releaseDate}
                onChange={(date) => {
                  if (date) {
                    setFormData(prev => ({ ...prev, releaseDate: date }));
                  }
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Vencimento <span className="text-red-500">*</span>
              </Label>
              <DateInput
                value={formData.dueDate}
                onChange={(date) => {
                  if (date) {
                    setFormData(prev => ({ ...prev, dueDate: date }));
                  }
                }}
                minDate={formData.releaseDate}
                required
              />
            </div>
          </div>

          {/* Tabela de Cálculo */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Tabela de Cálculo <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.calculationTable} 
              onValueChange={(value: 'SAC' | 'PRICE') => {
                setFormData(prev => ({ 
                  ...prev, 
                  calculationTable: value
                }));
              }}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a tabela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SAC">SAC (Sistema de Amortização Constante)</SelectItem>
                <SelectItem value="PRICE">PRICE (Sistema Francês)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Taxa */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Tipo de Taxa <span className="text-red-500">*</span>
            </Label>
            <RadioGroup 
              value={formData.rateType} 
              onValueChange={(value: 'pre' | 'post') => 
                setFormData(prev => ({ 
                  ...prev, 
                  rateType: value,
                  indexer: value === 'pre' ? "" : prev.indexer
                }))
              }
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pre" id="pre" />
                <Label htmlFor="pre">Pré Fixada</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="post" id="post" />
                <Label htmlFor="post">Pós Fixada</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Indexador - Só aparece se Pós Fixada */}
          {formData.rateType === 'post' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Indexador <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={formData.indexer} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, indexer: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o indexador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CDI">CDI</SelectItem>
                    <SelectItem value="SELIC">SELIC</SelectItem>
                    <SelectItem value="IPCA">IPCA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Real-time Rate Display */}
              {formData.indexer && (
                <Alert className="bg-primary/5 border-primary/20">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {isLoadingRates ? (
                      <span className="text-sm">Carregando taxa atual...</span>
                    ) : (
                      <div className="text-sm space-y-1">
                        <div className="font-medium">Taxa Atual {formData.indexer} (a.a.): {latestRates?.[formData.indexer as keyof typeof latestRates]?.value.toFixed(2)}%</div>
                        <div className="flex items-center gap-2">
                          <span>Spread ({formData.spreadType === 'annual' ? 'a.a.' : 'a.m.'}): {formData.spreadRate.toFixed(4)}%</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-semibold text-primary">
                            Total (a.a.): {calculateTotalRate()?.totalRate.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Spread Type Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Tipo de Spread <span className="text-red-500">*</span>
                </Label>
                <RadioGroup 
                  value={formData.spreadType} 
                  onValueChange={(value: 'monthly' | 'annual') => 
                    setFormData(prev => ({ ...prev, spreadType: value }))
                  }
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="monthly" id="spread-monthly" />
                    <Label htmlFor="spread-monthly">Spread a.m (%)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="annual" id="spread-annual" />
                    <Label htmlFor="spread-annual">Spread a.a (%)</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Spread Rate */}
              <div className="space-y-2">
                <Label htmlFor="spreadRate" className="text-sm font-medium">
                  Spread ({formData.spreadType === 'annual' ? '% a.a.' : '% a.m.'}) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="spreadRate"
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.spreadRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, spreadRate: parseFloat(e.target.value) || 0 }))}
                  placeholder="0,000"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Spread sobre a taxa do indexador ({formData.spreadType === 'annual' ? 'anual' : 'mensal'})
                </p>
              </div>
            </div>
          )}

          {/* Taxa de Juros */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Tipo de Taxa <span className="text-red-500">*</span>
              </Label>
              <RadioGroup 
                value={formData.interestType} 
                onValueChange={(value: 'monthly' | 'annual') => 
                  setFormData(prev => ({ ...prev, interestType: value }))
                }
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="monthly" />
                  <Label htmlFor="monthly">Taxa a.m (%)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="annual" id="annual" />
                  <Label htmlFor="annual">Taxa a.a (%)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interestRate" className="text-sm font-medium">
                {formData.interestType === 'monthly' ? 'Taxa a.m (%)' : 'Taxa a.a (%)'} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="interestRate"
                type="number"
                step="0.001"
                min="0"
                value={formData.interestRate}
                onChange={(e) => setFormData(prev => ({ ...prev, interestRate: parseFloat(e.target.value) || 0 }))}
                placeholder="0,000"
                required
              />
            </div>
          </div>

          {/* Campos Opcionais */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Campos Opcionais</h3>
            
            <div className="space-y-2">
              <Label htmlFor="contractNumber" className="text-sm font-medium">N. do Contrato</Label>
              <Input
                id="contractNumber"
                value={formData.contractNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, contractNumber: e.target.value }))}
                placeholder="Ex: 12345678-90"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="iofAmount" className="text-sm font-medium">IOF</Label>
                <Input
                  id="iofAmount"
                  value={iofAmountDisplay}
                  onChange={(e) => {
                    const formatted = formatCurrencyInput(e.target.value);
                    setIofAmountDisplay(formatted);
                    const numericValue = parseCurrency(e.target.value) / 100;
                    setFormData(prev => ({ ...prev, iofAmount: numericValue }));
                  }}
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tacAmount" className="text-sm font-medium">TAC</Label>
                <Input
                  id="tacAmount"
                  value={tacAmountDisplay}
                  onChange={(e) => {
                    const formatted = formatCurrencyInput(e.target.value);
                    setTacAmountDisplay(formatted);
                    const numericValue = parseCurrency(e.target.value) / 100;
                    setFormData(prev => ({ ...prev, tacAmount: numericValue }));
                  }}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-gradient-primary hover:opacity-90"
              disabled={isSubmitting || hasErrors}
              aria-disabled={isSubmitting || hasErrors}
            >
              {isSubmitting ? 'Salvando...' : (debt ? 'Atualizar' : 'Salvar')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};