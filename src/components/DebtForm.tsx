import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { useBanks } from "@/hooks/useBanks";
import { toast } from "@/hooks/use-toast";
import { Debt, DebtInput } from "@/hooks/useDebts";
import { supabase } from "@/integrations/supabase/client";

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
  const [newBankName, setNewBankName] = useState("");
  const [showNewBankInput, setShowNewBankInput] = useState(false);
  
  const [formData, setFormData] = useState({
    financedAmount: 0,
    releaseDate: new Date(),
    dueDate: new Date(),
    calculationTable: 'SAC' as 'SAC' | 'PRICE',
    rateType: 'pre' as 'pre' | 'post',
    indexer: "",
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
    formData.dueDate < formData.releaseDate
  );

  // Update form data when debt prop changes
  useEffect(() => {
    if (debt) {
      setFormData({
        financedAmount: debt.financed_amount,
        releaseDate: new Date(debt.first_due_date),
        dueDate: new Date(debt.last_due_date),
        calculationTable: debt.calculation_table,
        rateType: debt.interest_base === 'Pré-fixado' ? 'pre' : 'post',
        indexer: debt.interest_base === 'Pré-fixado' ? "" : debt.interest_base || "",
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
      
      const calculationResponse = await supabase.functions.invoke('calculate-amortization', {
        body: {
          debtId: debt?.id || 'temp-id', // Use temp id for new debts
          financedAmount: formData.financedAmount,
          firstDueDate: formData.releaseDate.toISOString().split('T')[0],
          lastDueDate: formData.dueDate.toISOString().split('T')[0],
          calculationTable: formData.calculationTable,
          interestRate: formData.interestRate,
          interestType: formData.interestType,
          indexer: formData.rateType === 'post' ? formData.indexer : 'Pré-fixado',
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

      await Promise.resolve(onSave({
        title: formData.bank,
        description: formData.contractNumber || undefined,
        financed_amount: formData.financedAmount,
        first_due_date: formData.releaseDate.toISOString().split('T')[0],
        last_due_date: formData.dueDate.toISOString().split('T')[0],
        calculation_table: formData.calculationTable,
        interest_base: formData.rateType === 'post' ? formData.indexer : 'Pré-fixado',
        interest_rate: formData.interestRate,
        interest_type: formData.interestType,
        iof_rate: formData.iofAmount || undefined,
        additional_fees: formData.tacAmount || undefined,
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
              <div className="relative">
                <Input
                  type="date"
                  value={format(formData.releaseDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    if (!isNaN(date.getTime())) {
                      setFormData(prev => ({ ...prev, releaseDate: date }));
                    }
                  }}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Vencimento <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="date"
                  value={format(formData.dueDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    if (!isNaN(date.getTime()) && date >= formData.releaseDate) {
                      setFormData(prev => ({ ...prev, dueDate: date }));
                    }
                  }}
                  min={format(formData.releaseDate, "yyyy-MM-dd")}
                  className="w-full"
                />
              </div>
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
                  <SelectItem value="IPCA">IPCA</SelectItem>
                  <SelectItem value="SELIC">SELIC</SelectItem>
                  <SelectItem value="TR">TR</SelectItem>
                  <SelectItem value="IGPM">IGP-M</SelectItem>
                </SelectContent>
              </Select>
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