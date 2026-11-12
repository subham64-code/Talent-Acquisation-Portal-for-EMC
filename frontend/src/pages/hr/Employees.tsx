import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { hrApi, api } from "../../lib/api";
import { useDebounced } from "../../hooks/useDebounced";
import { useApiQuery, queryKeys, useInvalidate } from "../../hooks/useApiQuery";
import DataTable, { type Column } from "../../components/DataTable";

type Tab = "EXISTING" | "FORMER" | "PIPELINE";

const PIPELINE_STATUSES = ["APPLIED", "UNDER_REVIEW", "AI_RECOMMENDED", "SHORTLISTED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "ON_HOLD"];
const STAGE_LABEL: Record<string, string> = {
  APPLIED: "Applied", UNDER_REVIEW: "Under Review", AI_RECOMMENDED: "AI Recommended",
  SHORTLISTED: "Shortlisted", INTERVIEW_SCHEDULED: "Interview Scheduled", INTERVIEW_COMPLETED: "Interview Completed", ON_HOLD: "On Hold",
};
const STAGE_TONE: Record<string, string> = {
  SHORTLISTED: "border-[#198754]/30 bg-[#198754]/10 text-[#198754]/80",
  INTERVIEW_SCHEDULED: "border-[#8BC34A]/40 bg-[#8BC34A]/10 text-[#5E8C31]",
  INTERVIEW_COMPLETED: "border-[#8BC34A]/40 bg-[#8BC34A]/10 text-[#5E8C31]",
  ON_HOLD: "border-[#F28C28]/30 bg-[#F28C28]/10 text-[#F28C28]/80",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const newEmployeeCode = () => "EMP" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase();

const emptyEmployee = {
  id: "", employeeCode: "", fullName: "", officialEmail: "", mobile: "",
  departmentId: "", designationId: "", qualification: "", totalExperience: "", relevantExperience: "",
  specialization: "", employmentTypeId: "", joiningDate: "", workLocation: "",
};

export default function Employees() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("EXISTING");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const debouncedSearch = useDebounced(search);
  const invalidate = useInvalidate();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ ...emptyEmployee });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const bulkCsvRef = useRef<HTMLInputElement>(null);

  const params = useMemo(
    () => ({ page: 1, pageSize: 100, search: debouncedSearch || undefined, departmentId: deptFilter || undefined, status: tab === "PIPELINE" ? undefined : tab }),
    [debouncedSearch, deptFilter, tab],
  );

  const { data: items = [], isLoading } = useApiQuery<any[]>(
    queryKeys.employees(params),
    () => hrApi.employees(params).then((r: any) => r?.data?.items ?? []),
  );
  const { data: pipelineItems = [], isLoading: pipelineLoading } = useApiQuery<any[]>(
    ["pipeline", "all", debouncedSearch],
    () => hrApi.applications({ page: 1, pageSize: 100, search: debouncedSearch || undefined }).then((r: any) => r?.data?.items ?? []),
  );
  const { data: departments = [] } = useApiQuery<any[]>(
    ["departments", "dropdown"],
    () => hrApi.departmentDropdown().then((r: any) => r?.data?.items ?? r?.data ?? []),
  );
  const { data: designations = [] } = useApiQuery<any[]>(
    ["designations", "all"],
    () => hrApi.designations({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );
  const { data: types = [] } = useApiQuery<any[]>(
    ["employment-types", "all"],
    () => hrApi.employmentTypes({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );

  const pipeline = useMemo(
    () => pipelineItems.filter((a: any) => PIPELINE_STATUSES.includes(a.status)),
    [pipelineItems],
  );

  const openAdd = () => {
    setForm({ ...emptyEmployee, employeeCode: newEmployeeCode(), id: "" });
    setCvFile(null);
    setShowForm(true);
  };
  const openEdit = (e: any) => {
    setForm({
      id: e.id,
      employeeCode: e.employeeCode ?? "",
      fullName: e.fullName ?? "",
      officialEmail: e.officialEmail ?? "",
      mobile: e.mobile ?? "",
      departmentId: e.departmentId ?? "",
      designationId: e.designationId ?? "",
      qualification: e.qualification ?? "",
      totalExperience: e.totalExperience != null ? String(e.totalExperience) : "",
      relevantExperience: e.relevantExperience != null ? String(e.relevantExperience) : "",
      specialization: e.specialization ?? "",
      employmentTypeId: e.employmentTypeId ?? "",
      joiningDate: e.joiningDate ? String(e.joiningDate).slice(0, 10) : "",
      workLocation: e.workLocation ?? "",
    });
    setCvFile(null);
    setShowForm(true);
  };

  const saveEmployee = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = { ...form };
      if (!form.id) body.status = tab === "FORMER" ? "FORMER" : "EXISTING";
      ["departmentId", "designationId", "employmentTypeId"].forEach((k) => { if (!body[k]) delete body[k]; });
      let employeeId = form.id;
      if (form.id) {
        await hrApi.updateEmployee(form.id, body);
      } else {
        const r: any = await hrApi.createEmployee(body);
        employeeId = r?.data?.item?.id;
      }
      if (cvFile && employeeId) {
        const fd = new FormData();
        fd.append("cv", cvFile);
        await hrApi.uploadEmployeeCv(employeeId, fd);
      }
      setMessage(form.id ? "Employee updated." : "Employee added to the records.");
      setShowForm(false);
      invalidate(["employees", "dashboard"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not save the employee.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEmployee = async (emp: any) => {
    if (!window.confirm(`Delete ${emp.fullName} (${emp.employeeCode})? This cannot be undone.`)) return;
    try {
      await hrApi.deleteEmployee(emp.id);
      setMessage("Employee deleted.");
      invalidate(["employees", "dashboard"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Delete failed.");
    }
  };

  const transfer = async (emp: any) => {
    const toDeptId = window.prompt(
      `Move ${emp.fullName} to which department?\n${departments.map((d: any, i: number) => `${i + 1}. ${d.name}`).join("\n")}\n\nEnter department id:`,
      emp.departmentId || "",
    );
    if (!toDeptId) return;
    const reason = window.prompt("Reason for the transfer:") || "";
    try {
      await hrApi.transferEmployee(emp.id, { toDepartmentId: toDeptId, reason });
      setMessage("Transfer recorded.");
      invalidate(["employees", "dashboard"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Transfer failed.");
    }
  };

  const invite = async (emp: any) => {
    try {
      await hrApi.resendInvitation(emp.id);
      setMessage(`Update invitation sent to ${emp.officialEmail}.`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not send the invitation.");
    }
  };

  const exportExcel = async () => {
    try {
      const reportType = tab === "FORMER" ? "former-employees" : "employees";
      const r = await api.get(`/reports/${reportType}`, { params: { format: "excel" }, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([r.data as any]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed.");
    }
  };

  const parsedBulkEmails = useMemo(() => {
    const raw = bulkText.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const seen = new Set<string>();
    return raw.map((email) => {
      let status: "valid" | "invalid" | "duplicate" = "valid";
      if (!EMAIL_REGEX.test(email)) status = "invalid";
      else if (seen.has(email)) status = "duplicate";
      seen.add(email);
      return { email, status };
    });
  }, [bulkText]);
  const validBulkEmails = useMemo(() => parsedBulkEmails.filter((r) => r.status === "valid").map((r) => r.email), [parsedBulkEmails]);

  const onBulkCsv = (file: File | null | undefined) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) { setError("Please upload a .csv or .txt file of email addresses."); return; }
    const reader = new FileReader();
    reader.onload = () => setBulkText((prev) => `${prev}\n${String(reader.result ?? "")}`);
    reader.readAsText(file);
    if (bulkCsvRef.current) bulkCsvRef.current.value = "";
  };

  const sendBulk = async () => {
    if (validBulkEmails.length === 0) return;
    setBulkSending(true);
    setError("");
    try {
      const r: any = await hrApi.bulkInvitations(validBulkEmails);
      setBulkResult(r?.data ?? r);
      setMessage(`Bulk invitation complete: ${r?.data?.invited ?? 0} sent.`);
      invalidate(["employees"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Bulk invitation failed.");
    } finally {
      setBulkSending(false);
    }
  };

  const pipelineAction = async (app: any, status: string, remarks?: string) => {
    try {
      await hrApi.applicationStatus(app.id, { status, ...(remarks !== undefined ? { remarks } : {}) });
      setMessage(`Application marked as ${STAGE_LABEL[status] ?? status}.`);
      invalidate(["pipeline", "applications", "dashboard"]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Action failed.");
    }
  };

  const viewCv = async (fileId: string) => {
    try {
      const r = await hrApi.fileAccessToken(fileId);
      window.open(r.data.url, "_blank");
    } catch {
      setError("Cannot open the CV.");
    }
  };

  const employeeColumns: Column<any>[] = useMemo(() => [
    { key: "idx", header: "#", render: (_r, i) => <span className="ink-soft">{i + 1}</span> },
    { key: "code", header: "Employee ID", hideOnMobile: true, render: (e) => <span className="font-mono text-xs ink-soft">{e.employeeCode}</span> },
    { key: "name", header: "Name", render: (e) => <span className="font-medium ink-body">{e.fullName}</span> },
    { key: "email", header: "Email", hideOnMobile: true, render: (e) => <span className="ink-soft">{e.officialEmail}</span> },
    { key: "mobile", header: "Mobile", hideOnMobile: true, render: (e) => <span className="ink-soft">{e.mobile || "—"}</span> },
    { key: "dept", header: "Department", render: (e) => <span className="ink-soft">{e.department?.name || "—"}</span> },
    { key: "desig", header: "Designation", hideOnMobile: true, render: (e) => <span className="ink-soft">{e.designation?.name || "—"}</span> },
    { key: "qual", header: "Qualification", hideOnMobile: true, render: (e) => <span className="ink-soft">{e.qualification || "—"}</span> },
    { key: "exp", header: "Exp", hideOnMobile: true, render: (e) => <span className="ink-soft">{e.totalExperience ?? "—"} yrs</span> },
    {
      key: "actions", header: "Actions",
      render: (e) => (
        <div className="flex gap-1 flex-wrap">
          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => openEdit(e)}>Edit</button>
          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => transfer(e)}>Transfer</button>
          <button className="btn-xs btn-ghost whitespace-nowrap" onClick={() => invite(e)}>Invite</button>
          <button className="btn-xs btn-ghost whitespace-nowrap text-red-600" onClick={() => deleteEmployee(e)}>Delete</button>
        </div>
      ),
    },
  ], [departments, designations, types]);

  const pipelineColumns: Column<any>[] = useMemo(() => [
    { key: "idx", header: "#", render: (_r, i) => <span className="ink-soft">{i + 1}</span> },
    { key: "name", header: "Candidate", render: (a) => <span className="font-medium ink-body">{a.candidate?.fullName}</span> },
    { key: "email", header: "Email", hideOnMobile: true, render: (a) => <span className="ink-soft">{a.candidate?.email}</span> },
    { key: "mobile", header: "Mobile", hideOnMobile: true, render: (a) => <span className="ink-soft">{a.candidate?.mobile || "—"}</span> },
    { key: "position", header: "Applied Position", render: (a) => <span className="ink-soft">{a.jobOpening?.title}</span> },
    { key: "dept", header: "Department", hideOnMobile: true, render: (a) => <span className="ink-soft">{a.jobOpening?.department?.name || "—"}</span> },
    { key: "qual", header: "Qual.", hideOnMobile: true, render: (a) => <span className="ink-soft">{a.candidate?.qualification || "—"}</span> },
    { key: "date", header: "Applied", hideOnMobile: true, render: (a) => <span className="ink-soft text-xs">{new Date(a.appliedAt).toLocaleDateString()}</span> },
    { key: "stage", header: "Stage", render: (a) => <span className={`badge whitespace-nowrap ${STAGE_TONE[a.status] ?? "border-[#171717]/15 bg-[#171717]/5 ink-soft"}`}>{STAGE_LABEL[a.status] ?? a.status}</span> },
    { key: "remarks", header: "HR Remarks", hideOnMobile: true, render: (a) => <span className="ink-soft text-xs max-w-[160px] truncate block">{a.hrRemarks || "—"}</span> },
    {
      key: "actions", header: "Actions",
      render: (a) => (
        <div className="flex gap-1 flex-wrap">
          {a.resumeFileId && <button className="btn-xs btn-ghost whitespace-nowrap" onClick={() => viewCv(a.resumeFileId)}>CV</button>}
          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => pipelineAction(a, "SHORTLISTED")} disabled={a.status === "SHORTLISTED"}>Shortlist</button>
          <button className="btn-xs btn-outline whitespace-nowrap" onClick={() => navigate("/hr/interviews")}>Schedule</button>
          <button className="btn-xs btn-outline whitespace-nowrap" title="Mark selected for offer" onClick={() => { if (window.confirm("Mark this candidate as SELECTED? They will become eligible for an offer letter.")) pipelineAction(a, "SELECTED"); }}>Select</button>
          <button className="btn-xs btn-ghost whitespace-nowrap text-red-600" onClick={() => { const r = window.prompt("Rejection reason (optional):") ?? undefined; pipelineAction(a, "REJECTED", r); }}>Reject</button>
        </div>
      ),
    },
  ], [departments]);

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "EXISTING", label: "Existing Employees", count: tab === "EXISTING" ? items.length : undefined },
    { key: "FORMER", label: "Former Employees", count: tab === "FORMER" ? items.length : undefined },
    { key: "PIPELINE", label: "Pipeline Employees", count: pipeline.length },
  ];

  return (
    <div className="min-h-screen surface-app p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold ink-body tracking-tight">Employee Management</h1>
          <p className="text-sm ink-soft mt-0.5">Existing staff, former alumni and candidates moving through the hiring pipeline.</p>
        </div>
        <div className="flex gap-2">
          {tab !== "PIPELINE" && <button className="btn-ghost" onClick={exportExcel}>Export Excel</button>}
          <button className="btn-ghost" onClick={() => { setShowBulk(true); setBulkResult(null); }}>+ Bulk Invitation</button>
          <button className="btn-primary" onClick={openAdd}>+ Add Employee</button>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-[#198754]/10 border border-[#198754]/25 px-4 py-2.5 text-sm text-[#198754] flex items-start justify-between gap-3">
          <span>{message}</span><button onClick={() => setMessage("")} className="font-bold">×</button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800 flex items-start justify-between gap-3">
          <span>{error}</span><button onClick={() => setError("")} className="font-bold">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#171717]/5 mb-5 w-full sm:w-auto overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${tab === t.key ? "surface-card ink-body shadow-sm" : "ink-soft"}`}
          >
            {t.label}{t.count !== undefined && <span className="ml-1.5 tabular-nums text-[#198754] font-bold">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <input className="input" placeholder="Search name, employee id, email, position…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="btn-ghost justify-start" onClick={() => { setSearch(""); setDeptFilter(""); }}>Clear filters</button>
      </div>

      {/* Tables */}
      {tab !== "PIPELINE" ? (
        <div className="card overflow-hidden">
          <DataTable
            columns={employeeColumns}
            rows={items}
            rowKey={(r) => r.id}
            loading={isLoading}
            empty={tab === "EXISTING" ? "No existing employees found. Add one above." : "No former employees recorded yet."}
            mobileTitle={(e) => e.fullName}
            mobileMeta={(e) => (
              <>
                <div>{e.employeeCode} · {e.department?.name || "—"}</div>
                <div>{e.officialEmail}</div>
              </>
            )}
            mobileActions={(e) => (
              <>
                <button className="btn-xs btn-outline" onClick={() => openEdit(e)}>Edit</button>
                <button className="btn-xs btn-ghost" onClick={() => invite(e)}>Invite</button>
                <button className="btn-xs btn-ghost text-red-600" onClick={() => deleteEmployee(e)}>Delete</button>
              </>
            )}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <DataTable
            columns={pipelineColumns}
            rows={pipeline}
            rowKey={(r) => r.id}
            loading={pipelineLoading}
            empty="No candidates in the recruitment pipeline right now."
            mobileTitle={(a) => a.candidate?.fullName}
            mobileMeta={(a) => (
              <>
                <div>{a.jobOpening?.title} · {STAGE_LABEL[a.status] ?? a.status}</div>
                <div>{a.candidate?.email} · {a.candidate?.mobile || "—"}</div>
              </>
            )}
            mobileActions={(a) => (
              <>
                {a.resumeFileId && <button className="btn-xs btn-ghost" onClick={() => viewCv(a.resumeFileId)}>CV</button>}
                <button className="btn-xs btn-outline" onClick={() => pipelineAction(a, "SHORTLISTED")}>Shortlist</button>
                <button className="btn-xs btn-outline" onClick={() => pipelineAction(a, "SELECTED")}>Select</button>
              </>
            )}
          />
        </div>
      )}

      {/* Add/Edit employee modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="card w-full max-w-3xl p-5 sm:p-6 my-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold ink-body text-lg">{form.id ? "Edit Employee" : `Add ${tab === "FORMER" ? "Former" : "Existing"} Employee`}</h3>
              <button className="text-2xl leading-none ink-soft" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={saveEmployee} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold ink-soft">Employee ID</label>
                <input className="input font-mono" required value={form.employeeCode} onChange={(e) => setForm((p) => ({ ...p, employeeCode: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold ink-soft">Full Name *</label>
                <input className="input" required value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="e.g. Priya Nair" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold ink-soft">Official Email *</label>
                <input className="input" type="email" required value={form.officialEmail} onChange={(e) => setForm((p) => ({ ...p, officialEmail: e.target.value }))} placeholder="name@ecometrix.co.in" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold ink-soft">Mobile Number</label>
                <input className="input" inputMode="numeric" value={form.mobile} onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value.replace(/[^\d+]/g, "").slice(0, 13) }))} placeholder="9876543210" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold ink-soft">Department</label>
                <select className="select" value={form.departmentId} onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value, designationId: "" }))}>
                  <option value="">Select…</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold ink-soft">Designation</label>
                <select className="select" value={form.designationId} onChange={(e) => setForm((p) => ({ ...p, designationId: e.target.value }))}>
                  <option value="">Select…</option>
                  {designations.filter((d: any) => !form.departmentId || d.departmentId === form.departmentId).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold ink-soft">Highest Qualification</label>
                <input className="input" value={form.qualification} onChange={(e) => setForm((p) => ({ ...p, qualification: e.target.value }))} placeholder="e.g. M.Tech" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold ink-soft">Work Specialization</label>
                <input className="input" value={form.specialization} onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))} placeholder="e.g. GIS & Water Supply" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold ink-soft">Total Experience (yrs)</label>
                <input className="input" type="number" min={0} step="0.5" value={form.totalExperience} onChange={(e) => setForm((p) => ({ ...p, totalExperience: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold ink-soft">Relevant Experience (yrs)</label>
                <input className="input" type="number" min={0} step="0.5" value={form.relevantExperience} onChange={(e) => setForm((p) => ({ ...p, relevantExperience: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold ink-soft">Employment Type</label>
                <select className="select" value={form.employmentTypeId} onChange={(e) => setForm((p) => ({ ...p, employmentTypeId: e.target.value }))}>
                  <option value="">Select…</option>
                  {types.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold ink-soft">Joining Date</label>
                <input className="input" type="date" value={form.joiningDate} onChange={(e) => setForm((p) => ({ ...p, joiningDate: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-semibold ink-soft">Work Location</label>
                <input className="input" value={form.workLocation} onChange={(e) => setForm((p) => ({ ...p, workLocation: e.target.value }))} placeholder="e.g. Pune HQ" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold ink-soft block mb-1">CV Upload (PDF, DOC, DOCX — max 10 MB)</label>
                <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setCvFile(e.target.files?.[0] ?? null)} />
                <div className="flex items-center gap-3">
                  <button type="button" className="btn-ghost" onClick={() => cvInputRef.current?.click()}>{cvFile ? "Change CV" : "Browse CV"}</button>
                  <span className="text-xs ink-soft truncate max-w-[280px]">{cvFile ? `${cvFile.name} (${(cvFile.size / 1024 / 1024).toFixed(2)} MB)` : "No file selected"}</span>
                </div>
              </div>
              <div className="sm:col-span-2 flex gap-3 justify-end mt-2">
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : form.id ? "Save Changes" : "Add Employee"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk invitation modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setShowBulk(false)}>
          <div className="card w-full max-w-2xl p-5 sm:p-6 my-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold ink-body text-lg">Send Bulk Employee Invitations</h3>
              <button className="text-2xl leading-none ink-soft" onClick={() => setShowBulk(false)}>×</button>
            </div>
            <p className="text-xs ink-soft mb-4">Paste email addresses or upload a CSV (one per line or comma-separated). Unknown emails create pending employee stubs automatically. Active invitations are never duplicated.</p>
            {bulkResult ? (
              <div className="rounded-xl border border-[#198754]/30 bg-[#198754]/5 p-4 text-sm">
                <p className="font-bold text-[#198754] mb-2">Invitation run complete</p>
                <ul className="text-xs ink-soft space-y-1">
                  <li>Sent: <b>{bulkResult.invited}</b></li>
                  <li>New employee records created: <b>{bulkResult.created}</b></li>
                  <li>Skipped (active invitation exists): <b>{bulkResult.skipped?.length ?? 0}</b></li>
                  <li>Failed: <b>{bulkResult.failed?.length ?? 0}</b></li>
                </ul>
                {bulkResult.failed?.length > 0 && <p className="text-[11px] text-red-600 mt-2">{bulkResult.failed.map((f: any) => `${f.email}: ${f.reason}`).join("; ")}</p>}
                <button className="btn-primary mt-4" onClick={() => { setShowBulk(false); setBulkText(""); setBulkResult(null); }}>Done</button>
              </div>
            ) : (
              <>
                <textarea
                  className="input font-mono text-xs"
                  rows={6}
                  placeholder={"priya@ecometrix.co.in\narjun.mehta@ecometrix.co.in\ndivya.iyer@ecometrix.co.in"}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
                <div className="flex items-center gap-3 mt-2">
                  <input ref={bulkCsvRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => onBulkCsv(e.target.files?.[0])} />
                  <button type="button" className="btn-ghost" onClick={() => bulkCsvRef.current?.click()}>Upload CSV</button>
                  <span className="text-[11px] ink-soft">{validBulkEmails.length} valid · {parsedBulkEmails.length - validBulkEmails.length} invalid/duplicate</span>
                </div>
                {parsedBulkEmails.length > 0 && (
                  <div className="mt-3 max-h-40 overflow-y-auto border border-[#171717]/10 rounded-lg">
                    {parsedBulkEmails.slice(0, 60).map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-[#171717]/5 last:border-0">
                        <span className="font-mono truncate">{r.email}</span>
                        <span className={r.status === "valid" ? "text-[#198754] font-semibold" : "text-red-500"}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-3 mt-4">
                  <button className="btn-ghost" onClick={() => setShowBulk(false)}>Cancel</button>
                  <button className="btn-primary" disabled={bulkSending || validBulkEmails.length === 0} onClick={sendBulk}>
                    {bulkSending ? "Sending invitations…" : `Send Bulk Invitation (${validBulkEmails.length})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
