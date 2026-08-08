import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  inline?: boolean;
}

export function Field({ label, hint, children, inline = false }: FieldProps) {
  return (
    <label className={`mt-field ${inline ? 'mt-field--inline' : ''}`}>
      <span className="mt-field__label">{label}</span>
      {children}
      {hint && <span className="mt-field__hint">{hint}</span>}
    </label>
  );
}

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number | undefined;
  onValueChange: (value: number) => void;
  suffix?: string;
}

/** Numeric input that keeps the store free of `NaN`. */
export function NumberInput({ value, onValueChange, suffix, ...rest }: NumberInputProps) {
  const id = useId();
  return (
    <span className="mt-input-wrap">
      <input
        id={id}
        className="mt-input"
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? String(value) : ''}
        onChange={(e) => {
          const parsed = Number.parseFloat(e.target.value);
          onValueChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        {...rest}
      />
      {suffix && <span className="mt-input-wrap__suffix">{suffix}</span>}
    </span>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="mt-input" type="text" {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="mt-input mt-input--area" rows={3} {...props} />;
}

interface SelectProps<T extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: T;
  options: readonly { value: T; label: string }[];
  onValueChange: (value: T) => void;
}

export function Select<T extends string>({ value, options, onValueChange, ...rest }: SelectProps<T>) {
  return (
    <select
      className="mt-input mt-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value as T)}
      {...rest}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface CheckboxProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ label, checked, onCheckedChange, disabled }: CheckboxProps) {
  return (
    <label className="mt-checkbox">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
