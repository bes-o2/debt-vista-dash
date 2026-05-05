import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useBRLInput, BRL_INPUT_PROPS } from "@/hooks/useBRLInput";


interface CurrencyInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "onBlur"> {
  value?: string;
  onValueChange?: (value: string, numericValue: number) => void;
  showCurrencySymbol?: boolean;
  currencyPosition?: "left" | "right";
}

/**
 * Componente de Input de Moeda Brasileira
 * 
 * PADRÃO DO PROJETO para inputs de valor monetário:
 * - Não formata durante digitação (evita salto do cursor)
 * - Formata apenas ao sair do campo
 * - Teclado numérico em mobile
 * - Símbolo R$ opcional
 * 
 * @example
 * <CurrencyInput 
 *   value={amount}
 *   onValueChange={(formatted, numeric) => setAmount(formatted)}
 *   showCurrencySymbol={true}
 *   placeholder="Digite o valor"
 * />
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ 
    className, 
    value: externalValue = '',
    onValueChange,
    showCurrencySymbol = false,
    currencyPosition = "left",
    ...props 
  }, ref) => {
    const { value, numericValue, handleChange, handleBlur } = useBRLInput(externalValue);

    const internalHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleChange(e);
      onValueChange?.(e.target.value, numericValue);
    };

    const internalHandleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      handleBlur(e);
      onValueChange?.(value, numericValue);
    };

    if (showCurrencySymbol) {
      return (
        <div className="relative group">
          {currencyPosition === "left" && (
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
              <span className="text-lg font-semibold text-muted-foreground group-focus-within:text-primary transition-colors">
                R$
              </span>
            </div>
          )}
          
          <Input
            {...BRL_INPUT_PROPS}
            className={cn(
              showCurrencySymbol && currencyPosition === "left" && "pl-12",
              showCurrencySymbol && currencyPosition === "right" && "pr-16",
              className
            )}
            value={value}
            onChange={internalHandleChange}
            onBlur={internalHandleBlur}
            ref={ref}
            {...props}
          />
          
          {currencyPosition === "right" && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-md">
                BRL
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <Input
        {...BRL_INPUT_PROPS}
        className={className}
        value={value}
        onChange={internalHandleChange}
        onBlur={internalHandleBlur}
        ref={ref}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };