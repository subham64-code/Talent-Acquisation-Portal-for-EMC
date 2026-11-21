import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Send } from "lucide-react";
import { hrApi } from "../../lib/api";
import { useApiQuery, queryKeys, useInvalidate } from "../../hooks/useApiQuery";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import EmployeeStats from "./databank/EmployeeStats";
import EmployeeFormModal from "./databank/EmployeeFormModal";
import InvitationFormModal from "./databank/InvitationFormModal";

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
          <>
            <Button variant="outline" icon={Send} onClick={() => setInviteOpen(true)}>Send Invitation</Button>
            <Button icon={Plus} onClick={() => setAddOpen(true)}>Add Employee</Button>
          </>
        )}
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <EmployeeStats stats={stats} active={tab} onSelect={setTab} />

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
    </div>
  );
}
