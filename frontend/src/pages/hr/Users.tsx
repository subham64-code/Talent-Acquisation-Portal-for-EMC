import { useEffect, useState, type FormEvent } from "react";
import { hrApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const ROLE_TONE: Record<string, string> = {
  SUPER_ADMIN: "border-[#198754]/30 bg-[#198754]/10 text-[#198754]/80",
  IT_ADMIN: "border-[#171717]/20 bg-[#171717]/8 ink-body",
  HR_ADMIN: "border-[#F28C28]/30 bg-[#F28C28]/10 text-[#F28C28]/80",
  HR_RECRUITER: "border-[#8BC34A]/40 bg-[#8BC34A]/10 text-[#5E8C31]",
  DEPARTMENT_MANAGER: "border-[#5C5C5C]/25 bg-[#5C5C5C]/10 text-[#5C5C5C]",
  INTERVIEWER: "border-[#171717]/15 bg-[#171717]/5 ink-soft",
};

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [storage, setStorage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ name: "", email: "", roleIds: "", departmentIds: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canManage = (user?.permissions || []).includes("users.manage");
  const canReset = (user?.permissions || []).includes("users.reset");

  const load = () => {
    hrApi.users({ page: 1, pageSize: 100 }).then((r: any) => setUsers(r.data.items ?? r.data)).catch(() => setUsers([]));
  };

  useEffect(() => {
    Promise.all([
      hrApi.users({ page: 1, pageSize: 100 }).then((r: any) => setUsers(r.data.items ?? r.data)).catch(() => setUsers([])),
      hrApi.roles().then((r: any) => setRoles(r.data.roles ?? r.data)).catch(() => setRoles([])),
      hrApi.departmentDropdown().then((r: any) => setDepartments(r.data.items ?? r.data)).catch(() => setDepartments([])),
      canReset ? hrApi.storageOverview().then((r: any) => setStorage(r.data)).catch(() => setStorage(null)) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await hrApi.createUser({
        name: form.name,
        email: form.email,
        roleIds: form.roleIds.split(",").map((s) => s.trim()).filter(Boolean),
        departmentIds: form.departmentIds.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setShowCreate(false);
      setForm({ name: "", email: "", roleIds: "", departmentIds: "" });
      setMessage("HR user invited successfully.");
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not invite the user.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: any) => {
    try {
      await (u.isActive ? hrApi.deactivateUser(u.id) : hrApi.activateUser(u.id));
      setUsers(users.map((x) => (x.id === u.id ? { ...x, isActive: !u.isActive } : x)));
      setMessage(`${u.name} ${u.isActive ? "deactivated" : "activated"}.`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Update failed.");
    }
  };

  const resetUser = async (u: any) => {
    const reason = window.prompt(`Reset ${u.name}? All sessions and pending OTPs will be revoked.`, "Reset by administrator");
    if (reason === null) return;
    try {
      await hrApi.resetUser(u.id, { reason, deactivate: true });
      setMessage(`${u.name} has been reset and deactivated.`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Reset failed.");
    }
  };

  const restoreUser = async (u: any) => {
    try {
      await hrApi.restoreUser(u.id);
      setMessage(`${u.name} restored.`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Restore failed.");
    }
  };

  const enablePassword = async (u: any) => {
    const pwd = window.prompt(`Set a password for ${u.name} (min 8 chars, letters + numbers):`);
    if (!pwd) return;
    try {
      await hrApi.setUserPassword(u.id, pwd);
      setMessage(`Password sign-in enabled for ${u.name}.`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not set the password.");
    }
  };

  return (
    <div className="min-h-screen surface-app p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold ink-body tracking-tight">HR User Management</h1>
          <p className="text-sm ink-soft mt-0.5">
            The HR Department (Main Controller) assigns roles. The IT Administrator can reset any account.
          </p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "+ Invite HR User"}
          </button>
        )}
      </div>

      {(error || message) && (
        <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-[#198754]/10 border-[#198754]/25 text-[#198754]"}`}>
          {error || message}
        </div>
      )}

      {showCreate && canManage && (
        <div className="card p-5 mb-5">
          <h3 className="font-bold ink-body mb-4">Invite HR User</h3>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Full name</label>
                <input className="input" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Official email</label>
                <input className="input" type="email" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold ink-soft">Roles</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {roles.map((r: any) => (
                  <label key={r.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-[#171717]/10 hover:bg-[#171717]/[0.03] cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-[#198754]"
                      checked={form.roleIds.split(",").filter(Boolean).includes(r.id)}
                      onChange={(e) => {
                        const ids = form.roleIds.split(",").filter(Boolean);
                        const next = e.target.checked ? [...ids, r.id] : ids.filter((x) => x !== r.id);
                        setForm((p) => ({ ...p, roleIds: next.join(",") }));
                      }}
                    />
                    <span className="text-sm ink-body">{r.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold ink-soft">Department access (optional)</label>
              <div className="flex flex-wrap gap-2">
                {departments.map((d: any) => (
                  <label key={d.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#171717]/10 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 accent-[#198754]"
                      checked={form.departmentIds.split(",").filter(Boolean).includes(d.id)}
                      onChange={(e) => {
                        const ids = form.departmentIds.split(",").filter(Boolean);
                        const next = e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id);
                        setForm((p) => ({ ...p, departmentIds: next.join(",") }));
                      }}
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>

            <button className="btn-primary" disabled={saving || !form.roleIds}>{saving ? "Inviting…" : "Send Invitation"}</button>
          </form>
        </div>
      )}

      {storage && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold ink-body">Cloud Storage Buckets</h3>
            <span className="text-xs ink-soft">
              {storage.totals?.files ?? 0} files · {((storage.totals?.bytes ?? 0) / 1048576).toFixed(1)} MB · provider: {storage.provider}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
            {(storage.buckets ?? []).map((b: any) => (
              <div key={b.bucket} className="rounded-lg border border-[#171717]/10 px-3 py-2">
                <p className="text-xs font-semibold ink-body truncate">{b.bucket}</p>
                <p className="text-[11px] ink-soft">{b.files} files · {(b.bytes / 1048576).toFixed(1)} MB</p>
              </div>
            ))}
            {(storage.buckets ?? []).length === 0 && (
              <p className="text-sm ink-soft">No files stored yet.</p>
            )}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#171717]/10 flex items-center justify-between">
          <h3 className="font-bold ink-body">Team Members</h3>
          <span className="text-xs ink-soft">{users.length} users</span>
        </div>
        {loading ? (
          <div className="h-64 flex items-center justify-center ink-soft">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Email</th><th>Roles</th><th>Departments</th>
                  <th>Status</th><th>Last login</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any, i: number) => (
                  <tr key={u.id}>
                    <td className="ink-soft">{i + 1}</td>
                    <td className="font-medium ink-body">
                      {u.name}
                      {u.id === user?.id && <span className="ml-2 text-[10px] text-[#198754] font-bold">(you)</span>}
                    </td>
                    <td className="ink-soft">{u.email}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {u.roles?.map((r: any) => (
                          <span key={r.id} className={`badge ${ROLE_TONE[r.role?.key] || "border-[#171717]/15 bg-[#171717]/5 ink-soft"}`}>
                            {r.role?.name || r.role?.key}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-xs ink-soft max-w-[160px] truncate">
                      {u.departments?.map((d: any) => d.name).join(", ") || "All"}
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? "border-[#198754]/30 bg-[#198754]/10 text-[#198754]/80" : "border-red-200 bg-red-50 text-red-700"}`}>
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-xs ink-soft">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {canManage && (
                          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => toggleActive(u)}>
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                        )}
                        {canReset && (
                          <>
                            <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => resetUser(u)}>Reset</button>
                            {!u.isActive && (
                              <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => restoreUser(u)}>Restore</button>
                            )}
                            <button className="btn-xs btn-ghost whitespace-nowrap" onClick={() => enablePassword(u)}>Set password</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 ink-soft">No HR users yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
