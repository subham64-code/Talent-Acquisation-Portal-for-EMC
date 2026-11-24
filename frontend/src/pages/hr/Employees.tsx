import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, Plus, Send } from "lucide-react";
import { hrApi } from "../../lib/api";
import { useApiQuery, queryKeys, useInvalidate } from "../../hooks/useApiQuery";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import Modal from "../../components/ref/Modal";
import Badge from "../../components/ref/Badge";
import DataTable, { type Column } from "../../components/DataTable";
import EmployeeStats from "./databank/EmployeeStats";
import EmployeeFormModal from "./databank/EmployeeFormModal";
import InvitationFormModal from "./databank/InvitationFormModal";
import EmployeeQuickViewModal from "./databank/EmployeeQuickViewModal";
import { formatDate, initials, employeeStatusMeta } from "./databank/shared";

// Each databank tab is its own chunk so opening the page does not download all
// eight views and their individual query/table dependencies up front.
const AllEmployeesView = lazy(() => import("./databank/AllEmployees"));
const CurrentEmployeesView = lazy(() => import("./databank/CurrentEmployees"));
const PipelinedView = lazy(() => import("./databank/PipelinedView"));
const FormerEmployeesView = lazy(() => import("./databank/FormerEmployees"));
const InvitationsView = lazy(() => import("./databank/InvitationsView"));
const SubmissionsView = lazy(() => import("./databank/SubmissionsView"));
const HoldView = lazy(() => import("./databank/HoldView"));
const MasterDepartments = lazy(() => import("./databank/MasterDepartments"));
import RequirePermission from "../../components/RequirePermission";
import { SECTION_PERMISSIONS } from "../../lib/sectionPermissions";

const TAB_DEFS = [
  { key: "all", label: "All Employees" },
  { key: "current", label: "Current Employees" },
  { key: "pipelined", label: "Pipelined Employees" },
  { key: "former", label: "Former Employees" },
  { key: "invitations", label: "Invitations" },
  { key: "submissions", label: "Submissions" },
  { key: "hold", label: "On Hold" },
  { key: "departments", label: "Master Department" },
] as const;

type TabKey = (typeof TAB_DEFS)[number]["key"];

const LEGACY_TAB: Record<string, TabKey> = {
  ALL: "all",
  EXISTING: "current",
  FORMER: "former",
  PIPELINE: "submissions",
  PIPELINED: "pipelined",
};

export default function Employees() {
  const [searchParams, setSearchParams] = useSearchParams();
  const invalidate = useInvalidate();
  const rawTab = searchParams.get("tab") ?? "all";
  const tab: TabKey = (TAB_DEFS.some((t) => t.key === rawTab) ? rawTab : LEGACY_TAB[rawTab.toUpperCase()] ?? "all") as TabKey;

  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [kpiDetail, setKpiDetail] = useState<TabKey | null>(null);
  const [kpiEmployeeId, setKpiEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("tab") && searchParams.get("tab") !== tab) {
      setSearchParams({ tab }, { replace: true });
    }
  }, [searchParams, setSearchParams, tab]);

  const setTab = (next: string) => setSearchParams({ tab: next }, { replace: true });

  const { data: departments = [] } = useApiQuery<any[]>(
    ["departments", "dropdown"],
    () => hrApi.departmentDropdown().then((r: any) => r?.data?.items ?? r?.data ?? []),
  );

  const { data: overview } = useApiQuery<any>(queryKeys.dashboardOverview, () => hrApi.dashboardOverview());
  const stats = {
    totalEmployees: Number(overview?.totalEmployees ?? 0),
    existingEmployees: Number(overview?.existingEmployees ?? 0),
    formerEmployees: Number(overview?.formerEmployees ?? 0),
    pendingInvitations: Number(overview?.pendingInvitations ?? 0),
    pendingSubmissions: Number(overview?.pendingSubmissions ?? 0),
    onHold: Number(overview?.candidatesOnHold ?? 0),
    departments: departments.length,
  };
  const tabCounts: Record<TabKey, number> = {
    all: stats.totalEmployees,
    current: stats.existingEmployees,
    pipelined: Number(overview?.pipelineCandidates ?? 0),
    former: stats.formerEmployees,
    invitations: stats.pendingInvitations,
    submissions: stats.pendingSubmissions,
    hold: Number(overview?.candidatesOnHold ?? 0),
    departments: departments.length,
  };

  const { data: designations = [] } = useApiQuery<any[]>(
    ["designations", "all"],
    () => hrApi.designations({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );
  const { data: employmentTypes = [] } = useApiQuery<any[]>(
    ["employment-types", "all"],
    () => hrApi.employmentTypes({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );

  const counts = { departments, designations, employmentTypes };

  const refresh = () => invalidate(["employees", "employee", "employee-invitations", "employee-submissions", "dashboard"]);

  const kpiTitle: Record<TabKey, string> = { all: "All Employees", current: "Current Employees", pipelined: "Pipelined Employees", former: "Former Employees", invitations: "Pending Invitations", submissions: "Submissions", hold: "On Hold", departments: "Master Departments" };
  const { data: kpiData = [], isLoading: kpiLoading } = useApiQuery<any[]>(
    ["kpi-detail", kpiDetail],
    async () => {
      if (!kpiDetail) return [];
      if (kpiDetail === "all") return (await hrApi.employees({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []));
      if (kpiDetail === "current") return (await hrApi.employees({ page: 1, pageSize: 100, status: "EXISTING" }).then((r: any) => r?.data?.items ?? []));
      if (kpiDetail === "former") return (await hrApi.employees({ page: 1, pageSize: 100, status: "FORMER" }).then((r: any) => r?.data?.items ?? []));
      if (kpiDetail === "invitations") { const all = await hrApi.employees({ page: 1, pageSize: 100 }).then((r:any)=>r?.data?.items??[]); const inv = await Promise.all(all.slice(0,20).map((e:any)=>hrApi.employeeInvitations(e.id).then((r:any)=> (r?.data?.items ?? r?.data?.invitations ?? []).map((i:any)=>({...i, __employee:e.fullName, email:i.email||e.officialEmail}))).catch(()=>[]))); return inv.flat().filter((i:any)=>!i.status || i.status==="PENDING"); }
      if (kpiDetail === "submissions") return (await hrApi.employeeSubmissions({ page: 1, pageSize: 100, status: "PENDING" }).then((r: any) => r?.data?.items ?? []));
      if (kpiDetail === "departments") return (await hrApi.departmentDropdown().then((r: any) => r?.data?.items ?? r?.data ?? []));
      if (kpiDetail === "pipelined") return (await hrApi.candidates({ page: 1, pageSize: 100, status: "PIPELINED" }).then((r: any) => r?.data?.items ?? []));
      if (kpiDetail === "hold") return (await hrApi.candidates({ page: 1, pageSize: 100, status: "ON_HOLD" }).then((r: any) => r?.data?.items ?? []));
      return [];
    },
    { enabled: !!kpiDetail },
  );

  const kpiColumns: Column<any>[] = (() => {
    if (kpiDetail === "departments") return [
      { key: "name", header: "Department", render: (r: any) => <span className="cell-strong">{r.name || "-"}</span> },
      { key: "code", header: "Code", render: (r: any) => r.code || "-" },
      { key: "status", header: "Status", render: (r: any) => <Badge variant={r.isActive === false ? "grey" : "green"}>{r.isActive === false ? "Inactive" : "Active"}</Badge> },
    ];
    if (kpiDetail === "invitations") return [
      { key: "name", header: "Name", render: (r: any) => <span className="cell-strong">{r.fullName || r.name || r.__employee || "-"}</span> },
      { key: "email", header: "Email", render: (r: any) => r.email || r.officialEmail || "-" },
      { key: "status", header: "Status", render: (r: any) => <Badge variant="orange">{r.status || "PENDING"}</Badge> },
      { key: "date", header: "Invited", render: (r: any) => <span className="cell-muted">{formatDate(r.createdAt)}</span> },
    ];
    if (kpiDetail === "submissions" || kpiDetail === "pipelined" || kpiDetail === "hold") return [
      { key: "name", header: "Name", render: (r: any) => <span className="cell-strong">{r.fullName || r.candidate?.fullName || "-"}</span> },
      { key: "email", header: "Email", render: (r: any) => r.email || r.officialEmail || r.candidate?.email || "-" },
      { key: "status", header: "Status", render: (r: any) => <Badge variant="blue">{r.status || "-"}</Badge> },
      { key: "date", header: "Date", render: (r: any) => <span className="cell-muted">{formatDate(r.createdAt || r.updatedAt || r.appliedAt)}</span> },
    ];
    return [
      {
        key: "name", header: "Employee", render: (r: any) => (
          <div className="cell-user">
            <div className="avatar">{initials(r.fullName || "")}</div>
            <div className="cell-user__text">
              <button type="button" className="ta-link cell-user__name" onClick={() => r.id && setKpiEmployeeId(r.id)}>{r.fullName || "-"}</button>
              <div className="cell-user__sub">{r.officialEmail || "—"}</div>
            </div>
          </div>
        ),
      },
      { key: "code", header: "Employee ID", render: (r: any) => <span className="cell-strong">{r.employeeCode || "-"}</span> },
      { key: "dept", header: "Department", render: (r: any) => r.department?.name || "-" },
      { key: "designation", header: "Designation", render: (r: any) => r.designation?.name || "-" },
      { key: "joined", header: "Joined", render: (r: any) => <span className="cell-muted">{formatDate(r.joiningDate)}</span> },
      { key: "status", header: "Status", render: (r: any) => { const m = employeeStatusMeta(r.status); return <Badge variant={m.variant} dot>{m.shortLabel}</Badge>; } },
      { key: "actions", header: "Actions", className: "text-right", render: (r: any) => r.id ? <button type="button" className="btn btn--ghost btn--icon" title="View details" aria-label={`View ${r.fullName}`} onClick={() => setKpiEmployeeId(r.id)}><Eye size={16} /></button> : null },
    ];
  })();

  const createEmployee = async (values: any, cv: File | null) => {
    setError("");
    const body = {
      employeeCode: values.employeeId,
      fullName: values.fullName,
      officialEmail: values.email,
      mobile: values.contactNumber,
      departmentId: values.department || null,
      designationId: values.designation || null,
      employmentTypeId: values.employmentType || null,
      joiningDate: values.joiningDate || null,
      qualification: values.qualification,
      institution: values.institution,
      specialization: values.specialization || null,
      graduationYear: values.passingYear ? Number(values.passingYear) : null,
      totalExperience: values.totalExperience ? Number(values.totalExperience) : null,
      previousOrganization: values.previousCompany || null,
      previousDesignation: values.previousDesignation || null,
      jobResponsibilities: values.jobResponsibilities || null,
    };
    try {
      const created = await hrApi.createEmployee(body);
      const id = created?.data?.item?.id;
      if (cv && id) {
        const fd = new FormData();
        fd.append("cv", cv);
        await hrApi.uploadEmployeeCv(id, fd);
      }
      setNotice(`${values.fullName} was added to the current employee databank.`);
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The employee could not be added.");
      throw err;
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix · Employee CV Management"
        title="Employee Databank"
        subtitle="Manage current and former employee records, self-service invitations and submitted profiles. CV documents are held in one reusable, configurable service."
        actions={tab === "departments" ? undefined : (
          <Button variant="outline" icon={Send} onClick={() => setInviteOpen(true)}>Send Invitation</Button>
        )}
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <EmployeeStats stats={stats} active={tab} onSelect={setTab} onView={(t) => setKpiDetail(t as TabKey)} />

      <div className="databank-panel">
        <nav className="tabs" aria-label="Employee databank sections">
          {TAB_DEFS.map((definition) => (
            <button
              type="button"
              key={definition.key}
              className={`tab ${tab === definition.key ? "active" : ""}`}
              onClick={() => setTab(definition.key)}
              aria-current={tab === definition.key ? "page" : undefined}
            >
              {definition.label}
              <span className={`tab__count ${["invitations", "submissions", "hold"].includes(definition.key) && tabCounts[definition.key] > 0 ? "tab__count--alert" : ""}`}>{tabCounts[definition.key]}</span>
            </button>
          ))}
        </nav>
        <div className="databank-panel__body">
          <Suspense fallback={<div className="loading-block" role="status"><div className="spinner" /> Loading section…</div>}>
            {tab === "all" && <AllEmployeesView departments={counts.departments} />}
            {tab === "current" && <CurrentEmployeesView departments={counts.departments} designations={counts.designations} employmentTypes={counts.employmentTypes} onInvite={() => setInviteOpen(true)} onInvalidate={refresh} />}
            {tab === "pipelined" && <PipelinedView />}
            {tab === "former" && <FormerEmployeesView departments={counts.departments} designations={counts.designations} employmentTypes={counts.employmentTypes} onInvalidate={refresh} />}
            {tab === "invitations" && <InvitationsView />}
            {tab === "submissions" && <SubmissionsView departments={counts.departments} designations={counts.designations} employmentTypes={counts.employmentTypes} />}
            {tab === "hold" && <HoldView />}
            {tab === "departments" && (
              <RequirePermission permission={SECTION_PERMISSIONS.departments}>
                <MasterDepartments />
              </RequirePermission>
            )}
          </Suspense>
        </div>
      </div>

      <EmployeeFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        mode="current"
        departments={counts.departments}
        designations={counts.designations}
        employmentTypes={counts.employmentTypes}
        onSubmit={createEmployee}
        submitLabel="Save Employee"
      />
      <InvitationFormModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <Modal open={!!kpiDetail} onClose={() => { setKpiDetail(null); setKpiEmployeeId(null); }} title={kpiDetail ? kpiTitle[kpiDetail] : "Details"} size="xl">
        <div style={{ marginBottom: 12, color: "var(--muted)", fontSize: 13 }}>
          Total: <strong style={{ color: "var(--ink)" }}>{kpiData.length}</strong>
        </div>
        <div style={{ overflow: "auto", maxHeight: "65vh", display: "grid", gap: 12, paddingRight: 4 }}>
          {kpiLoading && <div className="loading-block" role="status"><div className="spinner" /> Loading…</div>}
          {!kpiLoading && kpiData.length === 0 && <div className="empty-state">No records found.</div>}
          {!kpiLoading && kpiData.map((r: any, i: number) => {
            const fields = kpiDetail === "departments"
              ? [["Department", r.name], ["Code", r.code], ["Status", r.isActive === false ? "Inactive" : "Active"]]
              : kpiDetail === "invitations"
              ? [["Name", r.fullName || r.name || r.__employee], ["Email", r.email || r.officialEmail], ["Status", r.status || "PENDING"], ["Invited", formatDate(r.createdAt)]]
              : (kpiDetail === "submissions" || kpiDetail === "pipelined" || kpiDetail === "hold")
              ? [["Name", r.fullName || r.candidate?.fullName], ["Email", r.email || r.officialEmail || r.candidate?.email], ["Mobile", r.mobile || r.candidate?.mobile], ["Status", r.status], ["Date", formatDate(r.createdAt || r.updatedAt || r.appliedAt)]]
              : [["Name", r.fullName], ["Employee ID", r.employeeCode], ["Email", r.officialEmail || r.email], ["Mobile", r.mobile], ["Department", r.department?.name], ["Designation", r.designation?.name], ["Status", r.status === "FORMER" ? "Former" : "Current"], ["Joining Date", formatDate(r.joiningDate)]];
            return (
              <div key={String(r.id ?? r.code ?? i)} style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--card)", padding: 14 }}>
                <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 10, fontSize: 14 }}>{fields[0]?.[1] || `Record ${i + 1}`}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px 14px" }}>
                  {fields.map(([label, value]) => (
                    <div key={String(label)} style={{ display: "grid", gap: 2 }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</div>
                      <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, wordBreak: "break-word" }}>{value || "-"}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <EmployeeQuickViewModal employeeId={kpiEmployeeId} onClose={() => setKpiEmployeeId(null)} />
    </div>
  );
}
