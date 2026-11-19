import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle, type LucideIcon } from "lucide-react";

function FieldShell({
  id,
  label,
  required,
  optional,
  error,
  hint,
  children,
  className = "",
}: {
  id?: string;
  label?: ReactNode;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`field ${className}`.trim()}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && <span className="field__required" aria-hidden="true">*</span>}
          {optional && <span className="field__optional">(optional)</span>}
        </label>
      )}
      {children}
      {error && (
        <span className="field__error" id={`${id}-error`} role="alert">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </span>
      )}
      {!error && hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
};

export function Input({ label, required, optional, error, hint, id, icon: Icon, className = "", ...props }: InputProps) {
  const autoId = useId();
  const inputId = id || `input-${autoId}`;
  return (
    <FieldShell id={inputId} label={label} required={required} optional={optional} error={error} hint={hint} className={className}>
      {Icon ? (
        <div className="input-wrap">
          <span className="input-wrap__icon"><Icon size={15} aria-hidden="true" /></span>
          <input id={inputId} className={`input ${error ? "input--error" : ""}`} aria-invalid={Boolean(error)} {...props} />
        </div>
      ) : (
        <input id={inputId} className={`input ${error ? "input--error" : ""}`} aria-invalid={Boolean(error)} {...props} />
      )}
    </FieldShell>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  options?: Array<string | { value: string; label: string }>;
  placeholder?: string;
  className?: string;
};

export function Select({ label, required, optional, error, hint, id, options = [], placeholder = "Select an option", className = "", ...props }: SelectProps) {
  const autoId = useId();
  const selectId = id || `select-${autoId}`;
  return (
    <FieldShell id={selectId} label={label} required={required} optional={optional} error={error} hint={hint} className={className}>
      <select id={selectId} className={`select ${error ? "select--error" : ""}`} aria-invalid={Boolean(error)} {...props}>
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const text = typeof option === "string" ? option : option.label;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
    </FieldShell>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  className?: string;
};

export function Textarea({ label, required, optional, error, hint, id, className = "", ...props }: TextareaProps) {
  const autoId = useId();
  const textareaId = id || `textarea-${autoId}`;
  return (
    <FieldShell id={textareaId} label={label} required={required} optional={optional} error={error} hint={hint} className={className}>
      <textarea id={textareaId} className={`textarea ${error ? "textarea--error" : ""}`} aria-invalid={Boolean(error)} {...props} />
    </FieldShell>
  );
}

export default Input;
