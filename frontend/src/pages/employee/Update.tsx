import { useState, useEffect, useRef, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { authApi } from "../../lib/api";
import { careerSiteUrl } from "../../lib/appLinks";
import { useDebounced } from "../../hooks/useDebounced";
import Logo from "../../components/Logo";

const FIELDS: Array<{ key: string; label: string; type: string }> = [
  { key: "fullName", label: "Full Name", type: "text" },
  { key: "employeeCode", label: "Employee ID", type: "text" },
  { key: "officialEmail", label: "Official Email ID", type: "email" },
  { key: "personalEmail", label: "Personal Email ID", type: "email" },
  { key: "mobile", label: "Mobile Number", type: "tel" },
  { key: "departmentId", label: "Department", type: "select" },
  { key: "designationId", label: "Designation", type: "select" },
  { key: "qualification", label: "Highest Educational Qualification", type: "text" },
  { key: "graduationYear", label: "Graduation Year", type: "number" },
  { key: "totalExperience", label: "Total Years of Experience", type: "number" },
  { key: "relevantExperience", label: "Relevant Years of Experience", type: "number" },
  { key: "previousOrganization", label: "Previous Organization", type: "text" },
  { key: "specialization", label: "Current Work Specialization", type: "text" },
  { key: "employmentTypeId", label: "Employment Type", type: "select" },
  { key: "joiningDate", label: "Joining Date", type: "date" },
  { key: "workLocation", label: "Work Location", type: "text" },
  { key: "additionalInfo", label: "Additional Information", type: "text" },
];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;
const MAX_CV_MB = 10;
const CV_EXTENSIONS = [".pdf", ".doc", ".docx"];

export default function EmployeeUpdate() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [step, setStep] = useState<"validating" | "form" | "success">("validating");
  const [employee, setEmployee] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<any[]>([]);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [savedCv, setSavedCv] = useState<{ fileId: string; fileName: string; size: number } | null>(null);
  const [savedSource, setSavedSource] = useState<string | null>(null);
  const [fieldReview, setFieldReview] = useState<Array<{ key?: string; label: string; note?: string }> | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle");
  const hydrated = useRef(false);
  const debouncedForm = useDebounced(form, 1500);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setStep("success");
      setError("This link is missing its invitation token. Please open the link from your invitation email, or ask HR to resend it.");
      return;
    }
    (async () => {
      try {
        const r = await authApi.validateEmployeeInvitation(token);
        if (cancelled) return;
        const employeeData = r.data?.employee ?? r.data;
        const draft = r.data?.draft ?? null;
        setSavedCv(r.data?.cv ?? null);
        setSavedSource(r.data?.source ?? null);
        setFieldReview(r.data?.fieldReview ?? null);
        setRejection(r.data?.rejection ?? null);
        setLocked(Boolean(r.data?.locked));
        setEmployee(employeeData);
        setStep("form");
        setForm(() => {
          const base: Record<string, string> = {};
          const source = draft && typeof draft === "object" ? { ...employeeData, ...draft } : employeeData;
          FIELDS.forEach((f) => {
            const raw = source?.[f.key];
            if (raw === undefined || raw === null) return;
            if (f.key === "joiningDate" && raw) {
              const d = new Date(raw);
              base[f.key] = Number.isNaN(d.getTime()) ? String(raw) : d.toISOString().slice(0, 10);
            } else {
              base[f.key] = String(raw);
            }
          });
          return base;
        });
        hydrated.current = true;
        setSaveStatus("saved");
        try {
          const dropdowns = await authApi.publicEmployeeUpdateDropdowns();
          const payload = dropdowns.data ?? dropdowns;
          setDepartments(payload?.departments ?? []);
          setDesignations(payload?.designations ?? []);
          setEmploymentTypes(payload?.employmentTypes ?? []);
        } catch (dropdownError: any) {
          setError("Some form options could not be loaded. Please refresh the page — the rest of the form still works.");
        }
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status;
        const serverMessage = err?.response?.data?.error?.message;
        setStep("success");
        setError(
          status === 404
            ? "This invitation link is invalid or has expired. Please ask HR to resend it."
            : serverMessage || "This invitation link is invalid. Please contact HR to resend it.",
        );
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!hydrated.current || step !== "form" || locked) return;
    if (Object.keys(debouncedForm).length === 0) return;
    setSaveStatus("saving");
    let cancelled = false;
    authApi.saveEmployeeDraft(token, debouncedForm)
      .then(() => { if (!cancelled) setSaveStatus("saved"); })
      .catch(() => { if (!cancelled) setSaveStatus("unsaved"); });
    return () => { cancelled = true; };
  }, [debouncedForm, step, token, locked]);

  const clearError = (key: string) => setErrors((current) => { const next = { ...current }; delete next[key]; return next; });

  const validateCvFile = (file: File | null): string => {
    if (!file) return savedCv ? "" : "Please upload your latest CV.";
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!CV_EXTENSIONS.includes(ext)) return "Only PDF, DOC and DOCX files are supported.";
    if (file.size > MAX_CV_MB * 1024 * 1024) return `File too large. Maximum ${MAX_CV_MB} MB.`;
    if (file.size === 0) return "The selected file is empty.";
    return "";
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    const value = (key: string) => String(form[key] ?? "").trim();
    if (value("fullName").length < 2) next.fullName = "Please enter your full name.";
    if (value("employeeCode").length < 2) next.employeeCode = "Employee ID is required.";
    if (!EMAIL_REGEX.test(value("officialEmail"))) next.officialEmail = "Enter a valid official email address.";
    if (!EMAIL_REGEX.test(value("personalEmail"))) next.personalEmail = "Enter a valid personal email address.";
    if (!MOBILE_REGEX.test(value("mobile").replace(/[\s()-]/g, ""))) next.mobile = "Enter a valid 10-digit mobile number (starting 6–9).";
    if (!value("departmentId")) next.departmentId = "Select your department.";
    if (!value("designationId")) next.designationId = "Select your designation.";
    if (!value("qualification")) next.qualification = "Highest educational qualification is required.";
    const year = Number(value("graduationYear"));
    if (!Number.isFinite(year) || year < 1950 || year > new Date().getFullYear() + 6) next.graduationYear = "Enter a valid passing year.";
    const total = Number(value("totalExperience"));
    if (!Number.isFinite(total) || total < 0) next.totalExperience = "Enter total years of experience.";
    const relevant = Number(value("relevantExperience"));
    if (!Number.isFinite(relevant) || relevant < 0) next.relevantExperience = "Enter relevant years of experience.";
    if (!value("previousOrganization")) next.previousOrganization = "Previous organization is required.";
    if (!value("specialization")) next.specialization = "Your specialization is required.";
    if (!value("employmentTypeId")) next.employmentTypeId = "Select employment type.";
    if (!value("joiningDate")) next.joiningDate = "Joining date is required.";
    else if (Number.isNaN(new Date(value("joiningDate")).getTime())) next.joiningDate = "Enter a valid joining date.";
    else if (new Date(value("joiningDate")).getTime() > Date.now()) next.joiningDate = "You have already joined, please update your past joining date not a future joining date.";
    if (!value("workLocation")) next.workLocation = "Work location is required.";
    if (!value("additionalInfo")) next.additionalInfo = "Additional information is required.";
    const cvError = validateCvFile(cvFile);
    if (cvError) next.cv = cvError;
    return next;
  };

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearError(key);
  };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { setCvFile(e.target.files?.[0] ?? null); clearError("cv"); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setError(`Please correct the ${Object.keys(next).length} highlighted field${Object.keys(next).length === 1 ? "" : "s"} below and submit again.`);
      const first = Object.keys(next)[0];
      const el = document.getElementById(`field-${first}`) ?? document.getElementById("field-cv");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setLoading(true); setError("");
    const fd = new FormData();
    FIELDS.forEach((f) => { if (form[f.key]) fd.append(f.key, form[f.key]); });
    if (cvFile) fd.append("cv", cvFile);
    try {
      await authApi.submitEmployeeUpdate(token, fd);
      setStep("success");
    } catch (err: any) {
      const status = err?.response?.status;
      setError(
        !err?.response
          ? "Network problem — please check your internet connection and try again."
          : status === 413
            ? `Your CV is too large. Please upload a file under ${MAX_CV_MB} MB.`
            : status === 400
              ? "Please review the highlighted fields and try again."
              : "We could not submit your information right now. Please try again, or contact HR if the problem continues.",
      );
    } finally { setLoading(false); }
  };

  if (step === "validating") return (
    <div className="min-h-screen flex items-center center surface-app"><div className="p-4 ink-soft">Validating invitation…</div></div>
  );
  if (step === "success") return (
    <div className="min-h-screen flex items-center center surface-app">
      <div className="card p-8 mx-auto text-center max-w-md">
        <div className="w-10 h-10 rounded-full bg-[#659616] flex items-center justify-center text-white mx-auto mb-4 font-bold">✓</div>
        <h2 className="text-xl font-bold ink-body mb-2">{error ? "Error" : "Information Submitted"}</h2>
        <p className="ink-soft mb-6">{error || (employee ? `Thank you, ${employee.fullName}. Your employee information has been submitted successfully. Our HR team will verify it before your record is updated.` : "")}</p>
        {!error && careerSiteUrl && <a className="btn-primary" href={careerSiteUrl}>Return to Careers</a>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen surface-app">
      <div className="max-w-2xl mx-auto p-4">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Logo size={34} />
            <div className="text-xl font-bold ink-body">Employee Information Update</div>
          </div>
          <p className="ink-soft text-sm mb-6">Hello <span className="font-semibold">{employee?.fullName}</span>, please review and update your information.{saveStatus !== "idle" && <span className="ml-2 text-[11px] font-semibold align-middle">{saveStatus === "saving" ? "Saving draft…" : saveStatus === "saved" ? "Draft saved" : "Draft not saved — check your connection"}</span>}</p>
          {locked && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <div className="font-semibold mb-1">Verified by HR</div>
              Your details have been validated by the HR team and can no longer be changed. If something is incorrect, contact HR directly.
            </div>
          )}
          {(fieldReview?.length || rejection) && (
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
              <div className="font-semibold mb-1">HR requested corrections before this can be applied:</div>
              {fieldReview?.length ? (
                <ul className="list-disc pl-5 space-y-0.5">
                  {fieldReview.map((item, index) => (
                    <li key={index}><span className="font-semibold">{item.label}</span>{item.note ? <> — {item.note}</> : null}</li>
                  ))}
                </ul>
              ) : (
                <p className="whitespace-pre-line">{rejection}</p>
              )}
              <p className="mt-2 text-xs text-orange-700">Fields marked by HR are highlighted below. Fix them and resubmit.</p>
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FIELDS.map((f) => {
                const flagged = fieldReview?.some((item) => item.key === f.key);
                return (
                <div key={f.key} id={`field-${f.key}`} className={`flex flex-col gap-1${flagged ? " rounded-lg ring-2 ring-orange-300 bg-orange-50/60 p-2 -m-2" : ""}`}>
                  <label className="text-sm font-medium ink-soft">{f.label}{flagged && <span className="ml-1 text-[10px] font-bold uppercase text-orange-600 align-middle">Correct</span>}<span className="text-red-500 ml-0.5">*</span></label>
                  {f.type === "select"
                    ? f.key === "departmentId"
                      ? <select className="input" value={form[f.key] || ""} onChange={(e) => handleChange(f.key, e.target.value)}>
                          <option value="">Select department</option>
                          {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      : f.key === "designationId"
                        ? <select className="input" value={form[f.key] || ""} onChange={(e) => handleChange(f.key, e.target.value)}>
                            <option value="">Select designation</option>
                            {designations.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        : <select className="input" value={form[f.key] || ""} onChange={(e) => handleChange(f.key, e.target.value)}>
                            <option value="">Select type</option>
                            {employmentTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                    : <input className="input" type={f.type as any} value={form[f.key] || ""} onChange={(e) => handleChange(f.key, e.target.value)} />}
                  {errors[f.key] && <p className="text-[11px] font-medium text-red-600">{errors[f.key]}</p>}
                </div>
                );
              })}
              <div id="field-cv" className="flex flex-col gap-1">
                <label className="text-sm font-medium ink-soft">Upload Latest CV<span className="text-red-500 ml-0.5">*</span></label>
                <div className="flex flex-wrap items-center gap-3">
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFile} className="visually-hidden" />
                  {cvFile ? (
                    <>
                      <span className="text-sm font-semibold ink-body max-w-[16rem] truncate">{cvFile.name}</span>
                      <button type="button" className="btn btn--outline btn--sm" onClick={() => fileInputRef.current?.click()}>Replace</button>
                      <button type="button" className="btn btn--ghost btn--sm text-red-600" onClick={() => setCvFile(null)}>Remove</button>
                    </>
                  ) : (
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => fileInputRef.current?.click()}>Browse CV</button>
                  )}
                </div>
                {!cvFile && savedCv && (
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="text-sm font-semibold ink-body max-w-[16rem] truncate">{savedCv.fileName}</span>
                    <span className="text-[11px] ink-soft">{(savedCv.size / 1024).toFixed(0)} KB · previously uploaded</span>
                    <a className="btn btn--outline btn--sm" href={`/api/v1/auth/employee/invitation/${token}/cv`} target="_blank" rel="noreferrer">Preview CV</a>
                  </div>
                )}
                {errors.cv && <p className="text-[11px] font-medium text-red-600">{errors.cv}</p>}
              </div>
            </div>
            <p className="text-xs ink-soft mt-2">{savedSource === "submission" ? "Fields reloaded from your previously submitted information." : savedSource === "draft" ? "Fields reloaded from your saved draft." : "Fields reloaded from the employee record in the database."} Your CV is stored securely and reused unless you upload a replacement.</p>
            <button className="btn-primary w-full mt-2" disabled={loading || locked}>{locked ? "Verified — changes locked" : loading ? "Submitting…" : "Submit Information"}</button>
          </form>
          {error && <div className="mt-4 rounded bg-orange-50 p-3 text-sm text-orange-700 border border-orange-100">{error}</div>}
        </div>
      </div>
    </div>
  );
}
