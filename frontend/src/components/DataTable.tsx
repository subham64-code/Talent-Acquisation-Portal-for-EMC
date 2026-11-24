import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  /** Hidden on small screens inside the mobile card view. */
  hideOnMobile?: boolean;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  empty?: ReactNode;
  /** Extra fields shown in the mobile card view. */
  mobileTitle?: (row: T) => ReactNode;
  mobileMeta?: (row: T) => ReactNode;
  mobileActions?: (row: T) => ReactNode;
  /** Rich content rendered below the desktop table (e.g. record counters). */
  footer?: ReactNode;
  /** Optional row action, useful for navigating to a record's detail view. */
  onRowClick?: (row: T, index: number) => void;
}

/**
 * Responsive table: a real table on laptop/tablet, stacked cards on phones.
 * Keeps every data column accessible on small screens without horizontal scroll.
 */
export default function DataTable<T>({
  columns, rows, rowKey, loading, empty = "No records found.", mobileTitle, mobileMeta, mobileActions, footer, onRowClick,
}: Props<T>) {
  const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement | HTMLLIElement>, row: T, index: number) => {
    if (!onRowClick) return;
    const target = event.target as HTMLElement;
    if (target.closest("button,a,input,select,textarea")) return;
    onRowClick(row, index);
  };

  const handleMobileKeyDown = (event: React.KeyboardEvent<HTMLLIElement>, row: T, index: number) => {
    if (!onRowClick || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onRowClick(row, index);
  };

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, row: T, index: number) => {
    if (!onRowClick || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onRowClick(row, index);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-[#171717]/[0.05] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    if (typeof empty === "string") return <div className="empty-state">{empty}</div>;
    return <>{empty}</>;
  }

  return (
    <>
      {/* Desktop / tablet — reference data table styling */}
      <div className="table-wrapper hidden md:block">
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.className} style={c.className?.includes("text-right") ? { textAlign: "right" } : c.className?.includes("text-center") ? { textAlign: "center" } : undefined}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                className={onRowClick ? "data-table__row--clickable" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={(event) => handleRowClick(event, row, i)}
                onKeyDown={(event) => handleRowKeyDown(event, row, i)}
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.className} style={c.className?.includes("text-right") ? { textAlign: "right" } : c.className?.includes("text-center") ? { textAlign: "center" } : undefined}>{c.render(row, i)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {footer && <div className="table-footer">{footer}</div>}
      </div>

      {/* Mobile card list */}
      <ul className="md:hidden divide-y divide-[#171717]/8">
        {rows.map((row, i) => (
          <li
            key={rowKey(row, i)}
            className={onRowClick ? "p-4 data-table__row--clickable" : "p-4"}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={(event) => handleRowClick(event, row, i)}
            onKeyDown={(event) => handleMobileKeyDown(event, row, i)}
          >
            {mobileTitle && <div className="font-semibold ink-body text-sm mb-1">{mobileTitle(row)}</div>}
            {mobileMeta && <div className="text-xs ink-soft space-y-0.5">{mobileMeta(row)}</div>}
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs ink-soft">
              {columns.filter((c) => !c.hideOnMobile).map((c) => (
                <span key={c.key} className="flex items-center gap-1.5">
                  <span className="ink-soft">{c.header}:</span>
                  <span className="font-medium">{c.render(row, i)}</span>
                </span>
              ))}
            </div>
            {mobileActions && <div className="mt-3 flex flex-wrap gap-2">{mobileActions(row)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}
