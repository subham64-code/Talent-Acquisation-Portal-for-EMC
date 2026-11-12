import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
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
  empty?: string;
  /** Extra fields shown in the mobile card view. */
  mobileTitle?: (row: T) => ReactNode;
  mobileMeta?: (row: T) => ReactNode;
  mobileActions?: (row: T) => ReactNode;
}

/**
 * Responsive table: a real table on laptop/tablet, stacked cards on phones.
 * Keeps every data column accessible on small screens without horizontal scroll.
 */
export default function DataTable<T>({
  columns, rows, rowKey, loading, empty = "No records found.", mobileTitle, mobileMeta, mobileActions,
}: Props<T>) {
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
    return <div className="px-5 py-12 text-center text-sm ink-soft">{empty}</div>;
  }

  return (
    <>
      {/* Desktop / tablet — denser, fits small laptop widths without overflow */}
      <div className="hidden md:block overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.className}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.className}>{c.render(row, i)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <ul className="md:hidden divide-y divide-[#171717]/8">
        {rows.map((row, i) => (
          <li key={rowKey(row, i)} className="p-4">
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
