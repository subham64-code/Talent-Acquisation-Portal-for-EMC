import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronRight, Eye, LayoutGrid, List, Mail, Pencil, Plus, Trash2, UserMinus, UserPlus, UsersRound } from "lucide-react";
import DataTable, { type Column } from "../../../components/DataTable";
import Badge from "../../../components/ref/Badge";
import PageHeader from "../../../components/ref/PageHeader";
import Button from "../../../components/ref/Button";
import Modal from "../../../components/ref/Modal";
import DatabankToolbar from "./DatabankToolbar";
import ViewToggle from "./ViewToggle";
import EmployeeCard from "./EmployeeCard";
import EmployeeFormModal from "./EmployeeFormModal";
import { EmptyStateBlock, formatDate, initials } from "./shared";
import { hrApi } from "../../../lib/api";
import { useApiQuery, useInvalidate } from "../../../hooks/useApiQuery";

export default function CurrentEmployeesView({ departments, designations, employmentTypes, onInvite, onInvalidate }: {
  departments: any[];
  designations: any[];
  employmentTypes: any[];
  onInvite: () => void;
  onInvalidate: () => void;
}) {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const { data: rows = [], isLoading } = useApiQuery<any[]>(
    ["employees", "current"],
    () => hrApi.employees({ page: 1, pageSize: 100, status: "EXISTING" }).then((r: any) => r?.data?.items ?? []),
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesTerm =
        !term ||
        [row.fullName, row.officialEmail, row.employeeCode, row.designation?.name, row.department?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesDepartment = !department || row.departmentId === department;
      const matchesType = !employmentType || row.employmentTypeId === employmentType;
      return matchesTerm && matchesDepartment && matchesType;
    });
  }, [rows, search, department, employmentType]);

  const clear = () => {
    setSearch("");
    setDepartment("");
    setEmploymentType("");
  };

  const save = async (values: any, cv: File | null) => {
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
    if (editing) {
      await hrApi.updateEmployee(editing.id, body);
      if (cv) {
        const fd = new FormData();
        fd.append("cv", cv);
        await hrApi.uploadEmployeeCv(editing.id, fd);
      }
      setNotice(`${values.fullName}'s record was updated.`);
    } else {
      const created = await hrApi.createEmployee(body);
      const id = created?.data?.item?.id;
      if (cv && id) {
        const fd = new FormData();
        fd.append("cv", cv);
        await hrApi.uploadEmployeeCv(id, fd);
      }
      setNotice(`${values.fullName} was added to the current employee databank.`);
    }
    invalidate(["employees", "employee"]);
    onInvalidate();
  };

  const deleteEmployee = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await hrApi.deleteEmployee(deleting.id);
      setNotice(`${deleting.fullName} was removed from the current employee databank.`);
      setDeleting(null);
      invalidate(["employees", "employee"]);
      onInvalidate();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The employee could not be removed.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: Column<any>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (row) => (
        <div className="cell-user">
          <div className="avatar">{initials(row.fullName)}</div>
          <div className="cell-user__text"><button type="button" className="ta-link cell-user__name" onClick={() => navigate(`/hr/employees/${row.id}`)}>{row.fullName}</button><div className="cell-user__sub">{row.officialEmail}</div></div>
        </div>
      ),
    },
    { key: "id", header: "Employee ID", render: (row) => <span className="cell-strong">{row.employeeCode}</span> },
    { key: "department", header: "Department", render: (row) => row.department?.name || "—" },
    { key: "designation", header: "Designation", render: (row) => row.designation?.name || "—" },
    { key: "type", header: "Type", render: (row) => row.employmentType?.name || "—" },
    { key: "joined", header: "Joined", render: (row) => <span className="cell-muted">{formatDate(row.joiningDate)}</span> },
    { key: "cv", header: "CV", render: (row) => <Badge variant={row.cvFileId ? "green" : "grey"}>{row.cvFileId ? "Attached" : "Missing"}</Badge> },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="cell-actions">
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => navigate(`/hr/employees/${row.id}`)} title="View profile" aria-label={`View ${row.fullName}`}><Eye size={16} /></button>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => setEditing(row)} title="Edit employee" aria-label={`Edit ${row.fullName}`}><Pencil size={16} /></button>
          <button type="button" className="btn btn--danger-ghost btn--icon" onClick={() => setDeleting(row)} title="Delete employee" aria-label={`Delete ${row.fullName}`}><Trash2 size={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Employee databank / current"
        title="Current Employees"
        subtitle="Active employee records stored in the main databank. Open a profile to manage CV documents and employee information."
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <div className="employee-acquisition">
        <div className="employee-acquisition__copy">
          <div className="employee-acquisition__eyebrow">Add employees</div>
          <p>Invite an employee to self-onboard, or create their record manually.</p>
        </div>
        <div className="employee-acquisition__actions">
          <button type="button" className="acquisition-option" onClick={onInvite}>
            <span className="acquisition-option__icon"><Mail size={18} aria-hidden="true" /></span>
            <span className="acquisition-option__text"><span className="acquisition-option__title">Send invitation</span><span className="acquisition-option__desc">Email a secure onboarding link</span></span>
            <ChevronRight className="acquisition-option__chevron" size={16} aria-hidden="true" />
          </button>
          <button type="button" className="acquisition-option" onClick={() => setAddOpen(true)}>
            <span className="acquisition-option__icon acquisition-option__icon--secondary"><UserPlus size={18} aria-hidden="true" /></span>
            <span className="acquisition-option__text"><span className="acquisition-option__title">Add employee manually</span><span className="acquisition-option__desc">Enter details and attach a CV</span></span>
            <ChevronRight className="acquisition-option__chevron" size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <DatabankToolbar
        search={search}
        onSearch={setSearch}
        searchLabel="Search current employees"
        searchPlaceholder="Search current employees by name, email or ID…"
        filters={[
          { key: "department", label: "Departments", placeholder: "All Departments", value: department, onChange: setDepartment, options: departments.map((d: any) => ({ value: d.id, label: d.name })) },
          { key: "employmentType", label: "Employment Types", placeholder: "All Employment Types", value: employmentType, onChange: setEmploymentType, options: employmentTypes.map((t: any) => ({ value: t.id, label: t.name })) },
        ]}
        onClear={clear}
      >
        <span className="filters-summary">{isLoading ? "Loading records…" : `${filtered.length} of ${rows.length} employees shown`}</span>
        <ViewToggle value={viewMode} onChange={setViewMode} label="Switch employee view" />
      </DatabankToolbar>

      {viewMode === "table" ? (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={isLoading}
          empty={<EmptyStateBlock icon={UsersRound} title="No employees match this view" description="Adjust your search or filters, or add a new employee to the databank." action={<Button icon={Plus} size="sm" onClick={() => setAddOpen(true)}>Add Employee</Button>} />}
          footer={<><span>Showing <strong>{filtered.length}</strong> current employee record{filtered.length === 1 ? "" : "s"}</span><span className="cell-muted">Open an employee to manage CV documents</span></>}
        />
      ) : (
        <div className="employee-card-grid">
          {filtered.map((row) => (
            <EmployeeCard key={row.id} employee={row} onView={(item) => navigate(`/hr/employees/${item.id}`)} onEdit={setEditing} onDelete={setDeleting} />
          ))}
          {!isLoading && filtered.length === 0 && <div className="card" style={{ gridColumn: "1 / -1" }}><EmptyStateBlock icon={UsersRound} title="No employees match this view" description="Adjust your search or filters, or add a new employee to the databank." action={<Button icon={Plus} size="sm" onClick={() => setAddOpen(true)}>Add Employee</Button>} /></div>}
        </div>
      )}

      <EmployeeFormModal open={addOpen || Boolean(editing)} onClose={() => { setAddOpen(false); setEditing(null); }} mode="current" employee={editing} departments={departments} designations={designations} employmentTypes={employmentTypes} onSubmit={save} submitLabel={editing ? "Save Changes" : "Save Employee"} />

      <Modal
        open={Boolean(deleting)}
        onClose={() => (deleteLoading ? undefined : setDeleting(null))}
        title="Delete employee record?"
        size="sm"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteLoading}>Keep employee</Button><Button variant="danger" onClick={deleteEmployee} loading={deleteLoading}>Delete employee</Button></>}
      >
        <p>{deleting ? `${deleting.fullName} (${deleting.employeeCode}) will be removed from the current employee databank. This does not create a former employee record.` : "The employee will be removed."}</p>
      </Modal>
    </div>
  );
}
