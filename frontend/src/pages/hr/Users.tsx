import { useEffect, useState, type FormEvent } from "react";
import { Mail, ShieldCheck, UserPlus } from "lucide-react";
import { hrApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import PageHeading from "../../components/ref/PageHeading";
import Button from "../../components/ref/Button";
import Modal from "../../components/ref/Modal";
import { Input } from "../../components/ref/Input";
import StatusPill from "../../components/ref/StatusPill";

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [storage, setStorage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ name: string; email: string; roleId: string; departmentIds: string[] }>({ name: "", email: "", roleId: "", departmentIds: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canManage = (user?.permissions || []).includes("users.manage");
  const canReset = (user?.permissions || []).includes("users.reset");

  const load = () => {
    hrApi
      .users({ page: 1, pageSize: 100 })
      .then((r: any) => setUsers(r.data.items ?? r.data))
      .catch(() => setUsers([]));
  };

  useEffect(() => {
    Promise.all([
      hrApi.users({ page: 1, pageSize: 100 }).then((r: any) => setUsers(r.data.items ?? r.data)).catch(() => setUsers([])),
      hrApi.roles().then((r: any) => setRoles(r.data.roles ?? r.data)).catch(() => setRoles([])),
      hrApi.departmentDropdown().then((r: any) => setDepartments(r.data.items ?? r.data)).catch(() => setDepartments([])),
      canReset ? hrApi.storageOverview().then((r: any) => setStorage(r.data)).catch(() => setStorage(null)) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, []);

  const assignableRoles = roles.filter((role: any) => ["HR_ADMIN", "HR_RECRUITER"].includes(role.key));
  const roleHint = (key: string) =>
    key === "HR_ADMIN"
      ? "Full HR access — everywhere except account reset and the audit log."
      : "Recruitment workspace: applications, screening, interviews, offers, databank and reports.";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.roleId) {
      setError("Choose a role: HR Admin or Sub HR.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await hrApi.createUser({
        name: form.name,
        email: form.email,
        roleIds: [form.roleId],
        departmentIds: form.departmentIds,
      });
      setShowCreate(false);
      setForm({ name: "", email: "", roleId: "", departmentIds: [] });
      setMessage(`Invitation sent to ${form.email}. They always sign in with a one-time code emailed to them.`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not invite the user.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: any) => {
    setError("");
    try {
      await (item.isActive ? hrApi.deactivateUser(item.id) : hrApi.activateUser(item.id));
      setUsers(users.map((x) => (x.id === item.id ? { ...x, isActive: !item.isActive } : x)));
      setMessage(`${item.name} ${item.isActive ? "deactivated" : "activated"}.`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Update failed.");
    }
  };

  const resetUser = async (item: any) => {
    const reason = window.prompt(`Reset ${item.name}? All sessions and pending OTPs will be revoked.`, "Reset by administrator");
    if (reason === null) return;
    setError("");
    try {
      await hrApi.resetUser(item.id, { reason, deactivate: true });
      setMessage(`${item.name} has been reset and deactivated.`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Reset failed.");
    }
  };

  const restoreUser = async (item: any) => {
    setError("");
    try {
      await hrApi.restoreUser(item.id);
      setMessage(`${item.name} restored.`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Restore failed.");
    }
  };

  const enablePassword = async (item: any) => {
    const password = window.prompt(`Set a password for ${item.name} (min 8 chars, letters + numbers):`);
    if (!password) return;
    setError("");
    try {
      await hrApi.setUserPassword(item.id, password);
      setMessage(`Password sign-in enabled for ${item.name}.`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not set the password.");
    }
  };

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div>
      <PageHeading
        title="HR team & permissions"
        description="Add HR users, then delegate only the access required for their SOP responsibilities."
        action={
          canManage ? (
            <Button icon={UserPlus} onClick={() => setShowCreate(true)}>
              Add HR user
            </Button>
          ) : undefined
        }
      />

      <div className="callout callout--info">
        <ShieldCheck size={18} />
        <div>
          <strong>Least-privilege control</strong>
          <span>New users are invited first, then role and department access is assigned before they sign in.</span>
        </div>
      </div>

      {(error || message) && (
        <div className={`notice ${error ? "notice--error" : "notice--success"}`} role="status">
          <div className="notice__body">
            <div className="notice__title">{error || message}</div>
          </div>
        </div>
      )}

      <div className="hr-team-layout">
        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title">Team register</h2>
              <p className="card__subtitle">{users.length} delegated HR users</p>
            </div>
            <Mail size={20} className="text-secondary" />
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>HR user</th>
                  <th>Role</th>
                  <th>Departments</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item: any) => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="avatar avatar--sm">{initials(item.name || item.email || "HR")}</span>
                        <div>
                          <strong>{item.name}</strong>
                          <span className="table-muted">{item.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(item.roles ?? []).map((role: any) => (
                          <span key={role.id} className="badge badge--grey">
                            {role.role?.name || role.role?.key}
                          </span>
                        ))}
                        {(item.roles ?? []).length === 0 && <span className="table-muted">—</span>}
                      </div>
                    </td>
                    <td>
                      <span className="table-muted">
                        {(item.departments ?? []).map((department: any) => department.name).join(", ") || "All"}
                      </span>
                    </td>
                    <td>
                      <StatusPill status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">No HR users yet.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title">Account controls</h2>
              <p className="card__subtitle">Manage activation and credentials for each HR user.</p>
            </div>
          </div>
          <div className="flex flex-col gap-1 p-2">
            {users.map((item: any) => (
              <div key={item.id} className="permission-row">
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.isActive ? "Active" : "Inactive"}
                    {item.lastLoginAt ? ` · last login ${new Date(item.lastLoginAt).toLocaleDateString()}` : " · never signed in"}
                  </span>
                </div>
                <div className="table-actions">
                  {canManage && (
                    <button type="button" className="icon-action" onClick={() => toggleActive(item)}>
                      {item.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                   {canReset && (
                     <>
                       <button type="button" className="icon-action" onClick={() => resetUser(item)}>
                         Reset
                       </button>
                       {!item.isActive && (
                         <button type="button" className="icon-action icon-action--success" onClick={() => restoreUser(item)}>
                           Restore
                         </button>
                       )}
                       {(item.roles ?? []).some((r: any) => r.role?.key === "IT_ADMIN") && (
                         <button type="button" className="icon-action" onClick={() => enablePassword(item)}>
                           Set password
                         </button>
                       )}
                     </>
                   )}
                </div>
              </div>
            ))}
            {!canManage && !canReset && (
              <div className="empty-state">Your role cannot modify HR accounts.</div>
            )}
          </div>
        </section>
      </div>

      {storage && (
        <section className="card mt-6">
          <div className="card__header">
            <div>
              <h2 className="card__title">Cloud storage buckets</h2>
              <p className="card__subtitle">
                {storage.totals?.files ?? 0} files · {((storage.totals?.bytes ?? 0) / 1048576).toFixed(1)} MB ·
                provider: {storage.provider}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 px-5 pb-5">
            {(storage.buckets ?? []).map((bucket: any) => (
              <div key={bucket.bucket} className="rounded-lg border border-[#171717]/10 px-3 py-2">
                <p className="text-xs font-semibold ink-body truncate">{bucket.bucket}</p>
                <p className="text-[11px] ink-soft">
                  {bucket.files} files · {(bucket.bytes / 1048576).toFixed(1)} MB
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add HR user"
        subtitle="Creates the account and emails sign-in instructions. HR users always sign in with a one-time code — passwords are not used."
        size="lg"
         footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button icon={Mail} type="submit" form="add-hr-form" loading={saving}>
              Create & send invitation
            </Button>
          </>
        }
      >
        <form id="add-hr-form" onSubmit={submit} className="form-grid">
          <Input
            label="Full name"
            required
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            label="Work email"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <div className="field field--full">
            <span className="field__label">Role <span className="text-red-500">*</span></span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {assignableRoles.map((role: any) => {
                const selected = form.roleId === role.id;
                return (
                  <label
                    key={role.id}
                    className={`flex flex-col gap-1 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selected ? "border-[#659616] bg-[#659616]/[0.06] ring-2 ring-[#659616]/40" : "border-[#171717]/10 hover:bg-[#171717]/[0.03]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="hr-role"
                        className="w-4 h-4 accent-[#659616]"
                        checked={selected}
                        onChange={() => setForm((current) => ({ ...current, roleId: role.id }))}
                      />
                      <span className="text-sm font-semibold ink-body">{role.name}</span>
                    </span>
                    <span className="text-[11px] ink-soft leading-snug pl-6">{roleHint(role.key)}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="field field--full">
            <span className="field__label">
              Department access
              <span className="field__optional"> — leave everything unchecked for access to all departments</span>
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
              {departments.map((department: any) => {
                const checked = form.departmentIds.includes(department.id);
                return (
                  <label
                    key={department.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      checked ? "border-[#659616] bg-[#659616]/[0.06]" : "border-[#171717]/10 hover:bg-[#171717]/[0.03]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-[#659616]"
                      checked={checked}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          departmentIds: checked ? current.departmentIds.filter((id) => id !== department.id) : [...current.departmentIds, department.id],
                        }))
                      }
                    />
                    <span className="text-xs ink-body leading-tight">{department.name}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] ink-soft mt-1.5">{form.departmentIds.length === 0 ? "Access to all departments" : `Access limited to ${form.departmentIds.length} department${form.departmentIds.length === 1 ? "" : "s"}`}</p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
