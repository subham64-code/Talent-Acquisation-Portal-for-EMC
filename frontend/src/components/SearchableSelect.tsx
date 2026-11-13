import { useEffect, useMemo, useRef, useState } from "react";

interface SearchableSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  allowFreeText?: boolean;
}

export default function SearchableSelect({ id, value, onChange, options, placeholder = "Select…", disabled, invalid, allowFreeText = false }: SearchableSelectProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        if (!allowFreeText && query !== value) setQuery(value);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [query, value, allowFreeText]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    return list.slice(0, 60);
  }, [options, query]);

  const commit = (v: string) => {
    onChange(v);
    setQuery(v);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        autoComplete="off"
        className={`input ${invalid ? "!border-red-400 !ring-1 !ring-red-300" : ""}`}
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (allowFreeText) onChange(e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filtered.length) { e.preventDefault(); commit(filtered[0]); }
          if (e.key === "Escape") setOpen(false);
        }}
        aria-invalid={invalid || undefined}
        role="combobox"
        aria-expanded={open}
      />
      {open && !disabled && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-[var(--border-strong)] bg-[var(--card)] shadow-lg py-1 text-sm ink-body">
          {filtered.map((o) => (
            <li key={o}>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-[#198754]/10 ink-body"
                onMouseDown={(e) => { e.preventDefault(); commit(o); }}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
