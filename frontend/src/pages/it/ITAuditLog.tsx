import { useEffect, useMemo, useState } from "react";
import { hrApi } from "../../lib/api";

const GLASS = "rounded-2xl border border-orange-400/15 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl";

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
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-orange-400 font-extrabold">Forensics</p>
        <h1 className="text-2xl font-extrabold text-white mt-1">Audit Trail</h1>
        <p className="text-sm text-white/50 mt-1">Every privileged action — immutable, ordered and traceable.</p>
      </div>

      <div className={`${GLASS} p-4 flex flex-col md:flex-row gap-3`}>
        <input
          value={action}
          onChange={(e) => { setPage(1); setAction(e.target.value); }}
          placeholder="Filter by action (e.g. LOGIN, RESET, EXPORT)…"
          className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-400/50"
        />
        <select
          value={entityType}
          onChange={(e) => { setPage(1); setEntityType(e.target.value); }}
          className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-400/50"
        >
          <option value="">All record types</option>
          {typeChips.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className={`${GLASS} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-orange-400/90 font-extrabold">{total.toLocaleString()} Events</h2>
          <span className="text-[10px] text-white/35 font-mono">Page {page} of {totalPages}</span>
        </div>
        {loading ? (
          <div className="p-10 text-center text-white/40">Loading audit events…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[860px]">
              <thead>
                <tr className="text-left text-white/35 uppercase tracking-wider">
                  <th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-white/35">No audit events match your filter.</td></tr>
                ) : items.map((a) => (
                  <tr key={a.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 text-white/50 font-mono whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-white/70 max-w-[190px] truncate">{a.actorEmail || "system"}</td>
                    <td className="px-4 py-2.5"><span className="inline-block rounded-md bg-orange-400/10 border border-orange-400/20 text-orange-300 px-2 py-0.5 font-semibold">{a.action}</span></td>
                    <td className="px-4 py-2.5 text-white/50 font-mono">{a.entityType}{a.entityId ? `#${String(a.entityId).slice(0, 8)}` : ""}</td>
                    <td className="px-4 py-2.5 text-white/40 font-mono">{a.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-xs font-bold text-white/70 hover:text-white hover:border-orange-400/40 disabled:opacity-30">
            ← Previous
          </button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold ${p === page ? "bg-orange-500/25 text-orange-200 border border-orange-400/40" : "text-white/50 hover:text-white"}`}>
                  {p}
                </button>
              );
            })}
          </div>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-xs font-bold text-white/70 hover:text-white hover:border-orange-400/40 disabled:opacity-30">
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
