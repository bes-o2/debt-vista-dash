import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Info, Trash2 } from "lucide-react";
import { useBanks } from "@/hooks/useBanks";
import { toast } from "@/hooks/use-toast";
import { Debt, DebtInput } from "@/hooks/useDebts";
import { supabase } from "@/integrations/supabase/client";
import { resolveDebtBankName } from "@/lib/debtBank";
import { useEconomicIndices } from "@/hooks/useEconomicIndices";
import { useCompany } from "@/hooks/useCompany";
import {
  DebtGuaranteeInput,
  GuaranteeType,
  GUARANTEE_TYPE_LABELS,
  useDebtGuarantees,
} from "@/hooks/useDebtGuarantees";

interface DebtFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (debt: DebtInput, guarantees: DebtGuaranteeInput[]) => Promise<void> | void;
  debt?: Debt;
  initialDebt?: DebtInput;
  initialGuarantees?: DebtGuaranteeInput[];
  importReview?: {
    current: number;
    total: number;
    lowConfidenceFields: string[];
    notes?: string;
    sourceName?: string;
  };
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
};

const parseCurrency = (value: string): number => {
  const numericValue = value.replace(/[^\d]/g, "");
  return parseInt(numericValue, 10) || 0;
};

const formatCurrencyInput = (value: string): string => {
  return formatCurrency(parseCurrency(value));
};

const formatDateForSave = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const parseLocalDate = (dateString?: string): Date => {
  if (!dateString) {
    return new Date();
  }

  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
};

const releaseDateFromFirstDueDate = (firstDueDate?: string): Date => {
  const firstDueDateObj = parseLocalDate(firstDueDate);
  return new Date(firstDueDateObj.getFullYear(), firstDueDateObj.getMonth() - 1, firstDueDateObj.getDate());
};

const isPreFixedInterestBase = (interestBase?: string): boolean => {
  const normalized = interestBase?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ?? "";
  return !normalized || normalized === "pre" || normalized.includes("pre-fix") || normalized.includes("prefix");
};

const createEmptyGuarantee = (): DebtGuaranteeInput => ({
  type: "imovel",
  value: 0,
  description: "",
});

export const DebtForm = ({ isOpen, onClose, onSave, debt, initialDebt, initialGuarantees, importReview }: DebtFormProps) => {
  const { banks, addBank } = useBanks();
  const { selectedCompany } = useCompany();
  const { latestRates, isLoading: isLoadingRates } = useEconomicIndices();
  const { guarantees: existingGuarantees } = useDebtGuarantees(debt?.id);
  const [newBankName, setNewBankName] = useState("");
  const [showNewBankInput, setShowNewBankInput] = useState(false);

  const [formData, setFormData] = useState({
    financedAmount: 0,
    releaseDate: new Date(),
    dueDate: new Date(),
    calculationTable: "SAC" as "SAC" | "PRICE",
    rateType: "pre" as "pre" | "post",
    indexer: "",
    spreadRate: 0,
    spreadType: "annual" as "annual" | "monthly",
    interestRate: 0,
    interestType: "monthly" as "monthly" | "annual",
    iofAmount: 0,
    tacAmount: 0,
    bank: banks.length > 0 ? banks[0].name : "Banco do Brasil",
    contractNumber: "",
    indexerStartDate: undefined as Date | undefined,
  });

  const [financedAmountDisplay, setFinancedAmountDisplay] = useState("R$ 0,00");
  const [iofAmountDisplay, setIofAmountDisplay] = useState("R$ 0,00");
  const [tacAmountDisplay, setTacAmountDisplay] = useState("R$ 0,00");
  const [interestRateStr, setInterestRateStr] = useState("");
  const [spreadRateStr, setSpreadRateStr] = useState("");
  const [guarantees, setGuarantees] = useState<DebtGuaranteeInput[]>([]);
  const [guaranteeValueDisplays, setGuaranteeValueDisplays] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bankOptions = formData.bank && !banks.some((bank) => bank.name.toLowerCase() === formData.bank.toLowerCase())
    ? [{ id: "imported-bank", name: formData.bank, created_at: "", updated_at: "" }, ...banks]
    : banks;
  const indexerOptions = formData.indexer && !["CDI", "SELIC", "IPCA"].includes(formData.indexer)
    ? [formData.indexer, "CDI", "SELIC", "IPCA"]
    : ["CDI", "SELIC", "IPCA"];

  const hasErrors =
    !formData.bank?.trim() ||
    formData.financedAmount <= 0 ||
    (formData.rateType === "pre" && formData.interestRate <= 0) ||
    (formData.rateType === "post" && !formData.indexer.trim()) ||
    (formData.rateType === "post" && formData.spreadRate < 0) ||
    formData.dueDate < formData.releaseDate;

  const calculateTotalRate = () => {
    if (formData.rateType !== "post" || !formData.indexer) return null;

    const indexRate = latestRates?.[formData.indexer as keyof typeof latestRates]?.value || 0;
    const annualSpread =
      formData.spreadType === "monthly"
        ? (Math.pow(1 + formData.spreadRate / 100, 12) - 1) * 100
        : formData.spreadRate;

    return {
      indexRate,
      spreadRate: annualSpread,
      totalRate: indexRate + annualSpread,
    };
  };

  const resetForm = useCallback(() => {
    setFormData({
      financedAmount: 0,
      releaseDate: new Date(),
      dueDate: new Date(),
      calculationTable: "SAC",
      rateType: "pre",
      indexer: "",
      spreadRate: 0,
      spreadType: "annual",
      interestRate: 0,
      interestType: "monthly",
      iofAmount: 0,
      tacAmount: 0,
      bank: banks.length > 0 ? banks[0].name : "Banco do Brasil",
      contractNumber: "",
      indexerStartDate: undefined,
    });
    setFinancedAmountDisplay("R$ 0,00");
    setIofAmountDisplay("R$ 0,00");
    setTacAmountDisplay("R$ 0,00");
    setInterestRateStr("");
    setSpreadRateStr("");
    setGuarantees([]);
    setGuaranteeValueDisplays([]);
    setNewBankName("");
    setShowNewBankInput(false);
  }, [banks]);

  const applyDebtInput = useCallback((debtInput: DebtInput, nextGuarantees: DebtGuaranteeInput[]) => {
    const isPreFixed = isPreFixedInterestBase(debtInput.interest_base);
    const iofAmount =
      debtInput.iof_rate != null && debtInput.financed_amount > 0
        ? (debtInput.financed_amount * debtInput.iof_rate) / 100
        : 0;

    setFormData({
      financedAmount: debtInput.financed_amount,
      releaseDate: releaseDateFromFirstDueDate(debtInput.first_due_date),
      dueDate: parseLocalDate(debtInput.last_due_date),
      calculationTable: debtInput.calculation_table,
      rateType: isPreFixed ? "pre" : "post",
      indexer: isPreFixed ? "" : debtInput.interest_base || "",
      spreadRate: debtInput.spread_rate || 0,
      spreadType: "annual",
      interestRate: debtInput.interest_rate,
      interestType: debtInput.interest_type,
      iofAmount,
      tacAmount: debtInput.additional_fees || 0,
      bank: debtInput.bank || banks[0]?.name || "Banco do Brasil",
      contractNumber: debtInput.description || debtInput.title || "",
      indexerStartDate: debtInput.indexer_start_date ? parseLocalDate(debtInput.indexer_start_date) : undefined,
    });
    setFinancedAmountDisplay(formatCurrency(debtInput.financed_amount * 100));
    setIofAmountDisplay(iofAmount ? formatCurrency(iofAmount * 100) : "R$ 0,00");
    setTacAmountDisplay(debtInput.additional_fees ? formatCurrency(debtInput.additional_fees * 100) : "R$ 0,00");
    setInterestRateStr(debtInput.interest_rate > 0 ? String(debtInput.interest_rate).replace('.', ',') : "");
    setSpreadRateStr((debtInput.spread_rate ?? 0) > 0 ? String(debtInput.spread_rate).replace('.', ',') : "");
    setGuarantees(nextGuarantees);
    setGuaranteeValueDisplays(nextGuarantees.map((guarantee) => formatCurrency(guarantee.value * 100)));
    setNewBankName("");
    setShowNewBankInput(false);
  }, [banks]);

  useEffect(() => {
    if (debt) {
      const [fdYear, fdMonth, fdDay] = debt.first_due_date.split("-").map(Number);
      const releaseDate = new Date(fdYear, fdMonth - 2, fdDay);
      const [ldYear, ldMonth, ldDay] = debt.last_due_date.split("-").map(Number);
      const lastDueDate = new Date(ldYear, ldMonth - 1, ldDay);

      setFormData({
        financedAmount: debt.financed_amount,
        releaseDate,
        dueDate: lastDueDate,
        calculationTable: debt.calculation_table,
        rateType: debt.interest_base === "Pré-fixado" ? "pre" : "post",
        indexer: debt.interest_base === "Pré-fixado" ? "" : debt.interest_base || "",
        spreadRate: debt.spread_rate || 0,
        spreadType: "annual",
        interestRate: debt.interest_rate,
        interestType: debt.interest_type,
        iofAmount: debt.iof_rate || 0,
        tacAmount: debt.additional_fees || 0,
        bank: resolveDebtBankName(debt),
        contractNumber: debt.description || "",
        indexerStartDate: debt.indexer_start_date ? new Date(debt.indexer_start_date) : undefined,
      });
      setFinancedAmountDisplay(formatCurrency(debt.financed_amount * 100));
      setIofAmountDisplay(debt.iof_rate ? formatCurrency(debt.iof_rate * 100) : "R$ 0,00");
      setTacAmountDisplay(debt.additional_fees ? formatCurrency(debt.additional_fees * 100) : "R$ 0,00");
      setInterestRateStr(debt.interest_rate > 0 ? String(debt.interest_rate).replace('.', ',') : "");
      setSpreadRateStr((debt.spread_rate ?? 0) > 0 ? String(debt.spread_rate).replace('.', ',') : "");
      return;
    }

    if (initialDebt) {
      applyDebtInput(initialDebt, initialGuarantees ?? []);
      return;
    }

    resetForm();
  }, [debt, initialDebt, initialGuarantees, applyDebtInput, resetForm]);

  useEffect(() => {
    if (!debt?.id) {
      return;
    }

    setGuarantees(
      existingGuarantees.map((guarantee) => ({
        type: guarantee.type,
        value: guarantee.value,
        description: guarantee.description,
      }))
    );
    setGuaranteeValueDisplays(existingGuarantees.map((guarantee) => formatCurrency(guarantee.value * 100)));
  }, [debt?.id, existingGuarantees]);

  const handleAddNewBank = async () => {
    if (!newBankName.trim()) return;

    try {
      await addBank(newBankName.trim());
      setFormData((prev) => ({ ...prev, bank: newBankName.trim() }));
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

  const addGuarantee = () => {
    setGuarantees((prev) => [...prev, createEmptyGuarantee()]);
    setGuaranteeValueDisplays((prev) => [...prev, "R$ 0,00"]);
  };

  const removeGuarantee = (index: number) => {
    setGuarantees((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    setGuaranteeValueDisplays((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const updateGuarantee = (index: number, updater: (guarantee: DebtGuaranteeInput) => DebtGuaranteeInput) => {
    setGuarantees((prev) => prev.map((guarantee, itemIndex) => (itemIndex === index ? updater(guarantee) : guarantee)));
  };

  const updateGuaranteeType = (index: number, type: GuaranteeType) => {
    updateGuarantee(index, (guarantee) => ({
      ...guarantee,
      type,
      description: type === "outros" ? guarantee.description || "" : "",
    }));
  };

  const updateGuaranteeValue = (index: number, display: string, value: number) => {
    updateGuarantee(index, (guarantee) => ({ ...guarantee, value }));
    setGuaranteeValueDisplays((prev) => prev.map((item, itemIndex) => (itemIndex === index ? display : item)));
  };

  const updateGuaranteeDescription = (index: number, description: string) => {
    updateGuarantee(index, (guarantee) => ({ ...guarantee, description }));
  };

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

    if (!selectedCompany?.id) {
      toast({
        title: "Empresa não selecionada",
        description: "Selecione uma empresa antes de salvar o contrato.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const annualSpreadRate =
        formData.rateType === "post"
          ? formData.spreadType === "monthly"
            ? (Math.pow(1 + formData.spreadRate / 100, 12) - 1) * 100
            : formData.spreadRate
          : undefined;

      const firstDueDate = new Date(
        formData.releaseDate.getFullYear(),
        formData.releaseDate.getMonth() + 1,
        formData.releaseDate.getDate()
      );

      const calculationResponse = await supabase.functions.invoke("calculate-amortization", {
        body: {
          debtId: debt?.id || "temp-id",
          companyId: selectedCompany.id,
          financedAmount: formData.financedAmount,
          firstDueDate: formatDateForSave(firstDueDate),
          lastDueDate: formatDateForSave(formData.dueDate),
          calculationTable: formData.calculationTable,
          interestRate: formData.interestRate,
          interestType: formData.interestType,
          indexer: formData.rateType === "post" ? formData.indexer : "Pré-fixado",
          spreadRate: annualSpreadRate,
          indexerStartDate:
            formData.rateType === "post" && formData.indexerStartDate
              ? formatDateForSave(formData.indexerStartDate)
              : undefined,
          iofAmount: formData.iofAmount || 0,
          tacAmount: formData.tacAmount || 0,
          persist: false,
        },
      });

      let cetMonthlyRate: number | undefined;
      let cetAnnualRate: number | undefined;

      if (calculationResponse.data?.cet) {
        cetMonthlyRate = calculationResponse.data.cet.monthlyRate;
        cetAnnualRate = calculationResponse.data.cet.annualRate;
      }

      await Promise.resolve(
        onSave(
          {
            bank: formData.bank,
            title: formData.bank,
            description: formData.contractNumber || undefined,
            financed_amount: formData.financedAmount,
            first_due_date: formatDateForSave(firstDueDate),
            last_due_date: formatDateForSave(formData.dueDate),
            calculation_table: formData.calculationTable,
            interest_base: formData.rateType === "post" ? formData.indexer : "Pré-fixado",
            interest_rate: formData.interestRate,
            interest_type: formData.interestType,
            iof_rate:
              formData.iofAmount && formData.financedAmount > 0
                ? Number(((formData.iofAmount / formData.financedAmount) * 100).toFixed(6))
                : undefined,
            additional_fees: formData.tacAmount || undefined,
            spread_rate: annualSpreadRate,
            indexer_start_date:
              formData.rateType === "post" && formData.indexerStartDate
                ? formatDateForSave(formData.indexerStartDate)
                : undefined,
            cet_monthly_rate: cetMonthlyRate,
            cet_annual_rate: cetAnnualRate,
          },
          guarantees
        )
      );
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
      return;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg bg-background max-h-[90vh] overflow-y-auto border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            {debt ? "Editar Dívida" : importReview ? "Revisar Dívida Importada" : "Cadastro de Nova Dívida"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {importReview && (
            <Alert className="border-amber-500/30 bg-amber-500/10">
              <Info className="h-4 w-4" />
              <AlertTitle>
                Contrato {importReview.current} de {importReview.total}
                {importReview.sourceName ? ` · ${importReview.sourceName}` : ""}
              </AlertTitle>
              <AlertDescription className="space-y-1">
                <p>Revise os campos extraídos antes de salvar.</p>
                {importReview.lowConfidenceFields.length > 0 && (
                  <p>Baixa confiança: {importReview.lowConfidenceFields.join(", ")}.</p>
                )}
                {importReview.notes && <p>Notas: {importReview.notes}</p>}
              </AlertDescription>
            </Alert>
          )}

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
                    return;
                  }

                  setFormData((prev) => ({ ...prev, bank: value }));
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {bankOptions.map((bank) => (
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
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNewBank();
                      }

                      if (e.key === "Escape") {
                        setShowNewBankInput(false);
                        setNewBankName("");
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddNewBank} disabled={!newBankName.trim()} size="sm">
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

          <div className="space-y-2">
            <Label htmlFor="financedAmount" className="text-sm font-medium">
              Valor Financiado <span className="text-red-500">*</span>
            </Label>
            <Input
              id="financedAmount"
              value={financedAmountDisplay}
              onChange={(e) => {
                setFinancedAmountDisplay(e.target.value);
                setFormData((prev) => ({ ...prev, financedAmount: parseCurrency(e.target.value) / 100 }));
              }}
              onBlur={(e) => {
                setFinancedAmountDisplay(formatCurrencyInput(e.target.value));
              }}
              placeholder="R$ 0,00"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Data Liberação <span className="text-red-500">*</span>
              </Label>
              <DateInput
                value={formData.releaseDate}
                onChange={(date) => {
                  if (date) {
                    setFormData((prev) => ({ ...prev, releaseDate: date }));
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
                    setFormData((prev) => ({ ...prev, dueDate: date }));
                  }
                }}
                minDate={formData.releaseDate}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Tabela de Cálculo <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.calculationTable}
              onValueChange={(value: "SAC" | "PRICE") => {
                setFormData((prev) => ({
                  ...prev,
                  calculationTable: value,
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

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Tipo de Taxa <span className="text-red-500">*</span>
            </Label>
            <RadioGroup
              value={formData.rateType}
              onValueChange={(value: "pre" | "post") =>
                setFormData((prev) => ({
                  ...prev,
                  rateType: value,
                  indexer: value === "pre" ? "" : prev.indexer,
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

          {formData.rateType === "post" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Indexador <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.indexer}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, indexer: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o indexador" />
                  </SelectTrigger>
                  <SelectContent>
                    {indexerOptions.map((indexer) => (
                      <SelectItem key={indexer} value={indexer}>
                        {indexer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.indexer && (
                <Alert className="bg-primary/5 border-primary/20">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {isLoadingRates ? (
                      <span className="text-sm">Carregando taxa atual...</span>
                    ) : (
                      <div className="text-sm space-y-1">
                        <div className="font-medium">
                          Taxa Atual {formData.indexer} (a.a.): {latestRates?.[formData.indexer as keyof typeof latestRates]?.value?.toFixed(2) ?? "0.00"}%
                        </div>
                        <div className="flex items-center gap-2">
                          <span>Spread ({formData.spreadType === "annual" ? "a.a." : "a.m."}): {formData.spreadRate.toFixed(4)}%</span>
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

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Tipo de Spread <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={formData.spreadType}
                  onValueChange={(value: "monthly" | "annual") =>
                    setFormData((prev) => ({ ...prev, spreadType: value }))
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

              <div className="space-y-2">
                <Label htmlFor="spreadRate" className="text-sm font-medium">
                  Spread ({formData.spreadType === "annual" ? "% a.a." : "% a.m."}) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="spreadRate"
                  type="text"
                  inputMode="decimal"
                  value={spreadRateStr}
                  onChange={(e) => {
                    setSpreadRateStr(e.target.value);
                    const parsed = parseFloat(e.target.value.replace(',', '.'));
                    if (!isNaN(parsed)) {
                      setFormData((prev) => ({ ...prev, spreadRate: parsed }));
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseFloat(spreadRateStr.replace(',', '.')) || 0;
                    setFormData((prev) => ({ ...prev, spreadRate: parsed }));
                    setSpreadRateStr(parsed > 0 ? String(parsed).replace('.', ',') : "");
                  }}
                  placeholder="0,000"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Spread sobre a taxa do indexador ({formData.spreadType === "annual" ? "anual" : "mensal"})
                </p>
              </div>
            </div>
          )}

          {formData.rateType === "pre" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Tipo de Taxa <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={formData.interestType}
                  onValueChange={(value: "monthly" | "annual") =>
                    setFormData((prev) => ({ ...prev, interestType: value }))
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
                  {formData.interestType === "monthly" ? "Taxa a.m (%)" : "Taxa a.a (%)"} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="interestRate"
                  type="text"
                  inputMode="decimal"
                  value={interestRateStr}
                  onChange={(e) => {
                    setInterestRateStr(e.target.value);
                    const parsed = parseFloat(e.target.value.replace(',', '.'));
                    if (!isNaN(parsed)) {
                      setFormData((prev) => ({ ...prev, interestRate: parsed }));
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseFloat(interestRateStr.replace(',', '.')) || 0;
                    setFormData((prev) => ({ ...prev, interestRate: parsed }));
                    setInterestRateStr(parsed > 0 ? String(parsed).replace('.', ',') : "");
                  }}
                  placeholder="0,000"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Campos Opcionais</h3>

            <div className="space-y-2">
              <Label htmlFor="contractNumber" className="text-sm font-medium">
                N. do Contrato
              </Label>
              <Input
                id="contractNumber"
                value={formData.contractNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, contractNumber: e.target.value }))}
                placeholder="Ex: 12345678-90"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="iofAmount" className="text-sm font-medium">
                  IOF
                </Label>
                <Input
                  id="iofAmount"
                  value={iofAmountDisplay}
                  onChange={(e) => {
                    setIofAmountDisplay(e.target.value);
                    setFormData((prev) => ({ ...prev, iofAmount: parseCurrency(e.target.value) / 100 }));
                  }}
                  onBlur={(e) => {
                    setIofAmountDisplay(formatCurrencyInput(e.target.value));
                  }}
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tacAmount" className="text-sm font-medium">
                  TAC
                </Label>
                <Input
                  id="tacAmount"
                  value={tacAmountDisplay}
                  onChange={(e) => {
                    setTacAmountDisplay(e.target.value);
                    setFormData((prev) => ({ ...prev, tacAmount: parseCurrency(e.target.value) / 100 }));
                  }}
                  onBlur={(e) => {
                    setTacAmountDisplay(formatCurrencyInput(e.target.value));
                  }}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Garantias</h3>
                <p className="text-xs text-muted-foreground">Somente garantias com valor acima de zero serão salvas.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addGuarantee}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            {guarantees.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma garantia cadastrada.</p>
            )}

            {guarantees.map((guarantee, index) => (
              <div key={`${guarantee.type}-${index}`} className="space-y-3 rounded-md border border-border/60 p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={guarantee.type} onValueChange={(value) => updateGuaranteeType(index, value as GuaranteeType)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(GUARANTEE_TYPE_LABELS) as [GuaranteeType, string][]).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Valor</Label>
                    <Input
                      className="h-9"
                      value={guaranteeValueDisplays[index] ?? "R$ 0,00"}
                      onChange={(e) => {
                        const value = parseCurrency(e.target.value) / 100;
                        updateGuaranteeValue(index, e.target.value, value);
                      }}
                      onBlur={(e) => {
                        const value = parseCurrency(e.target.value) / 100;
                        updateGuaranteeValue(index, formatCurrencyInput(e.target.value), value);
                      }}
                      placeholder="R$ 0,00"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => removeGuarantee(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {guarantee.type === "outros" && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Descrição</Label>
                    <Input
                      value={guarantee.description || ""}
                      onChange={(e) => updateGuaranteeDescription(index, e.target.value)}
                      placeholder="Descreva a garantia"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-primary hover:opacity-90"
              disabled={isSubmitting || hasErrors}
              aria-disabled={isSubmitting || hasErrors}
            >
              {isSubmitting ? "Salvando..." : debt ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
