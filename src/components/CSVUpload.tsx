import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, AlertCircle, CheckCircle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { DebtInput } from "@/hooks/useDebts";
import { toast } from "@/hooks/use-toast";

interface CSVUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (debts: DebtInput[]) => Promise<void>;
}

interface CSVValidationError {
  row: number;
  field: string;
  message: string;
}

interface ParsedDebt {
  row: number;
  debt: DebtInput;
  errors: CSVValidationError[];
}

export const CSVUpload = ({ isOpen, onClose, onUpload }: CSVUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedDebts, setParsedDebts] = useState<ParsedDebt[]>([]);
  const [validationErrors, setValidationErrors] = useState<CSVValidationError[]>([]);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const csvTemplate = `title,description,financed_amount,first_due_date,last_due_date,interest_type,interest_rate,interest_base,calculation_table,iof_rate,additional_fees
Banco do Brasil,Contrato 123456,100000.50,2024-01-15,2026-01-15,monthly,1.5,Pré-fixado,SAC,0,0
Caixa Econômica,Contrato 789012,250000.00,2024-02-01,2025-08-01,annual,12.5,CDI,PRICE,500.00,1000.00`;

  const requiredFields = [
    'title',
    'financed_amount', 
    'first_due_date',
    'last_due_date',
    'interest_type',
    'interest_rate',
    'interest_base',
    'calculation_table'
  ];

  const validInterestTypes = ['monthly', 'annual'];
  const validInterestBases = ['Pré-fixado', 'CDI', 'IPCA', 'SELIC', 'TR', 'IGP-M'];
  const validCalculationTables = ['SAC', 'PRICE'];

  const validateRow = (row: any, rowIndex: number): CSVValidationError[] => {
    const errors: CSVValidationError[] = [];

    // Check required fields
    requiredFields.forEach(field => {
      if (!row[field] || row[field].trim() === '') {
        errors.push({
          row: rowIndex + 1,
          field,
          message: `Campo obrigatório '${field}' está vazio`
        });
      }
    });

    // Validate financed_amount
    if (row.financed_amount) {
      const amount = parseFloat(row.financed_amount);
      if (isNaN(amount) || amount <= 0) {
        errors.push({
          row: rowIndex + 1,
          field: 'financed_amount',
          message: 'Valor financiado deve ser um número maior que zero'
        });
      }
    }

    // Validate dates
    ['first_due_date', 'last_due_date'].forEach(dateField => {
      if (row[dateField]) {
        const date = new Date(row[dateField]);
        if (isNaN(date.getTime())) {
          errors.push({
            row: rowIndex + 1,
            field: dateField,
            message: `Data inválida. Use formato YYYY-MM-DD`
          });
        }
      }
    });

    // Validate date order
    if (row.first_due_date && row.last_due_date) {
      const firstDate = new Date(row.first_due_date);
      const lastDate = new Date(row.last_due_date);
      if (!isNaN(firstDate.getTime()) && !isNaN(lastDate.getTime()) && firstDate >= lastDate) {
        errors.push({
          row: rowIndex + 1,
          field: 'last_due_date',
          message: 'Data final deve ser posterior à data inicial'
        });
      }
    }

    // Validate interest_rate
    if (row.interest_rate) {
      const rate = parseFloat(row.interest_rate);
      if (isNaN(rate) || rate <= 0) {
        errors.push({
          row: rowIndex + 1,
          field: 'interest_rate',
          message: 'Taxa de juros deve ser um número maior que zero'
        });
      }
    }

    // Validate enum fields
    if (row.interest_type && !validInterestTypes.includes(row.interest_type)) {
      errors.push({
        row: rowIndex + 1,
        field: 'interest_type',
        message: `Tipo de juros deve ser: ${validInterestTypes.join(', ')}`
      });
    }

    if (row.interest_base && !validInterestBases.includes(row.interest_base)) {
      errors.push({
        row: rowIndex + 1,
        field: 'interest_base',
        message: `Base de juros deve ser: ${validInterestBases.join(', ')}`
      });
    }

    if (row.calculation_table && !validCalculationTables.includes(row.calculation_table)) {
      errors.push({
        row: rowIndex + 1,
        field: 'calculation_table',
        message: `Tabela de cálculo deve ser: ${validCalculationTables.join(', ')}`
      });
    }

    return errors;
  };

  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      rows.push(row);
    }

    return rows;
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) {
        throw new Error('Arquivo CSV vazio ou formato inválido');
      }

      const parsed: ParsedDebt[] = [];
      const allErrors: CSVValidationError[] = [];

      rows.forEach((row, index) => {
        setProgress(((index + 1) / rows.length) * 50);
        
        const errors = validateRow(row, index);
        allErrors.push(...errors);

        if (errors.length === 0) {
          const debt: DebtInput = {
            title: row.title,
            description: row.description || undefined,
            financed_amount: parseFloat(row.financed_amount),
            first_due_date: row.first_due_date,
            last_due_date: row.last_due_date,
            interest_type: row.interest_type,
            interest_rate: parseFloat(row.interest_rate),
            interest_base: row.interest_base,
            calculation_table: row.calculation_table,
            iof_rate: row.iof_rate ? parseFloat(row.iof_rate) : undefined,
            additional_fees: row.additional_fees ? parseFloat(row.additional_fees) : undefined
          };

          parsed.push({
            row: index + 1,
            debt,
            errors: []
          });
        } else {
          parsed.push({
            row: index + 1,
            debt: {} as DebtInput,
            errors
          });
        }
      });

      setProgress(100);
      setParsedDebts(parsed);
      setValidationErrors(allErrors);

      if (allErrors.length === 0) {
        toast({
          title: "Arquivo processado com sucesso",
          description: `${parsed.length} contratos prontos para importação`,
        });
      } else {
        toast({
          title: "Erros encontrados no arquivo",
          description: `${allErrors.length} erros em ${rows.length} linhas`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        toast({
          title: "Formato inválido",
          description: "Por favor, selecione um arquivo CSV",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      processFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    const validDebts = parsedDebts.filter(p => p.errors.length === 0).map(p => p.debt);
    
    if (validDebts.length === 0) {
      toast({
        title: "Nenhum contrato válido",
        description: "Corrija os erros antes de fazer o upload",
        variant: "destructive",
      });
      return;
    }

    try {
      await onUpload(validDebts);
      onClose();
      reset();
    } catch (error) {
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_contratos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setParsedDebts([]);
    setValidationErrors([]);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validDebtsCount = parsedDebts.filter(p => p.errors.length === 0).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload de Contratos em CSV</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <h4 className="font-medium">Template CSV</h4>
              <p className="text-sm text-muted-foreground">
                Baixe o modelo para preencher seus contratos
              </p>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Baixar Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <div>
              <Label>Arquivo CSV</Label>
              <div className="mt-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Processando arquivo...</span>
                </div>
                <Progress value={progress} />
              </div>
            )}
          </div>

          {/* Results */}
          {parsedDebts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {validDebtsCount} contratos válidos
                  </span>
                </div>
                {validationErrors.length > 0 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {validationErrors.length} erros encontrados
                    </span>
                  </div>
                )}
              </div>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Erros de validação:</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {validationErrors.slice(0, 10).map((error, index) => (
                          <p key={index} className="text-xs">
                            Linha {error.row}, campo '{error.field}': {error.message}
                          </p>
                        ))}
                        {validationErrors.length > 10 && (
                          <p className="text-xs font-medium">
                            ... e mais {validationErrors.length - 10} erros
                          </p>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { onClose(); reset(); }}>
              Cancelar
            </Button>
            {validDebtsCount > 0 && (
              <Button onClick={handleUpload} disabled={isProcessing}>
                <Upload className="h-4 w-4 mr-2" />
                Importar {validDebtsCount} Contratos
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};