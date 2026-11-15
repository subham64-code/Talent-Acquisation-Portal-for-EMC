import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { hrApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const ROLE_STYLE: Record<string, string> = {
  SUPER_ADMIN: "bg-emerald-100 text-emerald-800 border-emerald-200",
  IT_ADMIN: "bg-orange-100 text-orange-800 border-orange-200",
  HR_ADMIN: "bg-amber-100 text-amber-800 border-amber-200",
  HR_RECRUITER: "bg-sky-100 text-sky-800 border-sky-200",
  DEPARTMENT_MANAGER: "bg-violet-100 text-violet-800 border-violet-200",
  INTERVIEWER: "bg-slate-100 text-slate-700 border-slate-200",
};

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
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[0.69rem] font-bold uppercase tracking-[0.1em] text-brand-700 bg-brand-100 border border-brand-200 rounded-full px-2.5 py-1 mb-2">
            Ecometrix · Admin Portal
          </span>
          <h1 className="text-2xl sm:text-[1.7rem] font-extrabold tracking-tight text-gray-900 leading-tight">User &amp; Privilege Management</h1>
          <p className="mt-1.5 text-sm text-gray-500 max-w-2xl leading-relaxed">
            Reset accounts, restore access, enforce password sign-in — every action is audited.
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">{users.filter(u => u.isActive).length} Active</span>
          <span className="rounded-full border border-red-200 bg-red-50 text-red-700 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">{users.filter(u => !u.isActive).length} Suspended</span>
        </div>
      </div>

      {toast && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-start justify-between gap-3 ${toast.type === "ok" ? "border-brand-200 bg-brand-50 text-brand-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} className="font-bold opacity-70">×</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by name or email…"
            className="w-full rounded-xl border border-[var(--border-strong)] bg-white pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <div className="flex gap-1 rounded-xl bg-[#f6f8f2] border border-[var(--border)] p-1">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-colors ${filter === f ? "bg-brand-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* User table */}
      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{filtered.length} Accounts</h2>
          {!canManage && <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Read-only for your role</span>}
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading users…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full min-w-[880px]">
              <thead>
                <tr><th>User</th><th>Roles</th><th>Status</th><th>Last Login</th><th className="text-right">Controls</th></tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {u.name?.charAt(0)?.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate max-w-[180px]">{u.name}</p>
                          <p className="text-[11px] text-gray-500 truncate max-w-[180px]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(u.roles || []).map((r: any) => (
                          <span key={r.id} className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${ROLE_STYLE[r.role?.key] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                            {r.role?.name || r.role?.key}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${u.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                        {u.isActive ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="font-mono text-gray-500 whitespace-nowrap">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}</td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {canManage && (
                          <button disabled={busy === u.id} onClick={() => toggleActive(u)} className="rounded-lg border border-[var(--border-strong)] bg-white px-2.5 py-1.5 text-[10px] font-bold text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors disabled:opacity-40">
                            {u.isActive ? "Suspend" : "Activate"}
                          </button>
                        )}
                        {canReset && u.id !== user?.id && (
                          <>
                            <button disabled={busy === u.id} onClick={() => resetAccess(u)} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-40">
                              Reset
                            </button>
                            {!u.isActive && (
                              <button disabled={busy === u.id} onClick={() => restore(u)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-40">
                                Restore
                              </button>
                            )}
                            <button disabled={busy === u.id} onClick={() => enablePassword(u)} className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[10px] font-bold text-sky-700 hover:bg-sky-100 transition-colors disabled:opacity-40">
                              Set Password
                            </button>
                            <button disabled={busy === u.id} onClick={() => disablePassword(u)} className="rounded-lg border border-[var(--border-strong)] bg-white px-2.5 py-1.5 text-[10px] font-bold text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-40">
                              Clear Password
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No accounts match your filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
