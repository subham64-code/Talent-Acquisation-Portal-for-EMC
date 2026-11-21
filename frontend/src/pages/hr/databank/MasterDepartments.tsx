import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Building2, CheckSquare, Eye, Plus, Search, UserMinus, UsersRound, X } from "lucide-react";
import PageHeader from "../../../components/ref/PageHeader";
import Button from "../../../components/ref/Button";
import Badge from "../../../components/ref/Badge";
import StatusPill from "../../../components/ref/StatusPill";
import { EmptyStateBlock, initials } from "./shared";
import { hrApi } from "../../../lib/api";
import { useApiQuery, useInvalidate } from "../../../hooks/useApiQuery";

const PAGE_SIZE = 500;

function initialsFromName(name?: string) {
  return initials(name || "EMC");
}

function makeDepartmentCode(name: string) {
  const value = name.replace(/[^A-Za-z ]/g, "").trim().toUpperCase().replace(/\s+/g, "");
  return `${(value || "DEPT").slice(0, 5)}${String(Date.now()).slice(-3)}`;
}

export default function MasterDepartments() {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [poolSearch, setPoolSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", code: "", description: "" });
  const [codeTouched, setCodeTouched] = useState(false);
  const [assignmentReason, setAssignmentReason] = useState("");
  const [poolSelection, setPoolSelection] = useState<string[]>([]);
  const [assignedSelection, setAssignedSelection] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const refresh = () => invalidate(["employees", "departments", "dashboard", "master-departments"]);

  const { data: departmentsResponse, isLoading: departmentsLoading } = useApiQuery<any>(
    ["master-departments", "all"],
    () => hrApi.departments({ page: 1, pageSize: 100 }),
  );
  const departments: any[] = departmentsResponse?.items ?? departmentsResponse?.data?.items ?? departmentsResponse ?? [];

  const selected = departments.find((department) => department.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && departments.some((department) => department.id === selectedId)) return;
    if (departments.length > 0) setSelectedId(departments[0].id);
    else setSelectedId(null);
  }, [departments, selectedId]);

  useEffect(() => {
    setPoolSelection([]);
    setAssignedSelection([]);
    setEmployeeSearch("");
    setPoolSearch("");
  }, [selectedId]);

  const { data: poolResponse, isLoading: poolLoading } = useApiQuery<any>(
    ["employees", "assignment-pool"],
    () => hrApi.employees({ page: 1, pageSize: PAGE_SIZE }),
  );
  const employeePool: any[] = poolResponse?.items ?? poolResponse?.data?.items ?? poolResponse ?? [];
  const assignedEmployees = useMemo(
    () => (selected?.id ? employeePool.filter((employee) => employee.departmentId === selected.id) : []),
    [employeePool, selected?.id],
  );
  const assignedLoading = poolLoading;

  const visibleDepartments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return departments.filter((department) =>
      !term || [department.name, department.code, department.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [departments, search]);

  const visibleAssigned = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    return assignedEmployees.filter((employee) => {
      if (statusFilter !== "ALL" && employee.status !== statusFilter) return false;
      if (!term) return true;
      return [employee.fullName, employee.employeeCode, employee.officialEmail, employee.designation?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [assignedEmployees, employeeSearch, statusFilter]);

  const assignedIds = useMemo(() => new Set(assignedEmployees.map((employee) => employee.id)), [assignedEmployees]);

  const visiblePool = useMemo(() => {
    const term = poolSearch.trim().toLowerCase();
    return employeePool.filter((employee) => {
      if (assignedIds.has(employee.id)) return false;
      if (!term) return true;
      return [employee.fullName, employee.employeeCode, employee.officialEmail, employee.department?.name, employee.designation?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [employeePool, assignedIds, poolSearch]);

  const currentCount = assignedEmployees.filter((employee) => employee.status === "EXISTING").length;
  const formerCount = assignedEmployees.filter((employee) => employee.status === "FORMER").length;

  const togglePool = (id: string) => {
    setPoolSelection((current) => (current.includes(id) ? current.filter((employeeId) => employeeId !== id) : [...current, id]));
  };

  const toggleAssigned = (id: string) => {
    setAssignedSelection((current) => (current.includes(id) ? current.filter((employeeId) => employeeId !== id) : [...current, id]));
  };

  const toggleVisiblePool = () => {
    const visibleIds = visiblePool.map((employee) => employee.id);
    setPoolSelection((current) => (visibleIds.every((id) => current.includes(id)) ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])]));
  };

  const toggleVisibleAssigned = () => {
    const visibleIds = visibleAssigned.map((employee) => employee.id);
    setAssignedSelection((current) => (visibleIds.every((id) => current.includes(id)) ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])]));
  };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    const name = createForm.name.trim();
    const code = createForm.code.trim().toUpperCase();
    if (name.length < 2 || code.length < 2) {
      setError("Enter at least 2 characters for the department name and code.");
      return;
    }
    setIsWorking(true);
    setError("");
    setNotice("");
    try {
      const created = await hrApi.createDepartment({ name, code, description: createForm.description.trim() || null, isActive: true });
      const createdId = created?.data?.item?.id ?? created?.data?.data?.item?.id;
      if (createdId) setSelectedId(createdId);
      setCreateForm({ name: "", code: "", description: "" });
      setCodeTouched(false);
      setShowCreate(false);
      setNotice(`${name} was added to the department master.`);
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The department could not be created.");
    } finally {
      setIsWorking(false);
    }
  };

  const applyDepartmentSelection = async (action: "assign" | "unassign") => {
    const employeeIds = action === "assign" ? poolSelection : assignedSelection;
    if (!selected || employeeIds.length === 0) return;
    if (action === "unassign" && !window.confirm(`Remove ${employeeIds.length} employee${employeeIds.length === 1 ? "" : "s"} from ${selected.name}? They will remain in the overall employee databank.`)) return;
    setIsWorking(true);
    setError("");
    setNotice("");
    try {
      const response = await hrApi.assignEmployeesToDepartment(selected.id, { employeeIds, action, reason: assignmentReason.trim() || null });
      const result = response?.data?.data ?? response?.data ?? {};
      setNotice(action === "assign"
        ? `${result.changed ?? employeeIds.length} employee${(result.changed ?? employeeIds.length) === 1 ? "" : "s"} assigned to ${selected.name}.`
        : `${result.changed ?? employeeIds.length} employee${(result.changed ?? employeeIds.length) === 1 ? "" : "s"} removed from ${selected.name}.`);
      setPoolSelection([]);
      setAssignedSelection([]);
      setAssignmentReason("");
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The department assignment could not be updated.");
    } finally {
      setIsWorking(false);
    }
  };

  const removeSelected = async () => {
    if (!selected) return;
    const linkedRecords = Number(selected._count?.employees ?? 0) + Number(selected._count?.jobOpenings ?? 0);
    const message = linkedRecords > 0
      ? `${selected.name} is linked to ${assignedEmployees.length} employee record(s). It will be deactivated rather than deleted so employee and recruitment history remain intact. Continue?`
      : `Delete ${selected.name}? This cannot be undone.`;
    if (!window.confirm(message)) return;
    setIsWorking(true);
    setError("");
    setNotice("");
    try {
      const response = await hrApi.deleteDepartment(selected.id);
      const result = response?.data?.data ?? response?.data ?? {};
      setNotice(result.message || `${selected.name} was deleted.`);
      setSelectedId(null);
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The department could not be deleted.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="master-department">
      <PageHeader
        eyebrow="Employee databank / master data"
        title="Master Department"
        subtitle="Create and maintain departments, review everyone assigned to one, and bulk-assign employees without leaving the databank."
        actions={<Button icon={Plus} onClick={() => setShowCreate((current) => !current)}>{showCreate ? "Cancel" : "New Department"}</Button>}
      />

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      {showCreate && (
        <form className="card master-department-create" onSubmit={submitCreate}>
          <div className="master-department-create__heading">
            <div className="master-department-create__icon"><Building2 size={20} aria-hidden="true" /></div>
            <div>
              <h2>Create a department</h2>
              <p>The code can be adjusted before saving. Duplicate names and codes are rejected.</p>
            </div>
            <button type="button" className="master-department-icon-button" onClick={() => setShowCreate(false)} aria-label="Close department form"><X size={18} /></button>
          </div>
          <div className="master-department-create__grid">
            <label className="field">
              <span className="field__label">Department name *</span>
              <input
                className="input"
                autoFocus
                required
                value={createForm.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setCreateForm((current) => ({ ...current, name, code: codeTouched ? current.code : makeDepartmentCode(name) }));
                }}
                placeholder="e.g. Information Technology"
              />
            </label>
            <label className="field">
              <span className="field__label">Department code *</span>
              <input className="input master-department-code" required maxLength={20} value={createForm.code} onChange={(event) => { setCodeTouched(true); setCreateForm((current) => ({ ...current, code: event.target.value.toUpperCase() })); }} placeholder="e.g. INF10" />
            </label>
            <label className="field master-department-description">
              <span className="field__label">Description</span>
              <input className="input" value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} placeholder="Optional description of the department's scope" />
            </label>
          </div>
          <div className="master-department-create__actions">
            <Button type="submit" icon={Plus} loading={isWorking}>Save Department</Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="master-department-layout">
        <aside className="card master-department-list" aria-label="Department master list">
          <div className="master-department-list__heading">
            <div>
              <h2>Departments</h2>
              <p>{departments.length} in the master</p>
            </div>
            <Building2 size={20} aria-hidden="true" />
          </div>
          <label className="master-department-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search departments</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search department or code" aria-label="Search departments" />
          </label>
          <div className="master-department-list__items">
            <button type="button" className="master-department-create-tile" onClick={() => setShowCreate(true)}>
              <span><Plus size={18} /></span>
              <span><strong>Add department</strong><small>Create a new master record</small></span>
            </button>
            {departmentsLoading && <div className="master-department-list__loading">Loading departments…</div>}
            {!departmentsLoading && visibleDepartments.length === 0 && <p className="master-department-list__empty">No department matches “{search}”.</p>}
            {visibleDepartments.map((department) => {
              const employeeCount = Number(department._count?.employees ?? 0);
              const selectedCard = department.id === selected?.id;
              return (
                <button
                  key={department.id}
                  type="button"
                  className={`master-department-card ${selectedCard ? "master-department-card--active" : ""} ${department.isActive ? "" : "master-department-card--inactive"}`}
                  onClick={() => setSelectedId(department.id)}
                  aria-pressed={selectedCard}
                >
                  <span className="master-department-card__icon">{initialsFromName(department.name)}</span>
                  <span className="master-department-card__body">
                    <span className="master-department-card__title">{department.name}</span>
                    <span className="master-department-card__meta"><code>{department.code}</code> {department.isActive ? "Active" : "Inactive"}</span>
                    <span className="master-department-card__count"><UsersRound size={13} aria-hidden="true" /> {employeeCount} employee{employeeCount === 1 ? "" : "s"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="master-department-detail" aria-label={selected ? `${selected.name} department details` : "Department details"}>
          {!selected ? (
            <div className="card master-department-empty"><EmptyStateBlock icon={Building2} title="Select or create a department" description="Choose a department on the left, or create the first one to start assigning employees." action={<Button icon={Plus} onClick={() => setShowCreate(true)}>Create Department</Button>} /></div>
          ) : (
            <>
              <div className="card master-department-summary">
                <div className="master-department-summary__main">
                  <span className="master-department-summary__logo">{initialsFromName(selected.name)}</span>
                  <div>
                    <div className="master-department-summary__eyebrow"><code>{selected.code}</code> <Badge variant={selected.isActive ? "green" : "grey"} dot>{selected.isActive ? "Active" : "Inactive"}</Badge></div>
                    <h2>{selected.name}</h2>
                    <p>{selected.description || "No description has been provided for this department."}</p>
                  </div>
                </div>
                <div className="master-department-summary__actions">
                  <button type="button" className="master-department-delete" onClick={removeSelected} title="Delete or deactivate department" aria-label={`Delete ${selected.name}`}>
                    <Archive size={17} aria-hidden="true" /><span>Delete</span>
                  </button>
                </div>
                <div className="master-department-metrics">
                  <div><strong>{assignedEmployees.length}</strong><span>Total assigned</span></div>
                  <div><strong>{currentCount}</strong><span>Current</span></div>
                  <div><strong>{formerCount}</strong><span>Former</span></div>
                  <div><strong>{Number(selected._count?.jobOpenings ?? 0)}</strong><span>Openings linked</span></div>
                </div>
              </div>

              <div className="master-department-panels">
                <div className="card master-department-assigned">
                  <div className="master-department-panel__heading">
                    <div>
                      <h3>Employees in {selected.name}</h3>
                      <p>Every record currently mapped to this department.</p>
                    </div>
                    <span className="master-panel-count">{visibleAssigned.length}</span>
                  </div>
                  <div className="master-department-table-controls">
                    <label className="master-department-search master-department-search--compact">
                      <Search size={16} aria-hidden="true" />
                      <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Search assigned employees" aria-label="Search assigned employees" />
                    </label>
                    <select className="input master-department-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter assigned employees by status">
                      <option value="ALL">All statuses</option>
                      <option value="EXISTING">Current</option>
                      <option value="FORMER">Former</option>
                    </select>
                    {visibleAssigned.length > 0 && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={toggleVisibleAssigned}>
                        <CheckSquare size={14} aria-hidden="true" /> {visibleAssigned.every((employee) => assignedSelection.includes(employee.id)) ? "Deselect shown" : "Select shown"}
                      </button>
                    )}
                    <Button size="sm" variant="danger-ghost" icon={UserMinus} disabled={assignedSelection.length === 0 || isWorking} loading={isWorking} onClick={() => applyDepartmentSelection("unassign")}>Remove {assignedSelection.length ? `(${assignedSelection.length})` : ""}</Button>
                  </div>
                  <div className="master-department-table-wrap">
                    <table className="data-table master-department-table">
                      <thead><tr><th><input type="checkbox" checked={visibleAssigned.length > 0 && visibleAssigned.every((employee) => assignedSelection.includes(employee.id))} onChange={toggleVisibleAssigned} aria-label="Select all shown assigned employees" /></th><th>Employee</th><th>Employee ID</th><th>Designation</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        {assignedLoading && <tr><td colSpan={6}><div className="empty-state">Loading assigned employees…</div></td></tr>}
                        {!assignedLoading && visibleAssigned.length === 0 && <tr><td colSpan={6}><EmptyStateBlock icon={UsersRound} title="No employees are assigned" description="Use the assignment panel to add employees to this department." /></td></tr>}
                        {visibleAssigned.map((employee) => (
                          <tr key={employee.id}>
                            <td><input type="checkbox" checked={assignedSelection.includes(employee.id)} onChange={() => toggleAssigned(employee.id)} aria-label={`Select ${employee.fullName}`} /></td>
                            <td><div className="cell-user"><div className="avatar">{initials(employee.fullName)}</div><div className="cell-user__text"><button type="button" className="ta-link cell-user__name" onClick={() => navigate(`/hr/employees/${employee.id}`)}>{employee.fullName}</button><div className="cell-user__sub">{employee.officialEmail}</div></div></div></td>
                            <td className="cell-strong">{employee.employeeCode}</td>
                            <td>{employee.designation?.name || "—"}</td>
                            <td><StatusPill status={employee.status} /></td>
                            <td className="text-right"><button type="button" className="btn btn--ghost btn--icon" onClick={() => navigate(`/hr/employees/${employee.id}`)} aria-label={`View ${employee.fullName}`}><Eye size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card master-department-pool">
                  <div className="master-department-panel__heading">
                    <div>
                      <h3>Assign employees</h3>
                      <p>Search across the full databank and attach people to {selected.name}.</p>
                    </div>
                    <span className="master-panel-count master-panel-count--green">{poolSelection.length}</span>
                  </div>
                  <label className="master-department-search master-department-search--compact">
                    <Search size={16} aria-hidden="true" />
                    <input value={poolSearch} onChange={(event) => setPoolSearch(event.target.value)} placeholder="Search name, ID, email, department or designation" aria-label="Search employees to assign" />
                  </label>
                  <div className="master-assignment-reason">
                    <label>
                      <span>Assignment note <small>(optional)</small></span>
                      <input className="input" value={assignmentReason} onChange={(event) => setAssignmentReason(event.target.value)} maxLength={240} placeholder="e.g. annual org restructure" />
                    </label>
                  </div>
                  <div className="master-department-pool__toolbar">
                    {visiblePool.length > 0 && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={toggleVisiblePool}>
                        <CheckSquare size={14} aria-hidden="true" /> {visiblePool.every((employee) => poolSelection.includes(employee.id)) ? "Deselect shown" : "Select shown"}
                      </button>
                    )}
                    <span className="cell-muted">{poolLoading ? "Loading…" : `${visiblePool.length} available`}</span>
                  </div>
                  <div className="master-assignment-list">
                    {visiblePool.length === 0 && !poolLoading && <p className="master-assignment-list__empty">No matching unassigned employees found.</p>}
                    {visiblePool.map((employee) => (
                      <label key={employee.id} className={`master-assignment-row ${poolSelection.includes(employee.id) ? "master-assignment-row--selected" : ""}`}>
                        <input type="checkbox" checked={poolSelection.includes(employee.id)} onChange={() => togglePool(employee.id)} />
                        <span className="avatar">{initials(employee.fullName)}</span>
                        <span className="master-assignment-row__text"><strong>{employee.fullName}</strong><small>{employee.employeeCode} · {employee.department?.name || "Unassigned"}</small></span>
                        <StatusPill status={employee.status} />
                      </label>
                    ))}
                  </div>
                  <Button block icon={CheckSquare} disabled={poolSelection.length === 0 || isWorking} loading={isWorking} onClick={() => applyDepartmentSelection("assign")}>Assign {poolSelection.length ? `${poolSelection.length} Employee${poolSelection.length === 1 ? "" : "s"}` : "Employees"}</Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
