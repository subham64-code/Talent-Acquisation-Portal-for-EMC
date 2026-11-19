import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { hrApi } from "../../lib/api";
import { useDebounced } from "../../hooks/useDebounced";
import { useApiQuery } from "../../hooks/useApiQuery";
import { useAuth } from "../../context/AuthContext";
import { CONTROLLER_ROLES } from "../../lib/sectionPermissions";

export default function AccessControl() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 250);
  const [selectedId, setSelectedId] = useState("");
  const [access, setAccess] = useState<any>(null);
  const [effective, setEffective] = useState<Record<string, boolean>>({});
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { data: users = [], isLoading: usersLoading } = useApiQuery<any[]>(
    ["users", "access-list", debouncedSearch],
    () => hrApi.users({ page: 1, pageSize: 50, search: debouncedSearch || undefined }).then((r: any) => r?.data?.items ?? r?.data ?? []),
  );

  const loadAccess = useCallback(async (id: string) => {
    setLoadingAccess(true);
    setError("");
    try {
      const r: any = await hrApi.userAccess(id);
      const payload = r?.data ?? r;
      setAccess(payload);
      const map: Record<string, boolean> = {};
      for (const p of payload?.permissions ?? []) map[p.id] = Boolean(p.effective);
      setEffective(map);
    } catch (err: any) {
      setAccess(null);
      setError(err.response?.data?.error?.message || "Could not load this user's access rights.");
    } finally {
      setLoadingAccess(false);
    }
  }, []);

  useEffect(() => { if (selectedId) loadAccess(selectedId); }, [selectedId, loadAccess]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const p of access?.permissions ?? []) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [access]);

  const overridesToSave = useMemo(() => {
    if (!access) return [];
    const list: Array<{ permissionId: string; effect: "GRANT" | "REVOKE" }> = [];
    for (const p of access.permissions ?? []) {
      const want = effective[p.id];
      if (want === undefined) continue;
      if (want === p.base) continue; // equals role default → no override needed
      list.push({ permissionId: p.id, effect: want ? "GRANT" : "REVOKE" });
    }
    return list;
  }, [access, effective]);

  const dirty = useMemo(() => {
    const saved = access?.permissions?.filter((p: any) => (p.override === "GRANT" || p.override === "REVOKE"))
      .map((p: any) => `${p.id}:${p.override}`).sort().join("|");
    const now = overridesToSave.map((o) => `${o.permissionId}:${o.effect}`).sort().join("|");
    return saved !== now;
  }, [access, overridesToSave]);

  const toggle = (p: any) => {
    setEffective((prev) => ({ ...prev, [p.id]: !prev[p.id] }));
    setMessage("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await hrApi.updateUserAccess(selectedId, overridesToSave);
      setMessage("Access rights updated. They apply on the user's next request.");
      await loadAccess(selectedId);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = async () => {
    if (!window.confirm("Put this person's switches back to how their HR role sets them up?")) return;
    setSaving(true);
    setError("");
    try {
      await hrApi.updateUserAccess(selectedId, []);
      setMessage("Switches restored to how their HR role sets them up.");
      await loadAccess(selectedId);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Reset failed.");
    } finally {
      setSaving(false);
    }
  };

  const targetIsController = Boolean(access?.user?.isControllerAccount);
  const meIsController = CONTROLLER_ROLES.some((r) => (me?.roles ?? []).includes(r));

  return (
    <div>
      <div className="page-heading">
        <div>
          <h1 className="page-heading__title">Permissions</h1>
          <p className="page-heading__subtitle">Choose exactly what each HR person may do, in plain words. Everything here is enforced by the system — switch something off and it stops working immediately.</p>
        </div>
      </div>

      {message && (
        <div className="notice notice--success" role="status">
          <div className="notice__body"><div className="notice__title">{message}</div></div>
        </div>
      )}
      {error && (
        <div className="notice notice--error" role="alert">
          <div className="notice__body"><div className="notice__title">{error}</div></div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* User picker */}
        <div className="card p-4 sm:p-5 xl:col-span-1 h-fit">
          <label className="text-xs font-semibold ink-soft uppercase tracking-wider">Select HR user</label>
          <input className="input mt-2" placeholder="Search name, email, role…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ul className="mt-3 divide-y divide-[#171717]/8 max-h-[60vh] overflow-y-auto">
            {usersLoading && <li className="py-6 text-center text-xs ink-soft">Loading users…</li>}
            {users.map((u: any) => (
              <li key={u.id}>
                <button
                  onClick={() => setSelectedId(u.id)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-colors ${selectedId === u.id ? "bg-[#659616]/10 border border-[#659616]/30" : "hover:bg-[#171717]/5"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#659616]/15 text-[#659616] font-bold flex items-center justify-center text-xs">
                      {(u.name || u.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold ink-body truncate">{u.name}</p>
                      <p className="text-[11px] ink-soft truncate">{u.email}</p>
                      <p className="text-[10px] ink-soft truncate">{(u.roles ?? []).map((r: any) => r.role?.name ?? r.role?.key ?? r.name ?? r.key).join(" · ") || "—"}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
            {!usersLoading && users.length === 0 && <li className="py-6 text-center text-xs ink-soft">No users match your search.</li>}
          </ul>
          {!meIsController && (
            <p className="text-[11px] text-orange-700 mt-3">Only the HR Super Admin or IT Admin can change access rights.</p>
          )}
        </div>

        {/* Permission matrix */}
        <div className="card p-4 sm:p-5 xl:col-span-2">
          {!selectedId ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3">🛡️</p>
              <p className="font-bold ink-body">Select an HR user to manage their access</p>
              <p className="text-xs ink-soft mt-1">Select a name on the left to see, change and save exactly what that person may do.</p>
            </div>
          ) : loadingAccess ? (
            <div className="space-y-3 py-6">{[...Array(8)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#171717]/[0.05] animate-pulse" />)}</div>
          ) : !access ? (
            <div className="py-16 text-center ink-soft">Could not load access details.</div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#171717]/10 pb-4 mb-4">
                <div>
                  <h3 className="font-extrabold ink-body">{access.user.name}</h3>
                  <p className="text-xs ink-soft">{access.user.email}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {access.user.roles.map((r: any) => (
                      <span key={r.id} className="badge border-[#171717]/15 bg-[#171717]/5 ink-soft text-[10px]">{r.name}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold ink-soft">Access enabled</p>
                  <p className="text-sm font-bold ink-body">{Object.values(effective).filter(Boolean).length} of {access.permissions?.length ?? 0}</p>
                </div>
              </div>

              {targetIsController && (
                <div className="mb-4 rounded-lg border border-[#FF9412]/40 bg-[#FF9412]/10 px-4 py-3 text-xs text-[#B15A10]">
                  <span className="font-bold">Full-access account.</span> SUPER_ADMIN and IT_ADMIN always keep every permission — overrides are ignored for this user.
                </div>
              )}

              <div className="permission-table-wrapper max-h-[62vh] overflow-auto pr-1">
                <table className="data-table permission-table">
                  <thead>
                    <tr>
                      <th>What they are allowed to do</th>
                      <th style={{ textAlign: "right" }}>Allow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map(([module, perms]) => {
                      const on = perms.filter((p: any) => effective[p.id]).length;
                      return (
                        <Fragment key={module}>
                          <tr className="permission-table__section">
                            <td colSpan={2}>
                              <div className="permission-table__section-cell">
                                <span className="permission-table__section-title">{module}</span>
                                <span className="permission-table__section-count">{on} of {perms.length} switched on</span>
                              </div>
                            </td>
                          </tr>
                          {perms.map((p: any) => {
                            const enabled = Boolean(effective[p.id]);
                            return (
                              <tr key={p.id} className={enabled ? undefined : "permission-table__row--off"}>
                                <td>
                                  <div className="permission-table__label">{p.label || p.key}</div>
                                  <div className="permission-table__desc">{p.description}</div>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={enabled}
                                    aria-label={`${p.label || p.key} for ${access?.user?.name ?? "this user"}`}
                                    disabled={targetIsController}
                                    onClick={() => toggle(p)}
                                    className={`permission-switch${enabled ? " permission-switch--on" : ""}`}
                                  >
                                    <span className="permission-switch__thumb" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-end border-t border-[#171717]/10 pt-4 mt-4">
                <button className="btn btn--ghost" onClick={resetDefaults} disabled={saving || targetIsController}>Reset to role defaults</button>
                <button className="btn btn--primary" onClick={save} disabled={saving || !dirty || targetIsController}>
                  {saving ? "Saving…" : dirty ? "Save Access Changes" : "Saved ✓"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
