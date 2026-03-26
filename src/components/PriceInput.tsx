import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { numberToVietnamese } from '@/lib/numberToVietnamese';

interface PriceInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  showTextReading?: boolean;
  suggestions?: number[];
}

export function PriceInput({ 
  value, 
  onChange, 
  label = 'Giá thuê/tháng (VNĐ)', 
  placeholder = '3.000.000',
  required = false,
  showTextReading = true,
  suggestions = [],
}: PriceInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) {
      const numericValue = value.replace(/[^\d]/g, '');
      setDisplayValue(formatNumber(numericValue));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const formatNumber = (num: string): string => {
    if (!num) return '';
    const number = parseInt(num, 10);
    if (isNaN(number)) return '';
    // Use dot as thousands separator (Vietnamese style)
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawValue = input.value;
    const numericValue = rawValue.replace(/[^\d]/g, '');
    const formatted = formatNumber(numericValue);
    
    // Calculate cursor position to prevent jumping
    const cursorPos = input.selectionStart || 0;
    const beforeCursor = rawValue.substring(0, cursorPos);
    const digitsBeforeCursor = beforeCursor.replace(/[^\d]/g, '').length;
    
    setDisplayValue(formatted);
    onChange(numericValue);

    // Restore cursor position after formatting
    requestAnimationFrame(() => {
      if (inputRef.current) {
        let newPos = 0;
        let digitCount = 0;
        for (let i = 0; i < formatted.length; i++) {
          if (formatted[i] !== '.') {
            digitCount++;
          }
          if (digitCount === digitsBeforeCursor) {
            newPos = i + 1;
            break;
          }
        }
        if (digitsBeforeCursor === 0) newPos = 0;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    });
  };

  const textReading = value ? numberToVietnamese(value) : '';

  const handleSuggestionClick = (suggestedValue: number) => {
    const numStr = suggestedValue.toString();
    setDisplayValue(formatNumber(numStr));
    onChange(numStr);
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}{required && ' *'}</Label>}
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        inputMode="numeric"
      />
      {showTextReading && textReading && (
        <p className="text-[11px] text-muted-foreground/70 italic pl-1 leading-snug">
          {textReading}
        </p>
      )}
      {suggestions.length > 0 && (
        <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 pt-1">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-2 py-1 text-[11px] rounded-full border border-border bg-muted/50 hover:bg-primary/10 hover:border-primary/50 transition-colors whitespace-nowrap"
            >
              {(suggestion / 1000000).toFixed(0)}tr
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
