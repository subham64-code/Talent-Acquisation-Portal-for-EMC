import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Trash2, UserMinus } from "lucide-react";
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

export default function FormerEmployeesView({ departments, designations, employmentTypes, onInvalidate }: {
  departments: any[];
  designations: any[];
  employmentTypes: any[];
  onInvalidate: () => void;
}) {
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleting, setDeleting] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const { data: rows = [], isLoading } = useApiQuery<any[]>(
    ["employees", "former"],
    () => hrApi.employees({ page: 1, pageSize: 100, status: "FORMER" }).then((r: any) => r?.data?.items ?? []),
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesTerm =
        !term ||
        [row.fullName, row.officialEmail, row.employeeCode, row.designation?.name, row.department?.name, row.previousOrganization]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesDepartment = !department || row.departmentId === department;
      return matchesTerm && matchesDepartment;
    });
  }, [rows, search, department]);

  const openEdit = async (row: any) => {
    setEditLoading(true);
    try {
      const res = await hrApi.employee(row.id);
      setEditing(res?.data?.item ?? row);
    } catch (err: any) {
      setEditing(row);
      setError(err?.response?.data?.error?.message || "The full former employee record could not be loaded; showing available details.");
    } finally {
      setEditLoading(false);
    }
  };

  const clear = () => {
    setSearch("");
    setDepartment("");
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
      leavingDate: editing?.leavingDate ? new Date(editing.leavingDate).toISOString() : new Date().toISOString(),
      status: "FORMER",
      qualification: values.qualification,
      institution: values.institution,
      specialization: values.specialization || null,
      graduationYear: values.passingYear ? Number(values.passingYear) : null,
      totalExperience: values.totalExperience ? Number(values.totalExperience) : null,
      previousOrganization: values.previousCompany || null,
      previousDesignation: values.previousDesignation || null,
      jobResponsibilities: values.jobResponsibilities || null,
      remarks: values.reportingManager || null,
    };
    if (editing) {
      await hrApi.updateEmployee(editing.id, body);
      if (cv) {
        const fd = new FormData();
        fd.append("cv", cv);
        await hrApi.uploadEmployeeCv(editing.id, fd);
      }
      setNotice(`${values.fullName}'s former employee record was updated.`);
    } else {
      const created = await hrApi.createEmployee(body);
      const id = created?.data?.item?.id;
      if (cv && id) {
        const fd = new FormData();
        fd.append("cv", cv);
        await hrApi.uploadEmployeeCv(id, fd);
      }
      setNotice(`${values.fullName} was added to former employee records.`);
    }
    invalidate(["employees", "employee"]);
    onInvalidate();
  };

  const deleteEmployee = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await hrApi.deleteEmployee(deleting.id);
      setNotice(`${deleting.fullName} was removed from former employee records.`);
      setDeleting(null);
      invalidate(["employees", "employee"]);
      onInvalidate();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The former employee record could not be removed.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: Column<any>[] = [
    {
      key: "employee",
      header: "Former Employee",
      render: (row) => (
        <div className="cell-user">
          <div className="avatar">{initials(row.fullName)}</div>
          <div className="cell-user__text"><button type="button" className="ta-link cell-user__name" onClick={() => navigate(`/hr/employees/${row.id}`)}>{row.fullName}</button><div className="cell-user__sub">{row.officialEmail}</div></div>
        </div>
      ),
    },
    { key: "id", header: "Prev. Employee ID", render: (row) => <span className="cell-strong">{row.employeeCode}</span> },
    { key: "department", header: "Prev. Department", render: (row) => row.department?.name || "—" },
    { key: "designation", header: "Prev. Designation", render: (row) => row.designation?.name || "—" },
    { key: "dates", header: "Employment Period", render: (row) => <span className="cell-muted">{formatDate(row.joiningDate)} → {formatDate(row.leavingDate)}</span> },
    { key: "cv", header: "CV", render: (row) => <Badge variant={row.cvFileId ? "green" : "grey"}>{row.cvFileId ? "Attached" : "Missing"}</Badge> },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="cell-actions">
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => navigate(`/hr/employees/${row.id}`)} title="Open employee profile" aria-label={`Open ${row.fullName}`}><Eye size={16} /></button>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => void openEdit(row)} disabled={editLoading} title="Edit record" aria-label={`Edit ${row.fullName}`}><Pencil size={16} /></button>
          <button type="button" className="btn btn--danger-ghost btn--icon" onClick={() => setDeleting(row)} title="Delete record" aria-label={`Delete ${row.fullName}`}><Trash2 size={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Employee databank / former"
        title="Former Employees"
        subtitle="Historical employee records are stored separately from current employees. Previous CVs remain available for reference."
        actions={<Button icon={Plus} onClick={() => setAddOpen(true)}>Add Former Employee</Button>}
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <DatabankToolbar
        search={search}
        onSearch={setSearch}
        searchLabel="Search former employees"
        searchPlaceholder="Search former employees by name, email or previous ID…"
        filters={[{ key: "department", label: "Previous Departments", placeholder: "All Departments", value: department, onChange: setDepartment, options: departments.map((d: any) => ({ value: d.id, label: d.name })) }]}
        onClear={clear}
      >
        <span className="filters-summary">{isLoading ? "Loading records…" : `${filtered.length} former employee records`}</span>
        <ViewToggle value={viewMode} onChange={setViewMode} label="Switch former employee view" />
      </DatabankToolbar>

      {viewMode === "table" ? (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={isLoading}
          empty={<EmptyStateBlock icon={UserMinus} title="No former employees found" description="Add a former employee manually or adjust the current search and filter." action={<Button icon={Plus} size="sm" onClick={() => setAddOpen(true)}>Add Former Employee</Button>} />}
          footer={<><span>Showing <strong>{filtered.length}</strong> former employee record{filtered.length === 1 ? "" : "s"}</span><span className="cell-muted">Separate from current employees</span></>}
        />
      ) : (
        <div className="employee-card-grid">
          {filtered.map((row) => (
            <EmployeeCard key={row.id} employee={row} onView={(person) => navigate(`/hr/employees/${person.id}`)} onEdit={(person) => void openEdit(person)} onDelete={setDeleting} />
          ))}
          {!isLoading && filtered.length === 0 && <div className="card" style={{ gridColumn: "1 / -1" }}><EmptyStateBlock icon={UserMinus} title="No former employees found" description="Add a former employee manually or adjust the current search and filter." action={<Button icon={Plus} size="sm" onClick={() => setAddOpen(true)}>Add Former Employee</Button>} /></div>}
        </div>
      )}

      <EmployeeFormModal open={addOpen || Boolean(editing)} onClose={() => { setAddOpen(false); setEditing(null); }} mode="former" employee={editing} departments={departments} designations={designations} employmentTypes={employmentTypes} onSubmit={save} submitLabel={editing ? "Save Changes" : "Save Former Employee"} />

      <Modal
        open={Boolean(deleting)}
        onClose={() => (deleteLoading ? undefined : setDeleting(null))}
        title="Delete former employee record?"
        size="sm"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteLoading}>Keep record</Button><Button variant="danger" onClick={deleteEmployee} loading={deleteLoading}>Delete record</Button></>}
      >
        <p>{deleting ? `${deleting.fullName} (${deleting.employeeCode}) will be permanently removed from former employee records.` : "The record will be removed."}</p>
      </Modal>
    </div>
  );
}
