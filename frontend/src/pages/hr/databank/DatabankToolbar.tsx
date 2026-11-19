import { Search, X } from "lucide-react";
import type { ReactNode } from "react";

export default function DatabankToolbar({
  search,
  onSearch,
  searchLabel,
  searchPlaceholder,
  filters,
  onClear,
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchLabel: string;
  searchPlaceholder?: string;
  filters?: Array<{ key: string; label: string; placeholder: string; value: string; onChange: (value: string) => void; options: Array<string | { value: string; label: string }> }>;
  onClear?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="page-toolbar">
      <div className="search-box">
        <span className="search-box__icon"><Search size={16} aria-hidden="true" /></span>
        <input
          type="search"
          className="input"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={searchPlaceholder ?? "Search records…"}
          aria-label={searchLabel}
        />
      </div>

      {filters && filters.length > 0 && (
        <div className="filters">
          {filters.map((filter) => (
            <select key={filter.key} className="select" value={filter.value} onChange={(event) => filter.onChange(event.target.value)} aria-label={filter.label}>
              <option value="">{filter.placeholder}</option>
              {filter.options.map((option: any) => typeof option === "string" ? <option key={option} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ))}
        </div>
      )}

      {onClear && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>
          <X size={14} aria-hidden="true" /> Clear
        </button>
      )}
      <div className="page-toolbar__spacer" />
      {children}
    </div>
  );
}
