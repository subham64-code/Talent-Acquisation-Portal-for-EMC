import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  GraduationCap,
  History,
  Save,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import Button from "../../../components/ref/Button";
import { Input, Select, Textarea } from "../../../components/ref/Input";
import Modal from "../../../components/ref/Modal";
import { fileSize } from "./shared";

const SECTION_ICONS = {
  user: UserRound,
  briefcase: BriefcaseBusiness,
  graduation: GraduationCap,
  history: History,
} as const;

export type EmployeeFormValues = {
  employeeId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  department: string;
  designation: string;
  joiningDate: string;
  employmentType: string;
  reportingManager: string;
  qualification: string;
  institution: string;
  specialization: string;
  passingYear: string;
  previousCompany: string;
  previousDesignation: string;
  totalExperience: string;
  jobResponsibilities: string;
};

export const EMPTY_EMPLOYEE_FORM: EmployeeFormValues = {
  employeeId: "",
  fullName: "",
  email: "",
  contactNumber: "",
  department: "",
  designation: "",
  joiningDate: "",
  employmentType: "",
  reportingManager: "",
  qualification: "",
  institution: "",
  specialization: "",
  passingYear: "",
  previousCompany: "",
  previousDesignation: "",
  totalExperience: "",
  jobResponsibilities: "",
};

const cloneDefaults = (employee?: any): EmployeeFormValues => ({
  ...EMPTY_EMPLOYEE_FORM,
  employeeId: employee?.employeeCode ?? "",
  fullName: employee?.fullName ?? "",
  email: employee?.officialEmail ?? "",
  contactNumber: employee?.mobile ?? "",
  department: employee?.departmentId ?? "",
  designation: employee?.designationId ?? "",
  joiningDate: employee?.joiningDate ? new Date(employee.joiningDate).toISOString().slice(0, 10) : "",
  employmentType: employee?.employmentTypeId ?? "",
  qualification: employee?.qualification ?? "",
  institution: employee?.education?.[0]?.institution ?? "",
  specialization: employee?.specialization ?? employee?.education?.[0]?.field ?? "",
  passingYear: employee?.graduationYear != null ? String(employee.graduationYear) : employee?.education?.[0]?.endYear != null ? String(employee.education[0].endYear) : "",
  previousCompany: employee?.previousOrganization ?? employee?.employmentHistory?.[0]?.organization ?? "",
  previousDesignation: employee?.employmentHistory?.[0]?.title ?? "",
  totalExperience: employee?.totalExperience != null ? String(employee.totalExperience) : "",
  jobResponsibilities: employee?.employmentHistory?.[0]?.description ?? employee?.additionalInfo ?? "",
});

export default function EmployeeFormModal({
  open,
  onClose,
  mode = "current",
  employee,
  departments,
  designations,
  employmentTypes,
  onSubmit,
  submitLabel,
}: {
  open: boolean;
  onClose: () => void;
  mode?: "current" | "former";
  employee?: any;
  departments: any[];
  designations: any[];
  employmentTypes: any[];
  onSubmit: (values: EmployeeFormValues, cv: File | null) => Promise<void>;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<EmployeeFormValues>(() => cloneDefaults(employee));
  const [cv, setCv] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(cloneDefaults(employee));
      setCv(null);
      setErrors({});
      setSubmitError("");
    }
  }, [open, employee]);

  const setValue = (key: keyof EmployeeFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const completion = useMemo(() => {
    const required = [
      "employeeId", "fullName", "email", "contactNumber", "department", "designation",
      "joiningDate", "employmentType", "qualification", "institution",
    ];
    const total = required.length + 1;
    const filled = required.filter((key) => String((values as any)[key] ?? "").trim()).length + (cv || employee?.cvFileId ? 1 : 0);
    return Math.round((filled / total) * 100);
  }, [values, cv, employee]);

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!values.employeeId.trim()) next.employeeId = "Employee ID is required.";
    if (!values.fullName.trim()) next.fullName = "Full name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) next.email = "Enter a valid email address.";
    const contactDigits = values.contactNumber.replace(/\D/g, "");
    if (contactDigits.length !== 10) next.contactNumber = "Enter a 10-digit contact number.";
    if (!values.department) next.department = "Select a department.";
    if (!values.designation) next.designation = "Select a designation.";
    if (!values.joiningDate) next.joiningDate = "Select the joining date.";
    if (!values.employmentType) next.employmentType = "Select the employment type.";
    if (!values.qualification.trim()) next.qualification = "Qualification is required.";
    if (!values.institution.trim()) next.institution = "Institution name is required.";
    if (values.passingYear && (!Number.isInteger(Number(values.passingYear)) || Number(values.passingYear) < 1950 || Number(values.passingYear) > new Date().getFullYear() + 6)) {
      next.passingYear = "Enter a valid passing year.";
    }
    if (values.totalExperience && Number(values.totalExperience) < 0) next.totalExperience = "Enter a valid experience.";
    return next;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setSubmitError("Please review the highlighted fields before continuing.");
      return;
    }
    setSaving(true);
    setSubmitError("");
    try {
      await onSubmit(values, cv);
      onClose();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.error?.message || error?.message || "The employee record could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const sections: Array<{ id: string; title: string; desc: string; icon: keyof typeof SECTION_ICONS; body: ReactNode }> = [
    {
      id: "basic",
      title: "Basic Information",
      desc: "Identity and contact details.",
      icon: "user",
      body: (
        <div className="form-grid">
          <Input label="Employee ID" required value={values.employeeId} onChange={(event) => setValue("employeeId", event.target.value)} error={errors.employeeId} placeholder="e.g. EMP-1211" hint="Must be unique across employee records." />
          <Input label="Full Name" required value={values.fullName} onChange={(event) => setValue("fullName", event.target.value)} error={errors.fullName} placeholder="e.g. Ananya Sharma" />
          <Input label="Email Address" required type="email" value={values.email} onChange={(event) => setValue("email", event.target.value)} error={errors.email} placeholder="name@company.com" />
          <Input label="Contact Number" required type="tel" inputMode="numeric" maxLength={10} value={values.contactNumber} onChange={(event) => setValue("contactNumber", event.target.value.replace(/\D/g, "").slice(0,10))} error={errors.contactNumber} placeholder="9876543210" />
        </div>
      ),
    },
    {
      id: "professional",
      title: "Professional Information",
      desc: "Current role, department and employment terms.",
      icon: "briefcase",
      body: (
        <div className="form-grid">
          <Select label="Department" required value={values.department} onChange={(event) => setValue("department", event.target.value)} error={errors.department} placeholder="Select department" options={departments.map((d: any) => ({ value: d.id, label: d.name }))} />
          <Select label="Designation" required value={values.designation} onChange={(event) => setValue("designation", event.target.value)} error={errors.designation} placeholder="Select designation" options={designations.map((d: any) => ({ value: d.id, label: d.name }))} />
          <Input label="Joining Date" required type="date" value={values.joiningDate} onChange={(event) => setValue("joiningDate", event.target.value)} error={errors.joiningDate} />
          <Select label="Employment Type" required value={values.employmentType} onChange={(event) => setValue("employmentType", event.target.value)} error={errors.employmentType} placeholder="Select employment type" options={employmentTypes.map((t: any) => ({ value: t.id, label: t.name }))} />
          <Input label="Reporting Manager" optional value={values.reportingManager} onChange={(event) => setValue("reportingManager", event.target.value)} placeholder="e.g. Priya Nair" />
        </div>
      ),
    },
    {
      id: "education",
      title: "Education Details",
      desc: "Highest completed qualification.",
      icon: "graduation",
      body: (
        <div className="form-grid">
          <Input label="Qualification" required value={values.qualification} onChange={(event) => setValue("qualification", event.target.value)} error={errors.qualification} placeholder="e.g. B.Tech" />
          <Input label="Institution Name" required value={values.institution} onChange={(event) => setValue("institution", event.target.value)} error={errors.institution} placeholder="e.g. National Institute of Technology" />
          <Input label="Specialization" optional value={values.specialization} onChange={(event) => setValue("specialization", event.target.value)} placeholder="e.g. Computer Science" />
          <Input label="Passing Year" optional type="number" min={1950} max={new Date().getFullYear() + 6} value={values.passingYear} onChange={(event) => setValue("passingYear", event.target.value)} error={errors.passingYear} placeholder="e.g. 2020" />
        </div>
      ),
    },
    {
      id: "experience",
      title: "Professional Experience",
      desc: "Most recent employment before joining Ecometrix.",
      icon: "history",
      body: (
        <div className="form-grid">
          <Input label="Previous Company" optional value={values.previousCompany} onChange={(event) => setValue("previousCompany", event.target.value)} placeholder="e.g. Acme Technologies" />
          <Input label="Previous Designation" optional value={values.previousDesignation} onChange={(event) => setValue("previousDesignation", event.target.value)} placeholder="e.g. Software Engineer" />
          <Input label="Total Experience (years)" optional type="number" min={0} max={60} step="1" inputMode="numeric" pattern="[0-9]*" value={values.totalExperience} onKeyDown={(event) => { if (["e","E","+","-",".",","].includes(event.key)) event.preventDefault(); }} onChange={(event) => setValue("totalExperience", event.target.value.replace(/\D+/g, "").slice(0,2))} error={errors.totalExperience} placeholder="e.g. 5" />
          <div className="field field--full"><Textarea label="Job Responsibilities" value={values.jobResponsibilities} onChange={(event) => setValue("jobResponsibilities", event.target.value)} placeholder="Summarise key responsibilities and achievements." rows={4} /></div>
        </div>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onClose={() => (saving ? undefined : onClose())}
      title={employee ? "Edit Employee" : mode === "former" ? "Add Former Employee" : "Add Employee"}
      subtitle={employee ? `${employee.fullName} · ${employee.employeeCode}` : mode === "former" ? "Manual historical record entry" : "HR manual entry"}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        {submitError && <div className="form-alert form-alert--error" role="alert"><AlertCircle size={17} aria-hidden="true" /><span>{submitError}</span></div>}

        <div className="form-progress">
          <div className="form-progress__head"><span>Profile completeness</span><strong>{completion}%</strong></div>
          <div className="form-progress__track" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}><div className="form-progress__bar" style={{ width: `${completion}%` }} /></div>
        </div>

        {sections.map((section) => {
          const Icon = SECTION_ICONS[section.icon];
          return (
            <section className="form-section" key={section.id}>
              <div className="form-section__header">
                <span className="form-section__icon"><Icon size={16} aria-hidden="true" /></span>
                <div><h3 className="form-section__title">{section.title}</h3><p className="form-section__desc">{section.desc}</p></div>
              </div>
              <div className="form-section__body">{section.body}</div>
            </section>
          );
        })}

        <section className="form-section">
          <div className="form-section__header">
            <span className="form-section__icon"><History size={16} aria-hidden="true" /></span>
            <div><h3 className="form-section__title">CV &amp; Documents</h3><p className="form-section__desc">Upload, preview, download or replace the employee CV.</p></div>
          </div>
          <div className="form-section__body">
            {cv || employee?.cvFileId ? (
              <div className="cv-file">
                <span className="cv-file__icon"><Upload size={20} aria-hidden="true" /></span>
                <div className="cv-file__info">
                  <div className="cv-file__name">{cv ? cv.name : "Current CV on file"}</div>
                  <div className="cv-file__meta">{cv ? `${cv.type || "document"} · ${fileSize(cv.size)}` : "Uploaded CV stored securely"}</div>
                </div>
                <div className="cv-file__actions">
                  {cv ? (
                    <button type="button" className="btn btn--ghost btn--icon" onClick={() => setCv(null)} aria-label="Remove selected CV" title="Remove selected CV"><X size={16} /></button>
                  ) : (
                    <label className="btn btn--outline btn--sm">Replace CV<input className="visually-hidden" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setCv(event.target.files?.[0] ?? null)} /></label>
                  )}
                </div>
              </div>
            ) : (
              <label className="cv-dropzone" htmlFor="employee-cv-upload">
                <span className="cv-dropzone__icon"><Upload size={24} aria-hidden="true" /></span>
                <span className="cv-dropzone__title">Drop the CV here or <span className="ta-link">browse files</span></span>
                <span className="cv-dropzone__hint">PDF or Word · maximum 10 MB</span>
                <input id="employee-cv-upload" className="visually-hidden" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setCv(event.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>
        </section>

        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" icon={Save} loading={saving}>{saving ? "Saving…" : submitLabel ?? "Save Employee"}</Button>
        </div>
      </form>
    </Modal>
  );
}
