import { useMemo, useState, type FormEvent } from "react";
import { hrApi } from "../../lib/api";
import { useDebounced } from "../../hooks/useDebounced";
import { useApiQuery, queryKeys, useInvalidate } from "../../hooks/useApiQuery";
import DataTable, { type Column } from "../../components/DataTable";

const STATUS_TONE: Record<string, string> = {
  DRAFT: "border-[#171717]/15 bg-[#171717]/5 ink-soft",
  PUBLISHED: "border-[#198754]/30 bg-[#198754]/10 text-[#198754]/80",
  CLOSED: "border-[#F28C28]/30 bg-[#F28C28]/10 text-[#F28C28]/80",
};

export default function Openings() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ status: "DRAFT", positions: "1" });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const debouncedSearch = useDebounced(search);
  const invalidate = useInvalidate();

  const params = useMemo(
    () => ({ page: 1, pageSize: 100, search: debouncedSearch || undefined, status: statusFilter || undefined }),
    [debouncedSearch, statusFilter],
  );

  const { data: items = [], isLoading } = useApiQuery<any[]>(
    queryKeys.openings(params),
    () => hrApi.openings(params).then((r: any) => r?.data?.items ?? []),
  );
  const { data: departments = [] } = useApiQuery<any[]>(
    ["departments", "dropdown"],
    () => hrApi.departmentDropdown().then((r: any) => r?.data?.items ?? r?.data ?? []),
  );
  const { data: programs = [] } = useApiQuery<any[]>(
    ["programs", "dropdown"],
    () => hrApi.programs({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? r?.data ?? []),
  );
  const { data: types = [] } = useApiQuery<any[]>(
    ["employment-types", "dropdown"],
    () => hrApi.employmentTypes().then((r: any) => r?.data?.items ?? r?.data ?? []),
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await hrApi.createOpening(form, cvFile || undefined);
      setShowCreate(false);
      setForm({ status: "DRAFT", positions: "1" });
      setCvFile(null);
      setMessage("Opening created.");
      invalidate(["openings", "dashboard"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: string, status: string) => {
    try {
      if (status === "PUBLISHED") await hrApi.publishOpening(id);
      else if (status === "CLOSED") await hrApi.closeOpening(id);
      else await hrApi.reopenOpening(id);
      invalidate(["openings", "dashboard"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Action failed.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this opening? Only possible when it has no applications.")) return;
    try { await hrApi.deleteOpening(id); invalidate(["openings", "dashboard"]); } catch (err: any) { setError(err.response?.data?.error?.message || "Delete failed."); }
  };

  const columns: Column<any>[] = useMemo(() => [
    { key: "idx", header: "#", render: (_r, i) => <span className="ink-soft">{i + 1}</span> },
    { key: "code", header: "Job ID", hideOnMobile: true, render: (o) => <span className="font-mono text-xs ink-soft">{o.jobCode}</span> },
    { key: "title", header: "Title", render: (o) => <span className="font-medium ink-body">{o.title}</span> },
    { key: "dept", header: "Department", hideOnMobile: true, render: (o) => <span className="ink-soft">{o.department?.name || "—"}</span> },
    { key: "program", header: "Program", hideOnMobile: true, render: (o) => <span className="ink-soft text-xs">{o.program?.name || "—"}</span> },
    { key: "pos", header: "Positions", hideOnMobile: true, render: (o) => <span className="ink-soft">{o.positions}</span> },
    { key: "apps", header: "Applications", hideOnMobile: true, render: (o) => <span className="ink-soft">{o._count?.applications ?? 0}</span> },
    { key: "deadline", header: "Deadline", hideOnMobile: true, render: (o) => <span className="ink-soft text-xs">{o.deadline ? new Date(o.deadline).toLocaleDateString() : "—"}</span> },
    { key: "status", header: "Status", render: (o) => <span className={`badge whitespace-nowrap ${STATUS_TONE[o.status]}`}>{o.status}</span> },
    {
      key: "actions", header: "Actions",
      render: (o) => (
        <div className="flex gap-1">
          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => changeStatus(o.id, o.status === "PUBLISHED" ? "CLOSED" : "PUBLISHED")}>
            {o.status === "PUBLISHED" ? "Close" : "Publish"}
          </button>
          <a href={`/hr/submissions?jobOpeningId=${o.id}`} className="btn-xs btn-ghost whitespace-nowrap">Applications</a>
          <button className="btn-xs btn-danger whitespace-nowrap" onClick={() => remove(o.id)}>Delete</button>
        </div>
      ),
    },
  ], []);

  return (
    <div className="min-h-screen surface-app p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold ink-body tracking-tight">Manage Openings</h1>
          <p className="text-sm ink-soft mt-0.5">Create, publish and close EMC vacancies.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancel" : "+ Create Opening"}</button>
      </div>

      {(error || message) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${error ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-[#198754]/10 border-[#198754]/25 text-[#198754]"}`}>
          {error || message}
        </div>
      )}

      {showCreate && (
        <div className="card p-5 mb-5">
          <h3 className="font-bold ink-body mb-4">Create Opening</h3>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Job code</label>
                <input className="input" value={form.jobCode || ""} onChange={(e) => setForm((p) => ({ ...p, jobCode: e.target.value }))} placeholder="Auto-generated" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Job title *</label>
                <input className="input" required value={form.title || ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Department</label>
                <select className="input" required value={form.departmentId || ""} onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}>
                  <option value="">Select…</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Program / Project</label>
                <select className="input" value={form.programId || ""} onChange={(e) => setForm((p) => ({ ...p, programId: e.target.value }))}>
                  <option value="">None</option>
                  {programs.map((pr: any) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Positions</label>
                <input className="input" type="number" min={1} value={form.positions || "1"} onChange={(e) => setForm((p) => ({ ...p, positions: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Location</label>
                <input className="input" value={form.location || ""} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Employment type</label>
                <select className="input" value={form.employmentTypeId || ""} onChange={(e) => setForm((p) => ({ ...p, employmentTypeId: e.target.value }))}>
                  <option value="">Select…</option>
                  {types.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Required qualification</label>
                <input className="input" value={form.requiredQualification || ""} onChange={(e) => setForm((p) => ({ ...p, requiredQualification: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Min experience</label>
                <input className="input" type="number" step="0.5" value={form.minExperience || ""} onChange={(e) => setForm((p) => ({ ...p, minExperience: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Max experience</label>
                <input className="input" type="number" step="0.5" value={form.maxExperience || ""} onChange={(e) => setForm((p) => ({ ...p, maxExperience: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Deadline</label>
                <input className="input" type="date" value={form.deadline || ""} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold ink-soft">Status</label>
                <select className="input" value={form.status || "DRAFT"} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold ink-soft">Job description *</label>
              <textarea className="input" rows={3} required value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold ink-soft">Required skills (comma separated)</label>
              <input className="input" value={form.requiredSkills || ""} placeholder="React, Node.js, PostgreSQL" onChange={(e) => setForm((p) => ({ ...p, requiredSkills: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold ink-soft">JD file (PDF / DOCX / TXT)</label>
              <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => setCvFile(e.target.files?.[0] ?? null)} className="block w-full text-sm ink-soft file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#198754]/10 file:text-[#198754]" />
            </div>
            <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Opening"}</button>
          </form>
        </div>
      )}

      <div className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input className="input" placeholder="Search title or job code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="CLOSED">Closed</option>
        </select>
        <button className="btn-ghost justify-start" onClick={() => { setSearch(""); setStatusFilter(""); }}>Clear filters</button>
      </div>

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={isLoading}
          empty="No openings match your filters."
          mobileTitle={(o) => o.title}
          mobileMeta={(o) => (
            <>
              <div>{o.jobCode} · {o.department?.name || "—"}</div>
              <div>{o.positions} position(s) · {o._count?.applications ?? 0} applications</div>
            </>
          )}
          mobileActions={(o) => (
            <>
              <button className="btn-xs btn-outline" onClick={() => changeStatus(o.id, o.status === "PUBLISHED" ? "CLOSED" : "PUBLISHED")}>
                {o.status === "PUBLISHED" ? "Close" : "Publish"}
              </button>
              <a href={`/hr/submissions?jobOpeningId=${o.id}`} className="btn-xs btn-ghost">Applications</a>
              <button className="btn-xs btn-danger" onClick={() => remove(o.id)}>Delete</button>
            </>
          )}
        />
      </div>
    </div>
  );
}
