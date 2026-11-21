import { useEffect, useId, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Parses a DD/MM/YYYY string into parts. Returns null unless it is a full valid calendar date. */
export function parseDMYValue(value: string): { day: number; month: number; year: number } | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || year < 1900) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { day, month, year };
}

export const formatDMYValue = (year: number, month: number, day: number) => `${pad2(day)}/${pad2(month)}/${year}`;

const maskDMYInput = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter((part) => part.length > 0);
  return parts.join("/");
};

export default function DatePicker({
  label,
  required,
  optional,
  value,
  onChange,
  error,
  hint,
  id,
  placeholder = "DD/MM/YYYY",
  disabled,
  className = "",
}: {
  label?: string;
  required?: boolean;
  optional?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const autoId = useId();
  const inputId = id || `datepicker-${autoId}`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const today = new Date();
  const todayValue = formatDMYValue(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const parsed = parseDMYValue(value);
    return parsed ? { year: parsed.year, month: parsed.month } : { year: today.getFullYear(), month: today.getMonth() + 1 };
  });

  // Keep the visible month in sync when the value is set externally (e.g. loading a record).
  useEffect(() => {
    const parsed = parseDMYValue(value);
    if (parsed) setView({ year: parsed.year, month: parsed.month });
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selected = parseDMYValue(value);
  const daysInMonth = new Date(view.year, view.month, 0).getDate();
  const firstWeekday = new Date(view.year, view.month - 1, 1).getDay();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const shiftView = (delta: number) => {
    setView((current) => {
      const next = new Date(current.year, current.month - 1 + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  };

  const pickDay = (day: number) => {
    onChange(formatDMYValue(view.year, view.month, day));
    setOpen(false);
  };

  const isSelected = (day: number) =>
    selected !== null && selected.year === view.year && selected.month === view.month && selected.day === day;
  const isToday = (day: number) =>
    today.getFullYear() === view.year && today.getMonth() + 1 === view.month && today.getDate() === day;

  return (
    <div className={`field ${className}`.trim()} ref={rootRef}>
      {label && (
        <label className="field__label" htmlFor={inputId}>
          {label}
          {required && <span className="field__required" aria-hidden="true">*</span>}
          {optional && <span className="field__optional">(optional)</span>}
        </label>
      )}
      <div className="datepicker">
        <input
          id={inputId}
          className={`input datepicker__input ${error ? "input--error" : ""}`}
          aria-invalid={Boolean(error)}
          aria-haspopup="dialog"
          aria-expanded={open}
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(maskDMYInput(event.target.value))}
          onFocus={() => setOpen(true)}
        />
        <button
          type="button"
          className="datepicker__toggle"
          aria-label={open ? "Close calendar" : "Open calendar"}
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          <Calendar size={17} aria-hidden="true" />
        </button>

        {open && (
          <div className="datepicker__popover" role="dialog" aria-label="Choose date">
            <div className="datepicker__nav">
              <button type="button" className="datepicker__navbtn" onClick={() => shiftView(-1)} aria-label="Previous month">
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="datepicker__month">{MONTHS[view.month - 1]} {view.year}</span>
              <button type="button" className="datepicker__navbtn" onClick={() => shiftView(1)} aria-label="Next month">
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="datepicker__grid">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} className="datepicker__weekday">{weekday}</span>
              ))}
              {cells.map((day, index) =>
                day === null ? (
                  <span key={`blank-${index}`} className="datepicker__day datepicker__day--blank" aria-hidden="true" />
                ) : (
                  <button
                    key={day}
                    type="button"
                    className={`datepicker__day${isSelected(day) ? " datepicker__day--selected" : ""}${isToday(day) ? " datepicker__day--today" : ""}`}
                    aria-pressed={isSelected(day)}
                    onClick={() => pickDay(day)}
                  >
                    {day}
                  </button>
                ),
              )}
            </div>
            <div className="datepicker__footer">
              <button type="button" className="datepicker__action" onClick={() => { onChange(todayValue); setView({ year: today.getFullYear(), month: today.getMonth() + 1 }); setOpen(false); }}>Today</button>
              <button type="button" className="datepicker__action" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
            </div>
          </div>
        )}
      </div>
      {error && <span className="field__error" role="alert">{error}</span>}
      {!error && hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}
