import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { hrApi } from "../../lib/api";
import DataTable, { type Column } from "../../components/DataTable";

export default function Departments() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ name: "", code: "", description: "", isActive: "true" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    hrApi.departments({ page: 1, pageSize: 100 }).then((r: any) => setItems(r.data.items ?? r.data)).catch(() => setItems([]));
  };

  useEffect(() => {
    hrApi.departments({ page: 1, pageSize: 100 }).then((r: any) => setItems(r.data.items ?? r.data)).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await hrApi.createDepartment({ name: form.name, code: form.code, description: form.description, isActive: form.isActive === "true" });
      setShowCreate(false);
      setForm({ name: "", code: "", description: "", isActive: "true" });
      setMessage("Department created.");
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Save failed.");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this department?")) return;
    try { await hrApi.deleteDepartment(id); load(); } catch (err: any) { setError(err.response?.data?.error?.message || "Delete failed."); }
  };

  const columns: Column<any>[] = [
    { key: "idx", header: "#", render: (_r, i) => <span className="ink-soft">{i + 1}</span> },
    { key: "name", header: "Department", render: (d) => (
      <Link to={`/hr/departments/${d.id}`} className="font-medium text-[#659616] hover:underline">{d.name}</Link>
    ) },
    { key: "code", header: "Code", hideOnMobile: true, render: (d) => <span className="font-mono text-xs ink-soft">{d.code}</span> },
    { key: "desc", header: "Description", hideOnMobile: true, render: (d) => <span className="ink-soft">{d.description || "—"}</span> },
    { key: "active", header: "Active", render: (d) => (
      <span className={`badge whitespace-nowrap ${d.isActive ? "border-[#659616]/30 bg-[#659616]/10 text-[#659616]/80" : "border-[#171717]/15 bg-[#171717]/5 ink-soft"}`}>
        {d.isActive ? "Active" : "Inactive"}
      </span>
    ) },
    { key: "emp", header: "Employees", hideOnMobile: true, render: (d) => <span className="ink-soft">{d._count?.employees ?? 0}</span> },
    { key: "open", header: "Openings", hideOnMobile: true, render: (d) => <span className="ink-soft">{d._count?.jobOpenings ?? 0}</span> },
    {
      key: "actions", header: "Actions",
      render: (d) => (
        <div className="flex gap-1">
          <Link to={`/hr/departments/${d.id}`} className="btn-xs btn-ghost whitespace-nowrap">Drill down</Link>
          <button className="btn-xs btn-danger whitespace-nowrap" onClick={() => remove(d.id)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen surface-app p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold ink-body tracking-tight">Departments</h1>
          <p className="text-sm ink-soft mt-0.5">Manage EMC departments and open their recruitment drill-down.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancel" : "+ Create Department"}</button>
      </div>

      {(error || message) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${error ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-[#659616]/10 border-[#659616]/25 text-[#659616]"}`}>
          {error || message}
        </div>
      )}

      {showCreate && (
        <div className="card p-5 mb-5">
          <h3 className="font-bold ink-body mb-4">Create Department</h3>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Name *</label>
                <input className="input" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Code *</label>
                <input className="input" required value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Description</label>
                <input className="input" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
            </div>
            <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Department"}</button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={loading}
          empty="No departments yet."
          mobileTitle={(d) => d.name}
          mobileMeta={(d) => (
            <>
              <div>{d.code} · {d._count?.employees ?? 0} employees · {d._count?.jobOpenings ?? 0} openings</div>
            </>
          )}
          mobileActions={(d) => (
            <>
              <Link to={`/hr/departments/${d.id}`} className="btn-xs btn-ghost">Drill down</Link>
              <button className="btn-xs btn-danger" onClick={() => remove(d.id)}>Delete</button>
            </>
          )}
        />
      </div>
    </div>
  );
}
