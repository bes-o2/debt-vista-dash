import * as React from "react";
import { cn } from "@/lib/utils";
import { useDateInput } from "@/hooks/useDateInput";

interface DateInputProps extends Omit<React.ComponentProps<"input">, 'value' | 'onChange'> {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, value, onChange, minDate, maxDate, required, disabled, ...props }, ref) => {
    const { inputValue, isValidDate, handleChange, handleBlur } = useDateInput({
      value,
      onChange,
      minDate,
      maxDate,
    });

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="dd/mm/aaaa"
          maxLength={10}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            !isValidDate && "border-destructive",
            className,
          )}
          {...props}
        />
        {!isValidDate && inputValue.length > 0 && (
          <p className="text-xs text-destructive mt-1">
            Data inválida
          </p>
        )}
      </div>
    );
  },
);
DateInput.displayName = "DateInput";

export { DateInput };
