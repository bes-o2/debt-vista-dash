import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
}

interface DebtFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (debt: Omit<Debt, 'id'>) => void;
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
  const [formData, setFormData] = useState({
    financedAmount: debt?.financedAmount || 0,
    releaseDate: debt?.releaseDate ? new Date(debt.releaseDate) : new Date(),
    dueDate: debt?.dueDate ? new Date(debt.dueDate) : new Date(),
    calculationTable: debt?.calculationTable || 'SAC' as 'SAC' | 'PRICE',
    indexer: debt?.indexer || "",
    interestRate: debt?.interestRate || 0,
    interestType: debt?.interestType || 'monthly' as 'monthly' | 'annual',
    iofAmount: debt?.iofAmount || 0,
    tacAmount: debt?.tacAmount || 0,
    bank: debt?.bank || 'Banco do Brasil'
  });

  const [financedAmountDisplay, setFinancedAmountDisplay] = useState(
    debt?.financedAmount ? formatCurrency(debt.financedAmount * 100) : "R$ 0,00"
  );
  const [iofAmountDisplay, setIofAmountDisplay] = useState(
    debt?.iofAmount ? formatCurrency(debt.iofAmount * 100) : "R$ 0,00"
  );
  const [tacAmountDisplay, setTacAmountDisplay] = useState(
    debt?.tacAmount ? formatCurrency(debt.tacAmount * 100) : "R$ 0,00"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for SAC requiring indexer
    if (formData.calculationTable === 'SAC' && !formData.indexer.trim()) {
      return; // Will be handled by required attribute
    }
    
    onSave({
      financedAmount: formData.financedAmount,
      releaseDate: formData.releaseDate.toISOString().split('T')[0],
      dueDate: formData.dueDate.toISOString().split('T')[0],
      calculationTable: formData.calculationTable,
      indexer: formData.calculationTable === 'SAC' ? formData.indexer : undefined,
      interestRate: formData.interestRate,
      interestType: formData.interestType,
      iofAmount: formData.iofAmount || undefined,
      tacAmount: formData.tacAmount || undefined,
      bank: formData.bank
    });
    onClose();
  };

  const resetForm = () => {
    setFormData({
      financedAmount: 0,
      releaseDate: new Date(),
      dueDate: new Date(),
      calculationTable: 'SAC',
      indexer: "",
      interestRate: 0,
      interestType: 'monthly',
      iofAmount: 0,
      tacAmount: 0,
      bank: 'Banco do Brasil'
    });
    setFinancedAmountDisplay("R$ 0,00");
    setIofAmountDisplay("R$ 0,00");
    setTacAmountDisplay("R$ 0,00");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        resetForm();
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
            <Select 
              value={formData.bank} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, bank: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o banco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Banco do Brasil">Banco do Brasil</SelectItem>
                <SelectItem value="Caixa Econômica Federal">Caixa Econômica Federal</SelectItem>
                <SelectItem value="Itaú">Itaú</SelectItem>
                <SelectItem value="Bradesco">Bradesco</SelectItem>
              </SelectContent>
            </Select>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.releaseDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.releaseDate, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.releaseDate}
                    onSelect={(date) => date && setFormData(prev => ({ ...prev, releaseDate: date }))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Vencimento <span className="text-red-500">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.dueDate}
                    onSelect={(date) => date && setFormData(prev => ({ ...prev, dueDate: date }))}
                    disabled={(date) => date < formData.releaseDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
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
                  calculationTable: value,
                  indexer: value === 'PRICE' ? "" : prev.indexer
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

          {/* Indexador - Só aparece se SAC */}
          {formData.calculationTable === 'SAC' && (
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
              onClick={() => {
                onClose();
                resetForm();
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-gradient-primary hover:opacity-90"
            >
              {debt ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};