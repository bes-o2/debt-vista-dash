import { useState } from 'react';

/**
 * Hook para inputs de moeda brasileira (BRL)
 * 
 * PADRÃO DO PROJETO:
 * - Não formata durante a digitação (evita salto do cursor)
 * - Formata apenas ao sair do campo (onBlur)
 * - Usa inputMode="decimal" para teclado numérico em mobile
 * - Pattern para aceitar apenas números, vírgulas e pontos
 * - autoComplete="off" para evitar sugestões
 * 
 * @param initialValue - Valor inicial (string formatada ou vazia)
 * @returns { value, numericValue, handleChange, handleBlur, formatCurrency }
 */
export const useBRLInput = (initialValue: string = '') => {
  const [value, setValue] = useState<string>(initialValue);

  // Formatar valor como moeda brasileira (usado no onBlur)
  const formatBRL = (inputValue: string): string => {
    const numericValue = inputValue ? inputValue.replace(/\./g, '').replace(',', '.') : '';
    const parsed = parseFloat(numericValue);
    if (isNaN(parsed) || parsed < 0) return '';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parsed);
  };

  // Converter string formatada para número
  const parseCurrencyInput = (inputValue: string): number => {
    if (!inputValue) return 0;
    // Remove separadores de milhares (pontos) e converte vírgula decimal para ponto
    const numericValue = inputValue.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(numericValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Formatar número como moeda com símbolo
  const formatCurrency = (numericValue: number): string => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numericValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Não formata durante a digitação para preservar posição do cursor
    setValue(e.target.value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Formata apenas ao sair do campo
    const formatted = formatBRL(e.target.value);
    setValue(formatted);
  };

  // Valor numérico atual
  const numericValue = parseCurrencyInput(value);

  return {
    value,
    numericValue,
    handleChange,
    handleBlur,
    formatCurrency,
    setValue,
  };
};

/**
 * Props padrão para inputs de moeda brasileira
 * Use estas props em todos os inputs de valor monetário do projeto
 */
export const BRL_INPUT_PROPS = {
  type: "text" as const,
  inputMode: "decimal" as const,
  pattern: "[0-9.,]*",
  autoComplete: "off",
  placeholder: "0,00",
} as const;