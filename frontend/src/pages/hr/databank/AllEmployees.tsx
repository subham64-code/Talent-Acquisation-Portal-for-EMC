import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, UsersRound } from "lucide-react";
import Badge from "../../../components/ref/Badge";
import PageHeader from "../../../components/ref/PageHeader";
import DataTable, { type Column } from "../../../components/DataTable";
import DatabankToolbar from "./DatabankToolbar";
import ViewToggle from "./ViewToggle";
import EmployeeCard from "./EmployeeCard";
import { EmptyStateBlock, formatDate, initials } from "./shared";
import { hrApi } from "../../../lib/api";
import { useApiQuery } from "../../../hooks/useApiQuery";

export default function AllEmployeesView({ departments }: { departments: any[] }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [recordType, setRecordType] = useState("");
  const [department, setDepartment] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const { data: rows = [], isLoading } = useApiQuery<any[]>(
    ["employees", "all"],
    () => hrApi.employees({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );

  const withRecord = useMemo(
    () => rows.map((employee) => ({ ...employee, recordType: employee.status === "FORMER" ? "former" : "current" })),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return withRecord.filter((row) => {
      const matchesTerm =
        !term ||
        [row.fullName, row.officialEmail, row.employeeCode, row.designation?.name, row.department?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesType = !recordType || row.recordType === recordType;
      const matchesDepartment = !department || row.departmentId === department;
      return matchesTerm && matchesType && matchesDepartment;
    });
  }, [withRecord, search, recordType, department]);

  const clear = () => {
    setSearch("");
    setRecordType("");
    setDepartment("");
  };

  const handleView = (row: any) => navigate(`/hr/employees/${row.id}`);

  const columns: Column<any>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (row) => (
        <div className="cell-user">
          <div className="avatar">{initials(row.fullName)}</div>
            <div className="cell-user__text">
              <button type="button" className="ta-link cell-user__name" onClick={() => handleView(row)} aria-label={`Open profile of ${row.fullName}`}>{row.fullName}</button>
              <div className="cell-user__sub">{row.officialEmail}</div>
            </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => <Badge variant={row.recordType === "current" ? "green" : "grey"} dot>{row.recordType === "current" ? "Current" : "Former"}</Badge>,
    },
    { key: "id", header: "Employee ID", render: (row) => <span className="cell-strong">{row.employeeCode}</span> },
    { key: "department", header: "Department", render: (row) => row.department?.name || "—" },
    { key: "designation", header: "Designation", render: (row) => row.designation?.name || "—" },
    { key: "joined", header: "Employment Period", render: (row) => <span className="cell-muted">{formatDate(row.status === "FORMER" ? row.leavingDate : row.joiningDate)}</span> },
    { key: "cv", header: "CV", render: (row) => <Badge variant={row.cvFileId ? "green" : "grey"}>{row.cvFileId ? "Attached" : "Missing"}</Badge> },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="cell-actions">
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => handleView(row)} title={row.recordType === "former" ? "View former record" : "View profile"} aria-label={`View ${row.fullName}`}><Eye size={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Employee databank / all"
        title="All Employees"
        subtitle="Every current and former employee record in one combined view. Use the filters to focus on a specific group."
      />

      <DatabankToolbar
        search={search}
        onSearch={setSearch}
        searchLabel="Search all employees"
        searchPlaceholder="Search all employees by name, email or ID…"
        filters={[
          { key: "type", label: "Employee Types", placeholder: "All Employee Types", value: recordType, onChange: setRecordType, options: [{ value: "current", label: "Current Employees" }, { value: "former", label: "Former Employees" }] },
          { key: "department", label: "Departments", placeholder: "All Departments", value: department, onChange: setDepartment, options: departments.map((d: any) => ({ value: d.id, label: d.name })) },
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
          empty={<EmptyStateBlock icon={UsersRound} title="No employees match this view" description="Adjust your search or filters to see current and former employee records." action={<button className="btn btn--outline btn--sm" onClick={clear}>Clear filters</button>} />}
          footer={<><span>Showing <strong>{filtered.length}</strong> of {rows.length} employee records</span><span className="cell-muted">Current + former employees</span></>}
        />
      ) : (
        <div className="employee-card-grid">
          {filtered.map((row) => (
            <EmployeeCard key={`${row.recordType}-${row.id}`} employee={row} onView={handleView} />
          ))}
          {!isLoading && filtered.length === 0 && (
            <div className="card" style={{ gridColumn: "1 / -1" }}><EmptyStateBlock icon={UsersRound} title="No employees match this view" description="Adjust your search or filters to see current and former employee records." action={<button className="btn btn--outline btn--sm" onClick={clear}>Clear filters</button>} /></div>
          )}
        </div>
      )}

    </div>
  );
}
