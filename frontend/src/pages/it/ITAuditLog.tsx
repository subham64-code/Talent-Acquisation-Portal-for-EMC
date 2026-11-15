import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { hrApi } from "../../lib/api";

export default function ITAuditLog() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 15;

  const load = () => {
    setLoading(true);
    hrApi.auditLogs({ page, pageSize, action: action || undefined, entityType: entityType || undefined })
      .then((r: any) => { setItems(r.data.items ?? r.data); setTotal(r.data.total ?? 0); })
      .catch(() => { setItems([]); setTotal(0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [page, action, entityType]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const typeChips = useMemo(() => Array.from(new Set(items.map((a) => a.entityType))).slice(0, 10), [items]);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <span className="inline-flex items-center gap-1.5 text-[0.69rem] font-bold uppercase tracking-[0.1em] text-brand-700 bg-brand-100 border border-brand-200 rounded-full px-2.5 py-1 mb-2">
          Ecometrix · Admin Portal
        </span>
        <h1 className="text-2xl sm:text-[1.7rem] font-extrabold tracking-tight text-gray-900 leading-tight">Audit Trail</h1>
        <p className="mt-1.5 text-sm text-gray-500 max-w-2xl leading-relaxed">
          Every privileged action — immutable, ordered and traceable.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={action}
            onChange={(e) => { setPage(1); setAction(e.target.value); }}
            placeholder="Filter by action (e.g. LOGIN, RESET, EXPORT)…"
            className="w-full rounded-xl border border-[var(--border-strong)] bg-white pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <select
          value={entityType}
          onChange={(e) => { setPage(1); setEntityType(e.target.value); }}
          className="rounded-xl border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          <option value="">All record types</option>
          {typeChips.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Events table */}
      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{total.toLocaleString()} Events</h2>
          <span className="text-[11px] text-gray-500 font-mono">Page {page} of {totalPages}</span>
        </div>
        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading audit events…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full min-w-[860px]">
              <thead>
                <tr><th>Time</th><th>Actor</th><th>Action</th><th>Record</th><th>IP</th></tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No audit events match your filter.</td></tr>
                ) : items.map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono whitespace-nowrap text-gray-600">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="max-w-[190px] truncate text-gray-700">{a.actorEmail || "system"}</td>
                    <td><span className="inline-block rounded-md bg-accent-100 border border-[var(--orange-tint)] text-accent-700 px-2 py-0.5 text-[11px] font-semibold">{a.action}</span></td>
                    <td className="font-mono text-gray-600">{a.entityType}{a.entityId ? `#${String(a.entityId).slice(0, 8)}` : ""}</td>
                    <td className="font-mono text-gray-500">{a.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="rounded-lg border border-[var(--border-strong)] bg-white px-4 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 hover:border-gray-400 disabled:opacity-30 transition-colors">
            ← Previous
          </button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${p === page ? "bg-brand-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900 hover:bg-brand-50"}`}>
                  {p}
                </button>
              );
            })}
          </div>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="rounded-lg border border-[var(--border-strong)] bg-white px-4 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 hover:border-gray-400 disabled:opacity-30 transition-colors">
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
