import { useState, type ReactNode } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, AlertCircle, BriefcaseBusiness, FileText, GraduationCap, History, Mail, Pencil, Phone, Trash2, UserRound, UserX } from "lucide-react";
import PageHeader from "../../components/ref/PageHeader";
import Button from "../../components/ref/Button";
import Modal from "../../components/ref/Modal";
import Badge from "../../components/ref/Badge";
import EmployeeFormModal from "./databank/EmployeeFormModal";
import CandidateAdditionalInfo from "../../components/ref/CandidateAdditionalInfo";
import CVInfo from "./databank/CVInfo";
import { formatDate, formatDateTime, initials, employeeStatusMeta, EmptyStateBlock } from "./databank/shared";
import { hrApi } from "../../lib/api";
import { useApiQuery, useInvalidate } from "../../hooks/useApiQuery";

const renderDetailValue = (value: ReactNode): ReactNode => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    JSON.parse(trimmed);
    return <CandidateAdditionalInfo value={trimmed} compact />;
  } catch {
    return value;
  }
};

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("Document");

  const { data: employee, isLoading } = useApiQuery<any>(
    ["employee", id],
    () => hrApi.employee(String(id)).then((r: any) => r?.data?.item),
  );

  const openDocument = async (fileId?: string, name = "Document") => {
    if (!fileId) return;
    try {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      const r = await hrApi.fileAccessToken(fileId);
      const token = r?.data?.token;
      if (token) {
        const blobRes = await hrApi.file(fileId, token);
        setPreviewUrl(URL.createObjectURL(blobRes.data as Blob));
      } else if (r?.data?.url) {
        setPreviewUrl(r.data.url);
      }
      setPreviewName(name);
    } catch {
      setError("Could not open the document.");
    }
  };

  const closePreview = () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const { data: departments = [] } = useApiQuery<any[]>(
    ["departments", "dropdown"],
    () => hrApi.departmentDropdown().then((r: any) => r?.data?.items ?? r?.data ?? []),
  );
  const { data: designations = [] } = useApiQuery<any[]>(
    ["designations", "all"],
    () => hrApi.designations({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );
  const { data: employmentTypes = [] } = useApiQuery<any[]>(
    ["employment-types", "all"],
    () => hrApi.employmentTypes({ page: 1, pageSize: 100 }).then((r: any) => r?.data?.items ?? []),
  );

  if (isLoading && !employee) {
    return <div className="loading-block"><div className="spinner" /> Loading employee profile…</div>;
  }

  if (!employee) {
    return (
      <div className="page">
        <Link className="back-link" to="/hr/employees?tab=current"><ArrowLeft size={16} aria-hidden="true" /> Back to Current Employees</Link>
        <div className="card"><EmptyStateBlock icon={UserX} title="Employee profile not found" description="This record may have been removed or the link is no longer valid." action={<Link className="btn btn--primary" to="/hr/employees?tab=current">Return to Current Employees</Link>} /></div>
      </div>
    );
  }

  const meta = employeeStatusMeta(employee.status);
  const backTarget = employee.status === "FORMER" ? "/hr/employees?tab=former" : "/hr/employees?tab=current";

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
    await hrApi.updateEmployee(employee.id, body);
    if (cv) {
      const fd = new FormData();
      fd.append("cv", cv);
      await hrApi.uploadEmployeeCv(employee.id, fd);
    }
    setNotice("Employee record updated.");
    invalidate(["employees", "employee"]);
  };

  const deleteEmployee = async () => {
    setDeleting(true);
    try {
      await hrApi.deleteEmployee(employee.id);
      invalidate(["employees", "employee"]);
      navigate(backTarget);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "The employee could not be removed.");
      setDeleting(false);
    }
  };

  const empEdu = employee.education?.[0];
  const empExp = employee.employmentHistory?.[0];
  const SectionIcon = { user: UserRound, briefcase: BriefcaseBusiness, graduation: GraduationCap, history: History } as const;
  const sections: Array<{ id: string; title: string; icon: keyof typeof SectionIcon; items: Array<[string, React.ReactNode?, boolean?]> }> = [
    {
      id: "basic",
      title: "Basic Information",
      icon: "user",
      items: [
        ["Employee ID", employee.employeeCode],
        ["Full Name", employee.fullName],
        ["Email Address", employee.officialEmail],
        ["Personal Email", employee.personalEmail],
        ["Contact Number", employee.mobile],
      ],
    },
    {
      id: "professional",
      title: "Professional Information",
      icon: "briefcase",
      items: [
        ["Department", employee.department?.name],
        ["Designation", employee.designation?.name],
        ["Joining Date", formatDate(employee.joiningDate)],
        ["Leaving Date", employee.leavingDate ? formatDate(employee.leavingDate) : null],
        ["Employment Type", employee.employmentType?.name],
        ["Reporting Manager", null],
        ["Work Location", employee.workLocation],
      ],
    },
    {
      id: "education",
      title: "Education Details",
      icon: "graduation",
      items: [
        ["Qualification", employee.qualification],
        ["Institution", empEdu?.institution],
        ["Specialization", employee.specialization || empEdu?.field],
        ["Passing Year", employee.graduationYear ?? empEdu?.endYear],
      ],
    },
    {
      id: "experience",
      title: "Professional Experience",
      icon: "history",
      items: [
        ["Previous Company", employee.previousOrganization || empExp?.organization],
        ["Previous Designation", empExp?.title],
        ["Total Experience", employee.totalExperience != null ? `${employee.totalExperience} years` : null],
        ["Relevant Experience", employee.relevantExperience != null ? `${employee.relevantExperience} years` : null],
        ["Job Responsibilities", empExp?.description || employee.additionalInfo || employee.remarks || null, true],
      ],
    },
  ];

  const extra = (() => {
    if (!employee.additionalInfo) return null;
    try {
      const parsed = JSON.parse(employee.additionalInfo);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  })();
  if (extra) {
    sections.push({
      id: "application",
      title: "Additional Information (from application)",
      icon: "user",
      items: [
        ["Address", extra.currentAddress ?? extra.address ?? employee.workLocation ?? null],
        ["Date of Birth", extra.dateOfBirth ? formatDate(extra.dateOfBirth) : null],
        ["Gender", extra.gender ?? null],
        ["Notice Period", extra.noticePeriod ?? null],
        ["Expected Salary", extra.expectedSalary ?? null],
        ["Work Specialization", extra.workSpecialization ?? null],
      ] as Array<[string, React.ReactNode?, boolean?]>,
    });
  }

  return (
    <div className="page">
      <Link className="back-link" to={backTarget}><ArrowLeft size={16} aria-hidden="true" /> Back to {employee.status === "FORMER" ? "Former Employees" : "Current Employees"}</Link>

      {notice && <div className="notice notice--success" role="status"><div className="notice__body">{notice}</div></div>}
      {error && <div className="notice notice--error" role="alert"><div className="notice__body">{error}</div></div>}

      <PageHeader
        eyebrow={`Employee ID · ${employee.employeeCode}`}
        title={employee.fullName}
        subtitle={`${employee.designation?.name || "—"} · ${employee.department?.name || "—"}`}
        actions={(
          <>
            {employee.locked ? (
              <span className="notice notice--info" style={{ margin: 0 }}><div className="notice__body" style={{ padding: "0.35rem 0.6rem" }}><div className="notice__title" style={{ fontSize: "0.72rem" }}>Record locked</div>Confirmed from the employee's validated submission.</div></span>
            ) : (
              <Button variant="outline" icon={Pencil} onClick={() => setEditOpen(true)}>Edit Employee</Button>
            )}
            <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>Delete</Button>
          </>
        )}
      />

      <div className="profile-hero card">
        <div className="profile-hero__avatar avatar avatar--lg">{initials(employee.fullName)}</div>
        <div className="profile-hero__identity">
          <div className="profile-hero__name-row">
            <h2 className="profile-hero__name">{employee.fullName}</h2>
            <Badge variant={meta.variant} dot>{meta.label}</Badge>
          </div>
          <p className="profile-hero__role">{employee.designation?.name || "—"} · {employee.department?.name || "—"}</p>
          <div className="profile-hero__contacts">
            <span><Mail size={14} aria-hidden="true" /> {employee.officialEmail}</span>
            {employee.mobile && <span><Phone size={14} aria-hidden="true" /> {employee.mobile}</span>}
            <span><FileText size={14} aria-hidden="true" /> {employee.cvFileId || employee.cvVersions?.some((cv: any) => cv.isCurrent) ? "CV available" : "No CV on file"}</span>
          </div>
        </div>
        <div className="profile-hero__meta">
          <div><span className="detail-item__label">Employment Type</span><strong>{employee.employmentType?.name || "—"}</strong></div>
          <div><span className="detail-item__label">Joining Date</span><strong>{formatDate(employee.joiningDate)}</strong></div>
        </div>
      </div>

      <div className="profile-layout">
        <div className="card profile-layout__main">
          <div className="card__header">
            <div>
              <h3 className="card__title">Employee Information</h3>
              <p className="card__subtitle">Basic, professional, education and experience details.</p>
            </div>
          </div>
          <div className="card__body">
            <div className="employee-details">
              {sections.map((section) => {
                const Icon = SectionIcon[section.icon];
                return (
                  <section className="detail-section" key={section.id}>
                    <h4 className="detail-section__title"><Icon size={16} aria-hidden="true" /> {section.title}</h4>
                    <div className="detail-grid">
                      {section.items.map(([label, value, full]) => {
                        const empty = value === undefined || value === null || value === "";
                        return (
                          <div className={`detail-item${full ? " detail-item--full" : ""}`} key={label}>
                            <div className="detail-item__label">{label}</div>
                            <div className={`detail-item__value${empty ? " detail-item__value--muted" : ""}`}>{empty ? "—" : renderDetailValue(value)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
            {employee.skills?.length > 0 && (
              <div className="detail-section">
                <div className="detail-section__title">Skills</div>
                <div className="flex flex-wrap gap-2">{employee.skills.map((record: any) => <Badge key={record.id} variant="blue">{record.skill?.name || "Skill"}</Badge>)}</div>
              </div>
            )}
            {Array.isArray(employee.documents) && employee.documents.length > 0 && (
              <div className="detail-section">
                <div className="detail-section__title"><FileText size={16} aria-hidden="true" /> Uploaded Documents <span className="cell-muted">(in certificate order)</span></div>
                <ul className="ta-detail-list">
                  {employee.documents.map((doc: any) => (
                    <li className="ta-detail-list__item" key={doc.id}>
                      <div className="ta-detail-list__title">{doc.category?.name || "Document"}{doc.category?.isRequired && <span className="cell-muted"> · Required</span>}</div>
                      <div className="ta-detail-list__meta"><Badge variant={doc.status === "ACCEPTED" ? "green" : doc.status === "REJECTED" ? "red" : "orange"} dot>{String(doc.status || "NOT_UPLOADED").replace(/_/g, " ")}</Badge>{doc.uploadedAt ? ` · Uploaded ${formatDate(doc.uploadedAt)}` : ""}</div>
                      <div className="doc-row-actions">
                        {doc.fileId && <button type="button" className="ta-link" onClick={() => void openDocument(doc.fileId, doc.category?.name)}>View</button>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <aside className="profile-layout__side">
          <div className="card">
            <div className="card__header">
              <div><h3 className="card__title">CV Documents</h3><p className="card__subtitle">Reusable CV management</p></div>
            </div>
            <div className="card__body">
              <CVInfo employeeId={employee.id} allowReplace allowRemove />
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <div><h3 className="card__title">Record Metadata</h3><p className="card__subtitle">Audit information from the service</p></div>
            </div>
            <div className="card__body">
              <div className="profile-meta-list">
                <div><span className="detail-item__label">Created</span><span>{formatDateTime(employee.createdAt)}</span></div>
                <div><span className="detail-item__label">Last Updated</span><span>{formatDateTime(employee.updatedAt)}</span></div>
                <div><span className="detail-item__label">Joining Date</span><span>{formatDate(employee.joiningDate)}</span></div>
                <div><span className="detail-item__label">Reporting Manager</span><span>{employee.reportingManager || "—"}</span></div>
              </div>
              <div className="notice notice--neutral" style={{ marginTop: "1rem" }}>
                <span className="notice__icon"><AlertCircle size={17} aria-hidden="true" /></span>
                <div className="notice__body">CV access is permission-protected server-side for every download.</div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <EmployeeFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode={employee.status === "FORMER" ? "former" : "current"}
        employee={employee}
        departments={departments}
        designations={designations}
        employmentTypes={employmentTypes}
        onSubmit={save}
        submitLabel="Save Changes"
      />

      <Modal
        open={Boolean(previewUrl)}
        onClose={closePreview}
        title={previewName}
        size="lg"
        footer={<Button variant="outline" onClick={closePreview}>Close</Button>}
      >
        {previewUrl && (previewUrl.startsWith("blob:") || /\.pdf(\?|$)/i.test(previewUrl)
          ? <iframe title={previewName} src={previewUrl} style={{ width: "100%", height: 520, border: 0 }} />
          : <img src={previewUrl} alt={previewName} style={{ maxWidth: "100%", maxHeight: 520, display: "block", margin: "0 auto" }} />)}
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => (deleting ? undefined : setDeleteOpen(false))}
        title="Delete employee record?"
        size="sm"
        footer={<><Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Keep employee</Button><Button variant="danger" onClick={deleteEmployee} loading={deleting}>Delete employee</Button></>}
      >
        <p>{`${employee.fullName} (${employee.employeeCode}) will be removed from ${employee.status === "FORMER" ? "former" : "current"} employee records.`}</p>
      </Modal>
    </div>
  );
}
