import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Debt {
  id: string;
  name: string;
  amount: number;
  interestRate: number;
  dueDate: string;
  minimumPayment: number;
  category: string;
}

interface DebtFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (debt: Omit<Debt, 'id'>) => void;
  debt?: Debt;
}

const categories = [
  "Cartão de Crédito",
  "Financiamento Imobiliário",
  "Financiamento Veicular",
  "Empréstimo Pessoal",
  "Cheque Especial",
  "Crediário",
  "Outros"
];

export const DebtForm = ({ isOpen, onClose, onSave, debt }: DebtFormProps) => {
  const [formData, setFormData] = useState({
    name: debt?.name || "",
    amount: debt?.amount || 0,
    interestRate: debt?.interestRate || 0,
    dueDate: debt?.dueDate ? new Date(debt.dueDate) : new Date(),
    minimumPayment: debt?.minimumPayment || 0,
    category: debt?.category || ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      amount: formData.amount,
      interestRate: formData.interestRate,
      dueDate: formData.dueDate.toISOString().split('T')[0],
      minimumPayment: formData.minimumPayment,
      category: formData.category
    });
    onClose();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      amount: 0,
      interestRate: 0,
      dueDate: new Date(),
      minimumPayment: 0,
      category: ""
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        resetForm();
      }
    }}>
      <DialogContent className="sm:max-w-md bg-gradient-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            {debt ? 'Editar Dívida' : 'Nova Dívida'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Dívida</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Cartão Visa, Financiamento Casa"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor Total (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                placeholder="0,00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interestRate">Taxa de Juros (% a.m.)</Label>
              <Input
                id="interestRate"
                type="number"
                step="0.01"
                value={formData.interestRate}
                onChange={(e) => setFormData(prev => ({ ...prev, interestRate: parseFloat(e.target.value) || 0 }))}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.dueDate, "P", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.dueDate}
                    onSelect={(date) => date && setFormData(prev => ({ ...prev, dueDate: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimumPayment">Pagamento Mínimo (R$)</Label>
              <Input
                id="minimumPayment"
                type="number"
                step="0.01"
                value={formData.minimumPayment}
                onChange={(e) => setFormData(prev => ({ ...prev, minimumPayment: parseFloat(e.target.value) || 0 }))}
                placeholder="0,00"
                required
              />
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