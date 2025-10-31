import { useState, useEffect } from 'react';
import { format, parse, isValid } from 'date-fns';

interface UseDateInputProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
}

export function useDateInput({ value, onChange, minDate, maxDate }: UseDateInputProps = {}) {
  const [inputValue, setInputValue] = useState<string>('');
  const [isValidDate, setIsValidDate] = useState(true);

  // Sync external value to input
  useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, 'dd/MM/yyyy'));
    } else if (!value) {
      setInputValue('');
    }
  }, [value]);

  const applyMask = (value: string): string => {
    // Remove everything except numbers
    const numbers = value.replace(/\D/g, '');
    
    // Apply dd/mm/yyyy format
    let masked = '';
    if (numbers.length > 0) {
      masked += numbers.substring(0, 2);
    }
    if (numbers.length >= 3) {
      masked += '/' + numbers.substring(2, 4);
    }
    if (numbers.length >= 5) {
      masked += '/' + numbers.substring(4, 8);
    }
    
    return masked;
  };

  const validateAndParse = (value: string): Date | null => {
    // Only validate if complete (10 chars: dd/mm/yyyy)
    if (value.length !== 10) return null;

    try {
      const parsed = parse(value, 'dd/MM/yyyy', new Date());
      
      // Check if date is valid
      if (!isValid(parsed)) return null;

      // Check min/max constraints
      if (minDate && parsed < minDate) return null;
      if (maxDate && parsed > maxDate) return null;

      return parsed;
    } catch {
      return null;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const masked = applyMask(rawValue);
    
    setInputValue(masked);

    // Only validate when input is complete
    if (masked.length === 10) {
      const parsed = validateAndParse(masked);
      setIsValidDate(parsed !== null);
      onChange?.(parsed || undefined);
    } else if (masked.length === 0) {
      setIsValidDate(true);
      onChange?.(undefined);
    } else {
      setIsValidDate(true); // Don't show error while typing
    }
  };

  const handleBlur = () => {
    if (inputValue.length > 0 && inputValue.length < 10) {
      setIsValidDate(false);
    }
  };

  return {
    inputValue,
    isValidDate,
    handleChange,
    handleBlur,
  };
}
