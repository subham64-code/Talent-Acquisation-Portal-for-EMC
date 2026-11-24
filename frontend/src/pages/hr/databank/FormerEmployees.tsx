import { useEffect, useMemo, useState } from "react";
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
import EmployeeQuickViewModal from "./EmployeeQuickViewModal";
import { EmptyStateBlock, formatDate, initials } from "./shared";
import { hrApi } from "../../../lib/api";
import { useApiQuery, useInvalidate } from "../../../hooks/useApiQuery";
import { useDebounced } from "../../../hooks/useDebounced";

export default function FormerEmployeesView({ departments, designations, employmentTypes, onInvalidate }: {
  departments: any[];
  designations: any[];
  employmentTypes: any[];
  onInvalidate: () => void;
}) {
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleting, setDeleting] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const debouncedSearch = useDebounced(search);

  const params = useMemo(() => ({
    page,
    pageSize: 20,
    status: "FORMER",
    search: debouncedSearch || undefined,
    departmentId: department || undefined,
  }), [page, debouncedSearch, department]);

  const { data, isLoading } = useApiQuery<any>(
    ["employees", "former", params],
    () => hrApi.employees(params).then((r: any) => r?.data ?? {}),
  );
  const rows: any[] = Array.isArray(data) ? data : data?.items ?? [];
  useEffect(() => {
    setPagination({ total: Number(data?.total ?? 0), totalPages: Number(data?.totalPages ?? 1) });
  }, [data?.total, data?.totalPages]);
  useEffect(() => { setPage(1); }, [debouncedSearch, department]);
  const filtered = rows;

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

  const handleDelete = async (mode: "keep"|"current"|"permanent") => {
    if (!deleting) return;
    if (mode === "keep") { setDeleting(null); return; }
    setDeleteLoading(true);
    try {
      await hrApi.deleteEmployee(deleting.id, mode);
      setNotice(mode === "current" ? `${deleting.fullName} moved to current employees.` : `${deleting.fullName} was deleted permanently.`);
      setDeleting(null);
      invalidate(["employees", "employee"]);
      onInvalidate();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The record could not be updated.");
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
          <div className="cell-user__text"><button type="button" className="ta-link cell-user__name" onClick={() => setViewingId(row.id)}>{row.fullName}</button><div className="cell-user__sub">{row.officialEmail}</div></div>
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
      className: "text-center",
      render: (row) => (
        <div className="cell-actions" style={{ justifyContent: "center", width: "100%" }}>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => setViewingId(row.id)} title="View details" aria-label={`View ${row.fullName}`}><Eye size={16} /></button>
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
        <span className="filters-summary">{isLoading ? "Loading records…" : `${pagination.total} former employee records`}</span>
        <ViewToggle value={viewMode} onChange={setViewMode} label="Switch former employee view" />
      </DatabankToolbar>

      {viewMode === "table" ? (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={isLoading}
          empty={<EmptyStateBlock icon={UserMinus} title="No former employees found" description="Add a former employee manually or adjust the current search and filter." action={<Button icon={Plus} size="sm" onClick={() => setAddOpen(true)}>Add Former Employee</Button>} />}
          footer={<><span>Page <strong>{page}</strong> of {pagination.totalPages} · {pagination.total} records</span><span className="databank-pager"><button type="button" className="btn btn--outline btn--sm" disabled={page <= 1 || isLoading} onClick={() => setPage(page - 1)}>Previous</button><button type="button" className="btn btn--outline btn--sm" disabled={page >= pagination.totalPages || isLoading} onClick={() => setPage(page + 1)}>Next</button></span></>}
        />
      ) : (
        <div className="employee-card-grid">
          {filtered.map((row) => (
            <EmployeeCard key={row.id} employee={row} onView={(person) => setViewingId(person.id)} onEdit={(person) => void openEdit(person)} onDelete={setDeleting} />
          ))}
          {!isLoading && filtered.length === 0 && <div className="card" style={{ gridColumn: "1 / -1" }}><EmptyStateBlock icon={UserMinus} title="No former employees found" description="Add a former employee manually or adjust the current search and filter." action={<Button icon={Plus} size="sm" onClick={() => setAddOpen(true)}>Add Former Employee</Button>} /></div>}
        </div>
      )}

      <EmployeeFormModal open={addOpen || Boolean(editing)} onClose={() => { setAddOpen(false); setEditing(null); }} mode="former" employee={editing} departments={departments} designations={designations} employmentTypes={employmentTypes} onSubmit={save} submitLabel={editing ? "Save Changes" : "Save Former Employee"} />

      <EmployeeQuickViewModal employeeId={viewingId} onClose={() => setViewingId(null)} />

      <Modal
        open={Boolean(deleting)}
        onClose={() => (deleteLoading ? undefined : setDeleting(null))}
        title="Delete former employee"
        size="sm"
        footer={<div className="flex flex-wrap gap-2 justify-end"><Button variant="outline" onClick={() => handleDelete("keep")} disabled={deleteLoading}>Keep record</Button><Button variant="secondary" onClick={() => handleDelete("current")} loading={deleteLoading}>Move to current</Button><Button variant="danger" onClick={() => handleDelete("permanent")} loading={deleteLoading}>Delete permanently</Button></div>}
      >
        <p>{deleting ? `Choose action for ${deleting.fullName} (${deleting.employeeCode}).` : ""}</p>
      </Modal>
    </div>
  );
}
