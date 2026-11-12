import { useEffect, useState, type FormEvent } from "react";
import { hrApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const ROLE_STYLE: Record<string, string> = {
  SUPER_ADMIN: "from-emerald-400/25 to-emerald-500/10 border-emerald-400/30 text-emerald-300",
  IT_ADMIN: "from-orange-400/25 to-red-500/10 border-orange-400/30 text-orange-300",
  HR_ADMIN: "from-amber-400/25 to-yellow-500/10 border-amber-400/30 text-amber-300",
  HR_RECRUITER: "from-sky-400/25 to-cyan-500/10 border-sky-400/30 text-sky-300",
  DEPARTMENT_MANAGER: "from-violet-400/25 to-purple-500/10 border-violet-400/30 text-violet-300",
  INTERVIEWER: "from-slate-400/25 to-slate-500/10 border-slate-400/30 text-slate-300",
};

const GLASS = "rounded-2xl border border-orange-400/15 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl";

export default function ITUserControl() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const canManage = (user?.permissions || []).includes("users.manage");
  const canReset = (user?.permissions || []).includes("users.reset");

  const load = () => {
    hrApi.users({ page: 1, pageSize: 200, search: query || undefined })
      .then((r: any) => setUsers(r.data.items ?? r.data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [query]);

  const filtered = users.filter((u) =>
    filter === "all" ? true : filter === "active" ? u.isActive : !u.isActive,
  );

  const act = async (id: string, fn: () => Promise<any>, okText: string) => {
    setBusy(id);
    setToast(null);
    try {
      await fn();
      setToast({ type: "ok", text: okText });
      load();
    } catch (err: any) {
      setToast({ type: "err", text: err.response?.data?.error?.message || "Operation failed." });
    } finally {
      setBusy(null);
    }
  };

  const resetAccess = (u: any) => {
    const reason = window.prompt(`Reset "${u.name}"?\n\nThis revokes every active session and all pending OTPs, and deactivates the account.`, "Account reset by IT administrator");
    if (reason === null) return;
    act(u.id, () => hrApi.resetUser(u.id, { reason, deactivate: true }), `${u.name} has been reset and deactivated.`);
  };

  const restore = (u: any) => act(u.id, () => hrApi.restoreUser(u.id), `${u.name} has been restored.`);
  const toggleActive = (u: any) =>
    act(u.id, () => (u.isActive ? hrApi.deactivateUser(u.id) : hrApi.activateUser(u.id)), `${u.name} ${u.isActive ? "deactivated" : "activated"}.`);
  const enablePassword = (u: any) => {
    const pwd = window.prompt(`Set a password for ${u.name}\n(min 8 chars, letters + numbers):`);
    if (!pwd) return;
    act(u.id, () => hrApi.setUserPassword(u.id, pwd), `Password sign-in enabled for ${u.name}.`);
  };
  const disablePassword = (u: any) =>
    act(u.id, () => hrApi.setUserPassword(u.id, null), `Password sign-in disabled for ${u.name}.`);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-orange-400 font-extrabold">Access Control</p>
          <h1 className="text-2xl font-extrabold text-white mt-1">User &amp; Privilege Management</h1>
          <p className="text-sm text-white/50 mt-1">Reset accounts, restore access, enforce password sign-in — every action is audited.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 px-3 py-1">{users.filter(u => u.isActive).length} Active</span>
          <span className="rounded-full border border-rose-400/30 bg-rose-400/10 text-rose-300 px-3 py-1">{users.filter(u => !u.isActive).length} Suspended</span>
        </div>
      </div>

      {toast && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-start justify-between gap-3 ${toast.type === "ok" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-rose-400/25 bg-rose-400/10 text-rose-200"}`}>
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} className="font-bold opacity-70">×</button>
        </div>
      )}

      {/* Filters */}
      <div className={`${GLASS} p-4 flex flex-col sm:flex-row gap-3`}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users by name or email…"
          className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-400/50"
        />
        <div className="flex gap-1.5 rounded-xl bg-black/30 border border-white/10 p-1">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-colors ${filter === f ? "bg-orange-500/20 text-orange-200" : "text-white/50 hover:text-white/80"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* User grid */}
      <div className={`${GLASS} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-orange-400/90 font-extrabold">{filtered.length} Accounts</h2>
          {!canManage && <span className="text-[10px] text-white/35">Read-only for your role</span>}
        </div>
        {loading ? (
          <div className="p-8 text-center text-white/40">Loading users…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[880px]">
              <thead>
                <tr className="text-left text-white/35 uppercase tracking-wider">
                  <th className="px-4 py-3">User</th><th className="px-4 py-3">Roles</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last Login</th><th className="px-4 py-3 text-right">Controls</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-[10px] font-extrabold text-black shrink-0">
                          {u.name?.charAt(0)?.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-white/90 truncate max-w-[180px]">{u.name}</p>
                          <p className="text-[10px] text-white/40 truncate max-w-[180px]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles || []).map((r: any) => (
                          <span key={r.id} className={`rounded-md border bg-gradient-to-br ${ROLE_STYLE[r.role?.key] || "from-white/10 to-white/5 border-white/10 text-white/70"} px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide`}>
                            {r.role?.name || r.role?.key}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${u.isActive ? "border-emerald-400/30 text-emerald-300 bg-emerald-400/10" : "border-rose-400/30 text-rose-300 bg-rose-400/10"}`}>
                        {u.isActive ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/45 font-mono whitespace-nowrap">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {canManage && (
                          <button disabled={busy === u.id} onClick={() => toggleActive(u)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-white/70 hover:text-white hover:border-orange-400/40 transition-colors disabled:opacity-40">
                            {u.isActive ? "Suspend" : "Activate"}
                          </button>
                        )}
                        {canReset && u.id !== user?.id && (
                          <>
                            <button disabled={busy === u.id} onClick={() => resetAccess(u)} className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-bold text-rose-300 hover:bg-rose-500/20 transition-colors disabled:opacity-40">
                              Reset
                            </button>
                            {!u.isActive && (
                              <button disabled={busy === u.id} onClick={() => restore(u)} className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-40">
                                Restore
                              </button>
                            )}
                            <button disabled={busy === u.id} onClick={() => enablePassword(u)} className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 text-[10px] font-bold text-sky-300 hover:bg-sky-500/20 transition-colors disabled:opacity-40">
                              Set Password
                            </button>
                            <button disabled={busy === u.id} onClick={() => disablePassword(u)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-white/60 hover:text-white transition-colors disabled:opacity-40">
                              Clear Password
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-white/35">No accounts match your filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
