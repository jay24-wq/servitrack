import { useLayoutEffect, useRef } from 'react';
import { formatInventoryNumber, parseInventoryNumber } from '../../lib/inventory-parts';

type RupiahInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
  placeholder?: string;
  ariaLabel?: string;
};

export function RupiahInput({ id, value, onChange, className, placeholder, ariaLabel }: RupiahInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caretDigit = useRef<number | null>(null);
  const formattedValue = value ? formatInventoryNumber(Number(value)) : '';

  useLayoutEffect(() => {
    if (caretDigit.current === null || !inputRef.current) return;
    let position = 0;
    let digits = 0;
    while (position < formattedValue.length && digits < caretDigit.current) {
      if (/\d/.test(formattedValue[position])) digits += 1;
      position += 1;
    }
    inputRef.current.setSelectionRange(position, position);
    caretDigit.current = null;
  });

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-0 flex h-full items-center font-mono text-xs text-neutral-500">Rp</span>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        value={formattedValue}
        onChange={(event) => {
          const cursor = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
          caretDigit.current = parseInventoryNumber(event.currentTarget.value.slice(0, cursor)).length;
          onChange(parseInventoryNumber(event.currentTarget.value));
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={className}
      />
    </div>
  );
}
